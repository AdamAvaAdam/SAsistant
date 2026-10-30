import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import path from 'node:path';

// The data key travels with the file, wrapped for the current Windows user by DPAPI.
// It does not depend on Chromium's Local State or any transient Electron profile.
const MAGIC = Buffer.from('SASDP2\0');
const helper = `$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;$request=[Console]::In.ReadToEnd()|ConvertFrom-Json;$bytes=[Convert]::FromBase64String($request.data);if($request.op -eq 'protect'){$out=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)}elseif($request.op -eq 'unprotect'){$out=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)}else{throw 'Unsupported operation'};[Console]::Out.Write([Convert]::ToBase64String($out));[Array]::Clear($bytes,0,$bytes.Length)`;
function dpapi(op, data) {
  return new Promise((resolve, reject) => {
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const child = spawn(exe, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(helper, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', failed = false;
    const timeout = setTimeout(() => { failed = true; child.kill(); reject(Error('Windows chưa mở được khóa mã hóa.')); }, 15000);
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 100000) { failed = true; child.kill(); } });
    child.stderr.on('data', () => {}); // Do not log key material or OS diagnostics containing private paths.
    child.on('error', () => { clearTimeout(timeout); reject(Error('Không chạy được cơ chế bảo vệ dữ liệu Windows.')); });
    child.on('close', code => { clearTimeout(timeout); if (code !== 0 || failed || !/^[A-Za-z0-9+/=\s]+$/.test(output)) return reject(Error('Không giải mã được khóa theo tài khoản Windows này.')); resolve(Buffer.from(output.trim(), 'base64')); });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ op, data: data.toString('base64') }));
  });
}
export function createWindowsCipher({ legacyDecrypt } = {}) {
  let key, wrapped, initializing;
  async function initialize() {
    if (key && wrapped) return;
    if (!initializing) initializing = (async () => { const fresh = randomBytes(32), protectedKey = await dpapi('protect', fresh); key = fresh; wrapped = protectedKey; })();
    try { await initializing; } catch (e) { initializing = null; throw e; }
  }
  return {
    async encrypt(text) {
      await initialize();
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]), size = Buffer.alloc(4); size.writeUInt32BE(wrapped.length);
      return Buffer.concat([MAGIC, size, wrapped, nonce, cipher.getAuthTag(), encrypted]);
    },
    async decrypt(buffer) {
      if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
        if (!legacyDecrypt) throw Error('Kho cũ cần bộ giải mã tương thích.');
        return legacyDecrypt(buffer);
      }
      const length = buffer.readUInt32BE(MAGIC.length), start = MAGIC.length + 4;
      if (length < 16 || length > 65536 || buffer.length < start + length + 28) throw Error('Kho mã hóa không hợp lệ.');
      const found = buffer.subarray(start, start + length);
      if (!wrapped?.equals(found) || !key) { const recovered = await dpapi('unprotect', found); if (recovered.length !== 32) throw Error('Khóa không hợp lệ.'); key = recovered; wrapped = Buffer.from(found); }
      const offset = start + length, cipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(offset, offset + 12)); cipher.setAuthTag(buffer.subarray(offset + 12, offset + 28));
      return Buffer.concat([cipher.update(buffer.subarray(offset + 28)), cipher.final()]).toString('utf8');
    },
  };
}
