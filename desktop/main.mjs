import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, session } from 'electron';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EncryptedStore } from './storage.mjs';
import { AccountManager } from './manager.mjs';
import { connect } from '../connector/zalo.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
if (!app.isPackaged && process.env.SASISTANT_DEV_PROFILE) {
  mkdirSync(path.resolve(process.env.SASISTANT_DEV_PROFILE), { recursive: true });
  app.setPath('userData', path.resolve(process.env.SASISTANT_DEV_PROFILE));
}
const gotLock = app.requestSingleInstanceLock();
let win, manager, folder, closing = false, folderBusy = false;
const windowURL = pathToFileURL(path.join(here, 'window.html')).href;
const cipher = {
  encrypt: text => safeStorage.encryptStringAsync(text),
  decrypt: async buffer => (await safeStorage.decryptStringAsync(buffer)).result,
};
function requireManager() { if (!manager || folderBusy || closing) throw Error('Hãy chọn thư mục lưu trữ trước.'); return manager; }
function secureHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== windowURL) throw Error('Yêu cầu không được phép.');
    try { return { ok: true, data: await handler(...args) }; }
    catch (e) { return { ok: false, error: e.message || 'Thao tác thất bại.' }; }
  });
}
async function openStore(selected) {
  const store = new EncryptedStore(selected, cipher);
  const candidate = new AccountManager({ connect, store });
  await candidate.load();
  // Test write access before accepting a fresh folder. Existing data is never reset on errors.
  await candidate.persist();
  return candidate;
}
function info() { return { version: app.getVersion(), folder: folder || null, storageError: manager?.storageError || '', encrypted: true }; }
async function chooseFolder() {
  if (folderBusy) throw Error('Đang chọn thư mục.');
  folderBusy = true;
  try {
    if (manager && [...manager.accounts.values()].some(a => a.sending)) throw Error('Đang gửi tin; đợi kết quả rồi đổi thư mục.');
    const result = await dialog.showOpenDialog(win, { title: 'Chọn thư mục lưu dữ liệu SAsistant', defaultPath: folder || app.getPath('documents'), properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Dùng thư mục này' });
    if (result.canceled || !result.filePaths[0]) return info();
    const selected = path.resolve(result.filePaths[0]);
    if (folder && selected.toLowerCase() === folder.toLowerCase()) return info();
    const candidate = await openStore(selected);
    await manager?.stop();
    const config = path.join(app.getPath('userData'), 'storage-location.json');
    try {
      await mkdir(path.dirname(config), { recursive: true });
      await writeFile(config + '.tmp', JSON.stringify({ folder: selected }));
      await rename(config + '.tmp', config);
    } catch {
      // Reopen the previous manager if changing its location could not be recorded.
      if (manager) { manager = await openStore(folder); manager.restore(); }
      throw Error('Không lưu được lựa chọn thư mục. Thư mục cũ được giữ lại.');
    }
    manager = candidate; folder = selected; manager.restore(); return info();
  } finally { folderBusy = false; }
}
async function boot() {
  await app.whenReady();
  if (process.platform !== 'win32' || !await safeStorage.isAsyncEncryptionAvailable()) throw Error('Ứng dụng cần Windows có mã hóa tài khoản khả dụng.');
  // Renderer loads local assets only; Zalo network requests stay in the main process.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('data:image/png;base64,') && !details.url.startsWith('devtools:') }));
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1360, height: 900, minWidth: 1000, minHeight: 720, title: 'SAsistant', backgroundColor: '#f2f5fa', show: false,
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  secureHandle('sa:info', info);
  secureHandle('sa:folder', chooseFolder);
  secureHandle('sa:list', () => manager ? manager.list() : []);
  secureHandle('sa:add', name => requireManager().add(name));
  secureHandle('sa:login', id => requireManager().login(id));
  secureHandle('sa:remove', async id => {
    const result = await dialog.showMessageBox(win, { type: 'question', title: 'Xóa tài khoản khỏi SAsistant?', message: 'Xóa phiên và hộp thư của tài khoản này khỏi kho đang mở?', detail: 'Bản lưu dự phòng trước đó có thể còn dữ liệu. Muốn thu hồi phiên bên Zalo, hãy kiểm tra Thiết bị đăng nhập trên điện thoại.', buttons: ['Giữ lại', 'Xóa khỏi ứng dụng'], defaultId: 0, cancelId: 0 });
    if (result.response !== 1) return { cancelled: true };
    return requireManager().remove(id);
  });
  secureHandle('sa:send', (id, body) => requireManager().send(id, body));
  let startupError;
  try {
    const saved = JSON.parse(await readFile(path.join(app.getPath('userData'), 'storage-location.json'), 'utf8'));
    if (typeof saved.folder !== 'string' || !path.isAbsolute(saved.folder)) throw Error('Đường dẫn không hợp lệ.');
    try { if (!(await stat(saved.folder)).isDirectory()) throw Error(); }
    catch { throw Error('Không tìm thấy thư mục dữ liệu đã chọn. Kiểm tra ổ đĩa rồi chọn lại thư mục; ứng dụng không tự tạo kho trống thay thế.'); }
    manager = await openStore(saved.folder); folder = saved.folder; manager.restore();
  } catch (e) { if (e.code !== 'ENOENT') startupError = e.message; }
  await win.loadFile(path.join(here, 'window.html'));
  win.show();
  if (startupError) await dialog.showMessageBox(win, { type: 'error', title: 'Chưa mở được kho dữ liệu', message: startupError, detail: 'Ứng dụng không ghi đè file lỗi. Chọn lại đúng thư mục hoặc khôi phục bản dự phòng.' });
  win.on('close', async event => {
    if (closing) return;
    event.preventDefault();
    if (folderBusy) return;
    if (manager && [...manager.accounts.values()].some(a => a.sending)) {
      await dialog.showMessageBox(win, { type: 'info', message: 'Đang gửi tin. Hãy đợi kết quả trước khi đóng ứng dụng.' }); return;
    }
    closing = true;
    try { await manager?.stop(); win.destroy(); app.quit(); }
    catch (e) { closing = false; await dialog.showMessageBox(win, { type: 'error', message: e.message, detail: 'Dữ liệu chưa lưu. Giữ ứng dụng mở và khôi phục quyền ghi/dung lượng ổ đĩa rồi thử đóng lại.' }); }
  });
}
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.on('window-all-closed', () => app.quit());
  boot().catch(e => { dialog.showErrorBox('Không khởi động được SAsistant', e.message); app.quit(); });
}
