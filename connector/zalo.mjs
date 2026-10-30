import { Zalo, LoginQRCallbackEventType as E } from 'zca-js';

export async function connect(account) {
  const zalo = new Zalo({ logging: false, checkUpdate: false, selfListen: false });
  const api = await zalo.loginQR({}, event => {
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
    // GotLoginInfo contains credentials: deliberately never serialize or log it.
  });
  if (account.cancelled) { api.listener.stop(); return; }
  account.api = api; account.qr = null; account.status = 'Đã kết nối';
  api.listener.on('message', message => {
    if (account.cancelled) return;
    const d = message.data;
    const item = { id: String(d.msgId), threadId: String(message.threadId), type: message.type,
      name: String(d.dName || message.threadId), self: message.isSelf,
      text: typeof d.content === 'string' ? d.content : '[Tin đa phương tiện: mở Zalo để xem]', at: String(d.ts) };
    if (!account.messages.some(m => m.id === item.id && m.threadId === item.threadId)) account.messages.push(item);
    account.messages = account.messages.slice(-1000);
  });
  api.listener.on('error', () => { account.status = 'Lỗi kết nối; cần kết nối lại'; });
  api.listener.on('closed', () => { account.status = 'Đã ngắt kết nối'; });
  api.listener.start();
}
