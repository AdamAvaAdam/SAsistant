// API contracts verified against zca-js 2.2.0 src/apis/listen.ts.
export function attachInbox(account, api, onChange = () => {}, { timeoutMs = 20000 } = {}) {
  let disposed = false, ready = false, channelTimer;
  const pending = new Set(), cursors = new Map(), exhausted = new Set(), timers = new Map();
  const current = () => !disposed && !account.cancelled && account.api === api;
  const notify = () => { if (current()) onChange(); };
  const clearRequest = type => { clearTimeout(timers.get(type)); timers.delete(type); pending.delete(type); };
  function merge(messages) {
    const combined = new Map(account.messages.map(m => [m.type + ':' + m.threadId + ':' + m.id, m]));
    const names = new Map(account.messages.filter(m => m.type === 0 && !m.self).map(m => [m.threadId, m.name]));
    for (const message of messages) {
      const d = message?.data;
      if (!d || ![0, 1].includes(message.type) || !message.threadId || d.msgId == null) continue;
      const threadId = String(message.threadId).slice(0, 200), self = !!message.isSelf;
      const sender = String(d.dName || '').slice(0, 200);
      if (message.type === 0 && !self && sender) names.set(threadId, sender);
      const item = { id: String(d.msgId).slice(0, 200), threadId, type: message.type, self,
        name: message.type === 1 ? 'Nhóm ' + threadId : names.get(threadId) || threadId,
        sender, text: typeof d.content === 'string' ? d.content.slice(0, 2000) : '[Tin đa phương tiện: mở Zalo để xem]', at: String(d.ts || '0') };
      combined.set(item.type + ':' + item.threadId + ':' + item.id, item);
    }
    account.messages = [...combined.values()].map(m => m.type === 0 && names.has(m.threadId) ? { ...m, name: names.get(m.threadId) } : m)
      .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0)).slice(-1000);
  }
  function requestHistory(more = false) {
    if (!current() || !ready) throw Error('Kênh tin nhắn chưa sẵn sàng. Hãy đợi hoặc kết nối lại.');
    if (pending.size) throw Error('Đang tải tin cũ; hãy đợi kết quả.');
    if (account.messages.length >= 1000 && more) throw Error('Đã đạt giới hạn 1.000 tin gần nhất của tài khoản.');
    const types = [0, 1].filter(type => !more || !exhausted.has(type));
    if (!types.length) { account.syncStatus = 'Zalo không trả thêm tin cũ cho phiên này.'; notify(); return { ok: true }; }
    account.syncStatus = 'Đang yêu cầu tin cũ từ Zalo…';
    for (const type of types) {
      pending.add(type);
      timers.set(type, setTimeout(() => {
        if (!current()) return;
        clearRequest(type); account.syncStatus = 'Zalo chưa trả đủ tin cũ. Có thể thử Tải tin cũ lần nữa; app vẫn nhận tin mới.'; notify();
      }, timeoutMs));
      timers.get(type).unref?.();
      try { api.listener.requestOldMessages(type, more ? cursors.get(type) || null : null); }
      catch { clearRequest(type); account.syncStatus = 'Không yêu cầu được tin cũ. Hãy thử lại sau.'; }
    }
    notify(); return { ok: true };
  }
  api.listener.on('message', message => { if (current()) { merge([message]); notify(); } });
  api.listener.on('old_messages', (messages, type) => {
    if (!current() || !Array.isArray(messages) || ![0, 1].includes(type)) return;
    clearRequest(type);
    const oldest = [...messages].filter(m => m?.data?.msgId != null).sort((a, b) => (Number(a.data.ts) || 0) - (Number(b.data.ts) || 0))[0];
    if (oldest) {
      const cursor = String(oldest.data.msgId);
      if (cursors.get(type) === cursor) exhausted.add(type);
      cursors.set(type, cursor);
    } else exhausted.add(type);
    merge(messages);
    account.syncStatus = pending.size ? 'Đã nhận một phần tin cũ; đang đợi phần còn lại…' : `Đã nhận dữ liệu Zalo · đang giữ ${account.messages.length} tin. Lịch sử có thể chưa đầy đủ.`;
    notify();
  });
  api.listener.on('connected', () => { if (current()) { account.status = 'Đang xác thực kênh tin nhắn'; notify(); } });
  api.listener.on('cipher_key', () => {
    if (!current()) return;
    clearTimeout(channelTimer); ready = true; account.status = 'Đã kết nối';
    if (!account.syncHistory) return;
    try { requestHistory(false); } catch { /* A request can already be in flight. */ }
    notify();
  });
  const unavailable = status => {
    if (!current()) return;
    ready = false; clearTimeout(channelTimer);
    for (const type of [...pending]) clearRequest(type);
    account.status = status; account.syncStatus = 'Kênh tin nhắn chưa hoạt động; bấm Kết nối lại.'; notify();
  };
  api.listener.on('disconnected', code => unavailable(code === 3000 ? 'Phiên bị ngắt do có kết nối khác' : 'Đã mất kênh tin nhắn'));
  api.listener.on('closed', code => unavailable(code === 3000 ? 'Phiên bị ngắt do có kết nối khác' : 'Đã ngắt kết nối'));
  api.listener.on('error', () => unavailable('Lỗi kênh tin nhắn'));
  account.syncHistory = requestHistory;
  account.disposeInbox = () => {
    disposed = true; clearTimeout(channelTimer); for (const type of [...pending]) clearRequest(type);
  };
  account.status = 'Đang mở kênh tin nhắn'; account.syncStatus = 'Chờ kênh tin nhắn sẵn sàng…';
  channelTimer = setTimeout(() => unavailable('Chưa mở được kênh tin nhắn'), timeoutMs); channelTimer.unref?.();
  return { requestHistory, dispose: account.disposeInbox };
}
