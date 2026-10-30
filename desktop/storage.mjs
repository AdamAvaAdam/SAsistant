import { readFile, writeFile, rename, copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const DATA_FILE = 'du-lieu.sasistant';
export function validateSnapshot(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.accounts) || value.accounts.length > 6) throw Error('Kho dữ liệu không đúng định dạng.');
  const ids = new Set();
  for (const a of value.accounts) {
    if (!a || typeof a.id !== 'string' || !/^[a-f0-9-]{36}$/.test(a.id) || ids.has(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80 || !Array.isArray(a.messages) || a.messages.length > 1000) throw Error('Dữ liệu tài khoản không hợp lệ.');
    ids.add(a.id);
    if (a.credentials && (!a.credentials.imei || !a.credentials.userAgent || !a.credentials.cookie)) throw Error('Dữ liệu phiên không hợp lệ.');
    for (const m of a.messages) {
      if (!m || ![0, 1].includes(m.type) || !['id', 'threadId', 'name', 'text', 'at'].every(k => typeof m[k] === 'string') || m.text.length > 2000 || m.name.length > 200 || m.threadId.length > 200 || m.id.length > 200 || typeof m.self !== 'boolean') throw Error('Dữ liệu hộp thư không hợp lệ.');
    }
  }
  return value;
}

export class EncryptedStore {
  constructor(folder, cipher) {
    this.folder = path.resolve(folder); this.file = path.join(this.folder, DATA_FILE); this.cipher = cipher;
    this.queue = Promise.resolve();
  }
  async read() {
    let buffer;
    try {
      if ((await stat(this.file)).size > 64 * 1024 * 1024) throw Error('Kho dữ liệu vượt giới hạn 64 MB.');
      buffer = await readFile(this.file);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      for (const suffix of ['.bak', '.tmp']) {
        try { await stat(this.file + suffix); }
        catch (other) { if (other.code === 'ENOENT') continue; throw other; }
        throw Error('Thiếu file dữ liệu chính nhưng còn bản dự phòng. Giữ nguyên thư mục để khôi phục; không tạo kho trống đè lên.');
      }
      return { version: 1, accounts: [] };
    }
    try { return validateSnapshot(JSON.parse(await this.cipher.decrypt(buffer))); }
    catch { throw Error('Không mở được kho dữ liệu. Có thể file hỏng hoặc thuộc tài khoản Windows khác. File gốc được giữ nguyên; bản trước nằm ở du-lieu.sasistant.bak.'); }
  }
  write(snapshot) {
    // Serialize before awaiting: later mutations cannot change a queued snapshot.
    const text = JSON.stringify(validateSnapshot(snapshot));
    const task = this.queue.catch(() => {}).then(async () => {
      const encrypted = await this.cipher.encrypt(text);
      await mkdir(this.folder, { recursive: true });
      await writeFile(this.file + '.tmp', encrypted, { mode: 0o600 });
      try { await copyFile(this.file, this.file + '.bak'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      await rename(this.file + '.tmp', this.file);
    });
    this.queue = task; return task;
  }
}
