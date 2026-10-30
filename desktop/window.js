'use strict';
const $ = id => document.getElementById(id), api = window.sasistant;
let accounts = [], info = {}, jobs = [], filter = 'all', active = '', selected = '', unreadOnly = false, busy = false, sending = false, changingFolder = false;
let messageStamp = '', listStamp = '', tabsStamp = '', settingsStamp = '', historyNote = '', scheduleTarget;
let recoveryShown = false, recoveryText = '';
const drafts = new Map(), historyAsked = new Set();
function node(tag, text = '', cls = '') { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; }
function error(text = '') { $('error').textContent = text; $('error').hidden = !text; for (const p of document.querySelectorAll('[data-dialog-error]')) { p.textContent = text; p.hidden = !text; } }
function modal(id) { if (!$(id).open) $(id).showModal(); }
function date(value) { const d = new Date(Number(value)); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN'); }
function key(m) { return m.type + ':' + m.threadId; }
function unread(a, m) { return !m.self && m.isLive && Number(m.at) > (a.readAt?.[key(m)] || 0); }
function countUnread(a) { return a.messages.filter(m => unread(a, m)).length; }
function saveDraft() { if (active && selected) drafts.set(active + ':' + selected, $('text').value); }
function current() { const a = accounts.find(a => a.id === active), m = a?.messages.find(m => key(m) === selected); return { a, m }; }
function choose(accountId, threadKey) {
  saveDraft(); active = accountId; selected = threadKey; $('text').value = drafts.get(active + ':' + selected) || ''; historyNote = ''; messageStamp = ''; render();
  const { a, m } = current(), token = active + ':' + selected;
  if (a && m?.type === 1 && !historyAsked.has(token)) { historyAsked.add(token); loadHistory(false); }
}
function setFilter(id) {
  if (id !== 'all' && active !== id) { saveDraft(); active = id; selected = ''; $('text').value = ''; messageStamp = ''; historyNote = ''; }
  filter = id; listStamp = ''; tabsStamp = ''; render();
}
function renderTabs() {
  const stamp = JSON.stringify(accounts.map(a => [a.id, a.name, a.status, countUnread(a)])) + filter;
  if (stamp === tabsStamp) return; tabsStamp = stamp; $('accountTabs').replaceChildren();
  const add = (id, name, count, online) => { const b = node('button', '', 'account-tab' + (filter === id ? ' active' : '')); if (id !== 'all') b.append(node('span', '', 'status-dot' + (online ? ' online' : ''))); b.append(node('span', name)); if (count) b.append(node('span', String(count), 'badge')); b.onclick = () => setFilter(id); $('accountTabs').append(b); };
  add('all', 'Tất cả', accounts.reduce((sum, a) => sum + countUnread(a), 0), true);
  for (const a of accounts) add(a.id, a.name, countUnread(a), a.status === 'Đã kết nối');
}
function threadList() {
  const items = [];
  for (const a of accounts) {
    if (filter !== 'all' && filter !== a.id) continue;
    const map = new Map();
    for (const m of a.messages) { const k = key(m), item = map.get(k) || { a, last: m, unread: 0, search: '' }; item.last = m; item.unread += unread(a, m) ? 1 : 0; item.search += ' ' + m.sender + ' ' + m.text.slice(0, 300); map.set(k, item); }
    items.push(...map.values());
  }
  return items.sort((a, b) => Number(b.last.at) - Number(a.last.at));
}
function renderList() {
  const all = threadList(), query = $('search').value.toLowerCase();
  const items = all.filter(t => (!unreadOnly || t.unread) && (t.last.name + t.a.name + t.search).toLowerCase().includes(query));
  $('threadCount').textContent = String(items.length); $('unreadCount').textContent = String(all.filter(t => t.unread).length || '');
  $('allFilter').classList.toggle('selected', !unreadOnly); $('unreadFilter').classList.toggle('selected', unreadOnly);
  const stamp = JSON.stringify(items.map(t => [t.a.id, t.last.id, t.last.name, t.last.text, t.last.at, t.unread])) + active + selected;
  if (stamp === listStamp) return; listStamp = stamp;
  const scroll = $('threads').scrollTop; $('threads').replaceChildren();
  for (const t of items) {
    const m = t.last, b = node('button', '', 'thread-item' + (t.a.id === active && selected === key(m) ? ' active' : '') + (t.unread ? ' unread' : ''));
    b.append(node('span', m.name.slice(0, 1).toUpperCase(), 'avatar' + (m.type === 1 ? ' group' : '')));
    const copy = node('span', '', 'thread-copy');
    const preview = m.text || ({ image: 'Hình ảnh', video: 'Video', audio: 'Tin thoại', file: 'Tệp đính kèm', link: 'Liên kết' }[m.attachments?.[0]?.type] || 'Đa phương tiện');
    copy.append(node('strong', m.name), node('small', (m.self ? 'Bạn: ' : m.type === 1 && m.sender ? m.sender + ': ' : '') + preview.slice(0, 100)));
    if (filter === 'all') copy.append(node('small', t.a.name, 'account-label'));
    const side = node('span', '', 'thread-side'), d = new Date(Number(m.at)); side.append(node('time', Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })));
    if (t.unread) side.append(node('span', String(t.unread), 'badge'));
    b.append(copy, side); b.onclick = () => choose(t.a.id, key(m)); $('threads').append(b);
  }
  if (!items.length) { const empty = node('div', '', 'empty'); empty.append(node('p', unreadOnly ? 'Không có hội thoại chưa đọc.' : 'Chưa có hội thoại phù hợp. Thử tải tin cũ hoặc kiểm tra tài khoản.')); $('threads').append(empty); }
  $('threads').scrollTop = scroll;
}
function mediaRef(a, m, index) { return { accountId: a.id, id: m.id, threadId: m.threadId, type: m.type, index }; }
function mediaURL(ref) { return 'sa-media://asset/?' + new URLSearchParams(Object.entries(ref).map(([k, v]) => [k, String(v)])).toString(); }
function renderAttachment(a, m, item, index) {
  const box = node('div', '', 'attachment'), ref = mediaRef(a, m, index), url = mediaURL(ref);
  if (item.type === 'link') { const b = node('button', item.name || 'Mở liên kết', 'quiet'); b.onclick = () => api.openLink(item.url).catch(e => error(e.message)); box.append(b); return box; }
  if (['image', 'video', 'audio'].includes(item.type)) {
    const media = document.createElement(item.type === 'image' ? 'img' : item.type);
    if (item.type === 'image') { media.alt = item.name || 'Ảnh trong hội thoại'; media.loading = 'lazy'; media.onclick = () => { const img = document.createElement('img'); img.src = url; img.alt = media.alt; $('mediaPreview').replaceChildren(img); modal('mediaDialog'); }; }
    else { media.controls = true; media.preload = 'metadata'; }
    media.src = url;
    media.addEventListener(item.type === 'image' ? 'load' : 'loadedmetadata', () => { const pane = $('messages'); if (pane.scrollHeight - pane.scrollTop - pane.clientHeight < 400) pane.scrollTop = pane.scrollHeight; }, { once: true });
    media.onerror = () => { if (!box.querySelector('.media-error')) box.append(node('p', 'Không xem trước được: tệp có thể hết hạn hoặc định dạng chưa hỗ trợ.', 'media-error')); };
    box.append(media);
  } else box.append(node('div', '▤ ' + (item.name || 'Tệp đính kèm')));
  const download = node('button', '↓ Lưu ' + (item.type === 'file' ? item.name : 'tệp'), 'quiet');
  download.onclick = async () => { download.disabled = true; try { await api.saveFile(ref); } catch (e) { error(e.message); } finally { download.disabled = false; } }; box.append(download); return box;
}
function renderChat() {
  const { a, m } = current();
  $('title').textContent = m?.name || 'Một nơi cho mọi cuộc trò chuyện'; $('avatar').textContent = m?.name.slice(0, 1).toUpperCase() || 'S';
  $('chatSubtitle').textContent = a && m ? a.name + ' · ' + a.status + (m.type === 1 ? ' · Nhóm' : '') : 'Chọn hội thoại bên trái để xem và trả lời.';
  $('sendAs').textContent = a && m ? 'Gửi bằng tài khoản ' + a.name : 'Chọn hội thoại để bắt đầu';
  $('historyNote').textContent = historyNote; $('historyNote').hidden = !historyNote;
  $('threadHistory').disabled = !m || a?.status !== 'Đã kết nối'; $('scheduleButton').disabled = !m || changingFolder; $('text').disabled = !m || changingFolder;
  $('sendButton').disabled = sending || changingFolder || !m || a?.status !== 'Đã kết nối';
  const messages = (a?.messages || []).filter(x => key(x) === selected), stamp = active + selected + JSON.stringify(messages);
  if (stamp !== messageStamp) {
    const previous = messageStamp, pane = $('messages'), bottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80, scroll = pane.scrollTop;
    messageStamp = stamp;
    if (!m) pane.replaceChildren();
    else pane.querySelector('.empty')?.remove();
    const desired = new Set();
    if (!m) {
      const empty = node('div', '', 'empty'); empty.append(node('span', '◌', 'empty-symbol'), node('h3', 'Không gian trò chuyện của bạn'), node('p', 'Đổi tài khoản ngay trên thanh phía trên. Tin chưa đọc luôn có dấu đỏ để bạn không bỏ lỡ.'));
      if (!accounts.length) { const b = node('button', 'Thêm tài khoản Zalo'); b.onclick = () => modal('settingsDialog'); empty.append(b); } pane.append(empty);
    }
    for (const [position, item] of messages.entries()) {
      const identity = a.id + ':' + item.type + ':' + item.threadId + ':' + item.id;
      const itemStamp = JSON.stringify(item); desired.add(identity);
      const existing = [...pane.children].find(n => n.dataset.message === identity);
      if (existing?.dataset.stamp === itemStamp) { if (pane.children[position] !== existing) pane.insertBefore(existing, pane.children[position] || null); continue; }
      const sender = item.self ? 'Bạn' : item.sender || (item.type === 0 ? item.name : '') || item.senderId || 'Người gửi chưa xác định';
      const row = node('div', '', 'message-row' + (item.self ? ' self' : '')), stack = node('div', '', 'message-stack'), bubble = node('div', '', 'message');
      row.append(node('span', sender.slice(0, 1).toUpperCase(), 'avatar')); stack.append(node('div', sender, 'sender-name'));
      if (item.quote?.text) { const quote = node('div', '', 'quote'); quote.append(node('strong', item.quote.sender || 'Tin được trả lời'), node('span', item.quote.text)); bubble.append(quote); }
      if (item.text) bubble.append(node('div', item.text, 'message-text'));
      for (const [index, attachment] of (item.attachments || []).entries()) bubble.append(renderAttachment(a, item, attachment, index));
      bubble.append(node('small', date(item.at), 'message-time')); stack.append(bubble); row.append(stack); row.dataset.message = identity; row.dataset.stamp = itemStamp;
      if (existing) existing.replaceWith(row); else pane.insertBefore(row, pane.children[position] || null);
    }
    if (m) for (const child of [...pane.children]) if (!desired.has(child.dataset.message)) child.remove();
    if (!previous || bottom) pane.scrollTop = pane.scrollHeight; else pane.scrollTop = scroll;
  }
  if (a && m && document.hasFocus() && !document.hidden && $('messages').scrollHeight - $('messages').scrollTop - $('messages').clientHeight < 80) {
    const upto = Math.max(0, ...messages.map(x => Number(x.at) || 0));
    if (upto > (a.readAt?.[selected] || 0)) { a.readAt ||= {}; a.readAt[selected] = upto; api.markRead(a.id, m.threadId, m.type, upto).then(() => { tabsStamp = ''; listStamp = ''; renderTabs(); renderList(); }).catch(e => error(e.message)); }
  }
}
function renderSettings() {
  $('count').textContent = accounts.length + '/6'; $('addButton').disabled = !info.folder || accounts.length >= 6 || changingFolder; $('folder').textContent = info.folder || 'Chưa chọn nơi lưu — hãy chọn thư mục trước khi thêm tài khoản.'; $('chooseFolder').textContent = info.folder ? 'Đổi thư mục…' : 'Chọn thư mục…';
  const stamp = JSON.stringify(accounts.map(a => [a.id, a.name, a.status, a.connecting]));
  if (stamp !== settingsStamp) {
    settingsStamp = stamp; $('accounts').replaceChildren();
    for (const a of accounts) {
      const box = node('div', '', 'account-card'); box.append(node('strong', a.name), node('p', a.status));
      const actions = node('div', '', 'account-actions');
      for (const [title, method] of [['Kết nối lại', 'reconnect'], ['QR mới', 'login'], ['Xóa', 'remove']]) { const b = node('button', title, method === 'remove' ? 'remove' : ''); b.disabled = a.connecting && method !== 'remove'; b.onclick = async () => { try { error(); await api[method](a.id); await refresh(); } catch (e) { error(e.message); } }; actions.append(b); }
      box.append(actions); $('accounts').append(box);
    }
  }
  const qr = accounts.find(a => a.qr); $('qrArea').hidden = !qr; if (qr) $('qr').src = 'data:image/png;base64,' + qr.qr; else $('qr').removeAttribute('src'); $('qrStatus').textContent = qr?.name || '';
}
const states = { pending: 'Đang chờ', sending: 'Đang gửi', sent: 'Đã gửi', cancelled: 'Đã hủy', missed: 'Quá giờ', failed: 'Lỗi', uncertain: 'Cần kiểm tra' };
function renderJobs() {
  $('scheduleCount').textContent = jobs.filter(j => j.status === 'pending').length || '';
  if (!$('schedulesDialog').open) return;
  $('scheduleList').replaceChildren();
  for (const job of [...jobs].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || a.dueAt - b.dueAt)) {
    const box = node('div', '', 'job'), head = node('div', '', 'job-head'); head.append(node('strong', job.name), node('span', states[job.status] || job.status, 'job-status ' + job.status));
    box.append(head, node('small', job.accountName + ' · ' + date(job.dueAt)), node('p', job.text), node('small', job.note));
    if (job.status === 'pending') { const cancel = node('button', 'Hủy lịch', 'quiet'); cancel.onclick = async () => { try { await api.cancelSchedule(job.id); await refresh(); } catch (e) { error(e.message); } }; box.append(cancel); }
    $('scheduleList').append(box);
  }
  if (!jobs.length) $('scheduleList').append(node('p', 'Chưa có lịch gửi. Chọn hội thoại rồi bấm Hẹn giờ.', 'hint'));
}
function render() {
  $('version').textContent = 'v' + (info.version || '0.4.1'); renderTabs(); renderList(); renderChat(); renderSettings(); renderJobs();
  const visibleAccounts = accounts.filter(a => filter === 'all' || a.id === filter);
  $('syncStatus').textContent = filter === 'all' ? visibleAccounts.filter(a => a.status === 'Đã kết nối').length + '/' + accounts.length + ' tài khoản đang kết nối · Lịch sử tùy dữ liệu Zalo trả về' : visibleAccounts[0]?.syncStatus || visibleAccounts[0]?.status || '';
  $('syncHistory').disabled = !visibleAccounts.some(a => a.status === 'Đã kết nối');
}
async function refresh() {
  if (busy || changingFolder) return; busy = true;
  try { const [list, details] = await Promise.all([api.list(), api.info()]); accounts = list; info = details; jobs = info.folder ? await api.schedules() : []; if (active && !accounts.some(a => a.id === active)) { active = ''; selected = ''; } if (info.storageError) error(info.storageError); else if (info.notice) { recoveryText = info.notice; error(info.notice); if (!recoveryShown) { modal('settingsDialog'); recoveryShown = true; } } else if (recoveryText && $('error').textContent === recoveryText) { error(); recoveryText = ''; } render(); }
  catch (e) { error(e.message); } finally { busy = false; }
}
async function loadHistory(manual) {
  const { a, m } = current(); if (!a || !m) return;
  try { historyNote = 'Đang yêu cầu thêm nội dung hội thoại…'; renderChat(); await api.threadHistory(a.id, m.threadId, m.type); historyNote = ''; await refresh(); }
  catch (e) { historyNote = e.message; renderChat(); if (manual) error(e.message); }
}
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => $(b.dataset.close).close();
$('settings').onclick = $('storageSettings').onclick = () => modal('settingsDialog');
$('showSchedules').onclick = () => { modal('schedulesDialog'); renderJobs(); };
$('search').oninput = () => { listStamp = ''; renderList(); };
$('allFilter').onclick = () => { unreadOnly = false; listStamp = ''; renderList(); };
$('unreadFilter').onclick = () => { unreadOnly = true; listStamp = ''; renderList(); };
$('chooseFolder').onclick = async () => {
  if (changingFolder || sending) return; changingFolder = true;
  try { error(); const next = await api.chooseFolder(); if (next.folder !== info.folder) { active = ''; selected = ''; filter = 'all'; drafts.clear(); historyAsked.clear(); $('text').value = ''; messageStamp = ''; } info = next; }
  catch (e) { error(e.message); } finally { changingFolder = false; await refresh(); }
};
$('add').onsubmit = async e => { e.preventDefault(); $('addButton').disabled = true; try { error(); await api.add($('name').value); $('name').value = ''; await refresh(); } catch (e) { error(e.message); renderSettings(); } };
$('syncHistory').onclick = async () => { try { error(); for (const a of accounts.filter(a => (filter === 'all' || filter === a.id) && a.status === 'Đã kết nối')) await api.sync(a.id); await refresh(); } catch (e) { error(e.message); } };
$('threadHistory').onclick = () => loadHistory(true);
$('text').oninput = saveDraft;
$('text').onkeydown = e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); $('send').requestSubmit(); } };
$('messages').onscroll = () => { const {a,m}=current(); if(a&&m)renderChat(); };
$('send').onsubmit = async e => {
  e.preventDefault(); if (sending) return; const { a, m } = current(); if (!a || !m) return;
  const text = $('text').value, draftKey = active + ':' + selected; sending = true; renderChat();
  try { error(); const result = await api.send(a.id, { threadId: m.threadId, type: m.type, text }); if (drafts.get(draftKey) === text) { drafts.delete(draftKey); if (active + ':' + selected === draftKey) $('text').value = ''; } if (result.warning) error(result.warning); await refresh(); }
  catch (e) { error(e.message); } finally { sending = false; renderChat(); }
};
function setTime(minutes) { const d = new Date(Date.now() + minutes * 60000); d.setSeconds(0, 0); $('dueAt').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
$('scheduleButton').onclick = () => { const { a, m } = current(); if (!a || !m) return; scheduleTarget = { accountId: a.id, threadId: m.threadId, type: m.type }; $('scheduleTarget').textContent = m.name + ' · Gửi bằng ' + a.name; $('scheduleText').value = $('text').value; setTime(10); modal('scheduleDialog'); };
for (const b of document.querySelectorAll('[data-delay]')) b.onclick = () => setTime(Number(b.dataset.delay));
$('scheduleForm').onsubmit = async e => { e.preventDefault(); if (!scheduleTarget) return; $('confirmSchedule').disabled = true; try { error(); await api.schedule(scheduleTarget.accountId, { threadId: scheduleTarget.threadId, type: scheduleTarget.type, text: $('scheduleText').value, dueAt: new Date($('dueAt').value).getTime() }); $('scheduleDialog').close(); modal('schedulesDialog'); await refresh(); } catch (e) { error(e.message); } finally { $('confirmSchedule').disabled = false; } };
setInterval(refresh, 2000); window.addEventListener('focus', () => renderChat()); refresh();
