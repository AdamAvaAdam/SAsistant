import { Zalo, LoginQRCallbackEventType as E } from 'zca-js';
import { attachInbox } from './inbox-sync.mjs';

export async function connect(account, { credentials, onChange = () => {} } = {}) {
  const zalo = new Zalo({ logging: false, checkUpdate: false, selfListen: true });
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
  account.api = api; account.qr = null;
  if (loginInfo && onChange) account.credentials = loginInfo;
  attachInbox(account, api, onChange);
  onChange();
  api.listener.start();
}
