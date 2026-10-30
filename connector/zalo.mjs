import { Zalo, LoginQRCallbackEventType as E } from 'zca-js';

export async function connect(account, { credentials, onChange = () => {} } = {}) {
  const zalo = new Zalo({ logging: false, checkUpdate: false, selfListen: false });
  let loginInfo;
  const api = credentials ? await zalo.login(credentials) : await zalo.loginQR({}, event => {
    if (account.cancelled) return event.actions?.abort();
    if (event.actions?.abort) account.abort = event.actions.abort;
    if (event.type === E.QRCodeGenerated) {
      account.qr = event.data.image.replace(/^data:image\/png;base64,/, '');
      account.status = 'Chờ quét QR';
    } else if (event.type === E.QRCodeScanned) {
      account.qr = null; account.status = 'Chờ xác nhận trên điện thoại';
    } else if (event.type === E.QRCodeExpired || event.type === E.QRCodeDeclined) {
      account.qr = null; account.status = 'QR hết hạn hoặc bị từ chối';
      event.actions.abort();
    }
    if (event.type === E.GotLoginInfo) loginInfo = event.data;
    // Never log credentials or expose them to the renderer. Desktop encrypts them on disk.
  });
  if (account.cancelled) { api.listener.stop(); return; }
  account.api = api; account.qr = null; account.status = 'Đã kết nối';
  if (loginInfo && onChange) account.credentials = loginInfo;
  onChange();
  api.listener.on('message', message => {
    if (account.cancelled) return;
    const d = message.data;
    const item = { id: String(d.msgId), threadId: String(message.threadId), type: message.type,
      name: String(d.dName || message.threadId).slice(0, 200), self: !!message.isSelf,
      text: typeof d.content === 'string' ? d.content.slice(0, 2000) : '[Tin đa phương tiện: mở Zalo để xem]', at: String(d.ts) };
    if (!account.messages.some(m => m.id === item.id && m.threadId === item.threadId)) account.messages.push(item);
    account.messages = account.messages.slice(-1000);
    onChange();
  });
  api.listener.on('error', () => { if (!account.cancelled && account.api === api) account.status = 'Lỗi kết nối; cần kết nối lại'; });
  api.listener.on('closed', () => { if (!account.cancelled && account.api === api) account.status = 'Đã ngắt kết nối'; });
  api.listener.start();
}
