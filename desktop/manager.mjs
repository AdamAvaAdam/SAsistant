import { randomUUID } from 'node:crypto';
import { validateSnapshot } from './storage.mjs';
import { MAX_MESSAGES } from '../connector/content.mjs';

export class AccountManager {
  constructor({ connect, store, now = () => Date.now() }) { this.connect = connect; this.store = store; this.now = now; this.accounts = new Map(); this.schedules = []; this.storageError = ''; this.closed = false; }
  snapshot() {
    return { version: 1, schedules: this.schedules, accounts: [...this.accounts.values()].map(a => ({ id: a.id, name: a.name, messages: a.messages, readAt: a.readAt || {}, ...(a.credentials ? { credentials: a.credentials } : {}) })) };
  }
  list() { return [...this.accounts.values()].map(a => ({ id: a.id, name: a.name, status: a.status, syncStatus: a.syncStatus || '', qr: a.qr, messages: a.messages, readAt: a.readAt || {}, connecting: !!a.connecting })); }
  async persist() {
    if (this.closed) return;
    try { await this.store.write(this.snapshot()); this.storageError = ''; }
    catch { this.storageError = 'Chưa lưu được dữ liệu. Kiểm tra dung lượng và quyền ghi thư mục; đừng tắt ứng dụng trước khi xử lý.'; throw Error(this.storageError); }
  }
  changed() {
    if (this.closed) return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.persist().catch(() => {}); }, 500);
  }
  async load() {
    const data = validateSnapshot(await this.store.read());
    this.schedules = (data.schedules || []).map(j => j.status === 'sending' ? { ...j, status: 'uncertain', note: 'Ứng dụng dừng trong lúc gửi. Kiểm tra trên Zalo; không tự gửi lại.' } : j);
    for (const a of data.accounts) this.accounts.set(a.id, { ...a, qr: null, status: a.credentials ? 'Đang khôi phục phiên' : 'Cần đăng nhập QR' });
  }
  restore() { for (const a of this.accounts.values()) if (a.credentials) this.start(a); this.scheduler = setInterval(() => this.runDue().catch(() => {}), 1000); this.scheduler.unref?.(); }
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
  async reconnect(id) {
    const a = this.account(id);
    if (a.connecting || a.sending) throw Error('Tài khoản đang xử lý; hãy đợi kết quả.');
    a.disposeInbox?.(); a.api?.listener.stop(); a.api = null; a.cancelled = false; a.qr = null;
    a.status = 'Đang kết nối lại'; this.start(a); return { ok: true };
  }
  sync(id) {
    const a = this.account(id);
    if (a.status !== 'Đã kết nối' || !a.syncHistory) throw Error('Tài khoản chưa mở được kênh tin nhắn.');
    return a.syncHistory(true);
  }
  threadHistory(id, threadId, type) {
    const a = this.account(id);
    if (!a.messages.some(m => m.threadId === threadId && m.type === type)) throw Error('Không tìm thấy hội thoại.');
    if (!a.loadThreadHistory) throw Error('Kênh tin nhắn chưa sẵn sàng.');
    return a.loadThreadHistory(threadId, type);
  }
  async markRead(id, threadId, type, upto) {
    const a = this.account(id), last = Math.max(0, ...a.messages.filter(m => m.threadId === threadId && m.type === type).map(m => Number(m.at) || 0));
    if (!last || !Number.isFinite(upto)) return;
    const key = type + ':' + threadId, value = Math.min(last, upto);
    a.readAt ||= {};
    if (value > (a.readAt[key] || 0)) { a.readAt[key] = value; await this.persist(); }
  }
  async schedule(id, body) {
    const a = this.account(id), thread = a.messages.find(m => m.threadId === body?.threadId && m.type === body?.type);
    if (!thread || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) throw Error('Chọn hội thoại và nhập 1–2.000 ký tự.');
    const dueAt = Number(body.dueAt);
    if (!Number.isFinite(dueAt) || dueAt < this.now() + 5000 || dueAt > this.now() + 366 * 86400000) throw Error('Chọn thời gian từ 5 giây đến 1 năm tới.');
    if (this.schedules.length >= 200) this.schedules = this.schedules.filter(j => ['pending', 'sending'].includes(j.status)).concat(this.schedules.filter(j => !['pending', 'sending'].includes(j.status)).slice(-100));
    if (this.schedules.length >= 200) throw Error('Tối đa 200 lịch gửi.');
    const job = { id: randomUUID(), accountId: id, accountName: a.name, threadId: thread.threadId, type: thread.type, name: thread.name, text: body.text.trim(), dueAt, status: 'pending', note: 'Chờ đến giờ; ứng dụng cần mở và tài khoản cần kết nối.' };
    this.schedules.push(job);
    try { await this.persist(); } catch (e) { this.schedules = this.schedules.filter(j => j !== job); throw e; }
    return job;
  }
  async cancelSchedule(id) {
    const job = this.schedules.find(j => j.id === id);
    if (!job || job.status !== 'pending') throw Error('Chỉ hủy được lịch đang chờ.');
    job.status = 'cancelled'; job.note = 'Đã hủy'; await this.persist(); return { ok: true };
  }
  runDue() {
    if (this.scheduleRun || this.closed || this.stopping) return this.scheduleRun || Promise.resolve();
    this.scheduleRun = this.processDue().finally(() => { this.scheduleRun = null; }); return this.scheduleRun;
  }
  async processDue() {
    for (const job of this.schedules.filter(j => j.status === 'pending' && j.dueAt <= this.now()).sort((a, b) => a.dueAt - b.dueAt)) {
      if (this.stopping || this.closed) return;
      if (this.now() - job.dueAt > 10 * 60000) { job.status = 'missed'; job.note = 'Quá giờ hơn 10 phút; không tự gửi muộn.'; await this.persist(); continue; }
      const a = this.accounts.get(job.accountId);
      if (!a) { job.status = 'cancelled'; job.note = 'Tài khoản đã bị xóa'; await this.persist(); continue; }
      if (a.status !== 'Đã kết nối' || a.sending || this.now() - (a.lastSend || 0) < 3000) { job.note = 'Đến giờ — đang chờ tài khoản sẵn sàng, tối đa 10 phút.'; continue; }
      job.status = 'sending'; job.note = 'Đang gửi';
      try { await this.persist(); } catch { job.status = 'failed'; job.note = 'Không ghi được trạng thái; chưa gửi tin.'; return; }
      if (this.stopping) { job.status = 'pending'; await this.persist(); return; }
      try {
        const result = await this.send(job.accountId, { threadId: job.threadId, type: job.type, text: job.text }, job);
        job.status = 'sent'; job.sentAt = this.now(); job.note = result.warning || 'Đã gửi theo phản hồi Zalo';
      } catch (e) { job.status = 'uncertain'; job.note = e.message; }
      await this.persist();
    }
  }
  async login(id) {
    const a = this.account(id);
    if (a.connecting || a.sending) throw Error('Tài khoản đang xử lý. Hãy đợi hoặc xóa phiên chờ để bắt đầu lại.');
    a.disposeInbox?.(); a.api?.listener.stop(); a.api = null; a.credentials = null; a.qr = null; a.cancelled = false; a.status = 'Đang yêu cầu QR';
    await this.persist(); this.start(a); return { ok: true };
  }
  async remove(id) {
    const a = this.account(id);
    if (a.sending) throw Error('Đang gửi tin; hãy đợi kết quả trước khi xóa.');
    a.cancelled = true; a.disposeInbox?.(); a.abort?.(); a.api?.listener.stop(); this.accounts.delete(id);
    try { await this.persist(); } catch (e) { a.status = 'Đã dừng — chưa xóa khỏi ổ đĩa'; this.accounts.set(id, a); throw e; }
    return { ok: true };
  }
  async send(id, body, scheduledTarget) {
    const a = this.account(id);
    if (!a.api || a.status !== 'Đã kết nối') throw Error('Tài khoản chưa kết nối.');
    if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) throw Error('Tin nhắn cần có 1–2000 ký tự.');
    const thread = a.messages.find(m => m.threadId === body.threadId && m.type === body.type) || scheduledTarget;
    if (!thread) throw Error('Chỉ gửi trong hội thoại đã nhận.');
    if (a.sending || this.now() - (a.lastSend || 0) < 3000) throw Error('Chờ 3 giây giữa các lần gửi.');
    a.sending = true;
    try {
      const result = await a.api.sendMessage(body.text.trim(), thread.threadId, thread.type);
      a.lastSend = this.now();
      const id = String(result?.message?.msgId || randomUUID());
      if (!a.messages.some(m => m.id === id && m.threadId === thread.threadId && m.type === thread.type)) a.messages.push({ id, threadId: thread.threadId, type: thread.type, name: thread.name, self: true, text: body.text.trim(), at: String(Date.now()) });
      a.messages = a.messages.slice(-MAX_MESSAGES);
      try { await this.persist(); } catch { return { ok: true, warning: this.storageError + ' Tin đã gửi; không gửi lại.' }; }
      return { ok: true };
    } catch { throw Error('Chưa xác định được kết quả gửi. Kiểm tra trên Zalo trước khi thử lại để tránh trùng tin.'); }
    finally { a.sending = false; }
  }
  async stop() {
    this.stopping = true; clearInterval(this.scheduler); await this.scheduleRun;
    clearTimeout(this.saveTimer);
    for (const a of this.accounts.values()) { a.cancelled = true; a.disposeInbox?.(); a.abort?.(); a.api?.listener.stop(); a.qr = null; a.status = 'Đã dừng kết nối'; }
    await this.persist(); this.closed = true; clearTimeout(this.saveTimer);
  }
}
