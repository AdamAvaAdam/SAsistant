import { randomUUID } from 'node:crypto';
import { validateSnapshot } from './storage.mjs';

export class AccountManager {
  constructor({ connect, store }) { this.connect = connect; this.store = store; this.accounts = new Map(); this.storageError = ''; this.closed = false; }
  snapshot() {
    return { version: 1, accounts: [...this.accounts.values()].map(a => ({ id: a.id, name: a.name, messages: a.messages, ...(a.credentials ? { credentials: a.credentials } : {}) })) };
  }
  list() { return [...this.accounts.values()].map(a => ({ id: a.id, name: a.name, status: a.status, qr: a.qr, messages: a.messages, connecting: !!a.connecting })); }
  async persist() {
    if (this.closed) return;
    try { await this.store.write(this.snapshot()); this.storageError = ''; }
    catch { this.storageError = 'Chưa lưu được dữ liệu. Kiểm tra dung lượng và quyền ghi thư mục; đừng tắt ứng dụng trước khi xử lý.'; throw Error(this.storageError); }
  }
  changed() {
    if (this.closed) return;
    clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.persist().catch(() => {}), 500);
  }
  async load() {
    const data = validateSnapshot(await this.store.read());
    for (const a of data.accounts) this.accounts.set(a.id, { ...a, qr: null, status: a.credentials ? 'Đang khôi phục phiên' : 'Cần đăng nhập QR' });
  }
  restore() { for (const a of this.accounts.values()) if (a.credentials) this.start(a); }
  start(a) {
    if (a.connecting || this.closed) return;
    a.connecting = true;
    Promise.resolve().then(() => this.connect(a, { credentials: a.credentials, onChange: () => this.changed() }))
      .catch(() => { if (!a.cancelled) { a.qr = null; a.status = 'Kết nối thất bại — bấm Đăng nhập lại'; } })
      .finally(() => { a.connecting = false; this.changed(); });
  }
  async add(name) {
    if (this.accounts.size >= 6) throw Error('Tối đa 6 tài khoản.');
    if (typeof name !== 'string' || !name.trim() || name.length > 80) throw Error('Tên tài khoản cần có 1–80 ký tự.');
    const a = { id: randomUUID(), name: name.trim(), messages: [], qr: null, status: 'Đang yêu cầu QR' };
    this.accounts.set(a.id, a);
    try { await this.persist(); } catch (e) { this.accounts.delete(a.id); throw e; }
    this.start(a); return { id: a.id };
  }
  account(id) { const a = this.accounts.get(id); if (!a) throw Error('Không tìm thấy tài khoản.'); return a; }
  async login(id) {
    const a = this.account(id);
    if (a.connecting || a.sending) throw Error('Tài khoản đang xử lý. Hãy đợi hoặc xóa phiên chờ để bắt đầu lại.');
    a.api?.listener.stop(); a.api = null; a.credentials = null; a.qr = null; a.cancelled = false; a.status = 'Đang yêu cầu QR';
    await this.persist(); this.start(a); return { ok: true };
  }
  async remove(id) {
    const a = this.account(id);
    if (a.sending) throw Error('Đang gửi tin; hãy đợi kết quả trước khi xóa.');
    a.cancelled = true; a.abort?.(); a.api?.listener.stop(); this.accounts.delete(id);
    try { await this.persist(); } catch (e) { a.status = 'Đã dừng — chưa xóa khỏi ổ đĩa'; this.accounts.set(id, a); throw e; }
    return { ok: true };
  }
  async send(id, body) {
    const a = this.account(id);
    if (!a.api || a.status !== 'Đã kết nối') throw Error('Tài khoản chưa kết nối.');
    if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) throw Error('Tin nhắn cần có 1–2000 ký tự.');
    const thread = a.messages.find(m => m.threadId === body.threadId && m.type === body.type);
    if (!thread) throw Error('Chỉ gửi trong hội thoại đã nhận.');
    if (a.sending || Date.now() - (a.lastSend || 0) < 3000) throw Error('Chờ 3 giây giữa các lần gửi.');
    a.sending = true;
    try {
      await a.api.sendMessage(body.text.trim(), thread.threadId, thread.type);
      a.lastSend = Date.now();
      a.messages.push({ id: randomUUID(), threadId: thread.threadId, type: thread.type, name: thread.name, self: true, text: body.text.trim(), at: String(Date.now()) });
      a.messages = a.messages.slice(-1000);
      try { await this.persist(); } catch { return { ok: true, warning: this.storageError + ' Tin đã gửi; không gửi lại.' }; }
      return { ok: true };
    } catch { throw Error('Chưa xác định được kết quả gửi. Kiểm tra trên Zalo trước khi thử lại để tránh trùng tin.'); }
    finally { a.sending = false; }
  }
  async stop() {
    clearTimeout(this.saveTimer);
    for (const a of this.accounts.values()) { a.cancelled = true; a.abort?.(); a.api?.listener.stop(); a.qr = null; a.status = 'Đã dừng kết nối'; }
    await this.persist(); this.closed = true; clearTimeout(this.saveTimer);
  }
}
