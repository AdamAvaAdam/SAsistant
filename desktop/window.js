'use strict';
const $ = id => document.getElementById(id);
const api = window.sasistant;
let accounts = [], active = '', selected = '', info = {}, busy = false, sending = false, changingFolder = false;
let storageOpen = false;
const drafts = new Map(); let rendered = '', lastMessages = '';
function error(message = '') { $('error').textContent = message; $('error').hidden = !message; }
function node(tag, text, className) { const n = document.createElement(tag); if (text) n.textContent = text; if (className) n.className = className; return n; }
function saveDraft() { if (active && selected) drafts.set(active + ':' + selected, $('text').value); }
function select(account, thread = '') { saveDraft(); active = account; selected = thread; $('text').value = drafts.get(active + ':' + selected) || ''; render(); }
function render() {
  const showStorage = !info.folder || storageOpen;
  $('storagePanel').hidden = !showStorage;
  $('storageSettings').setAttribute('aria-expanded', String(showStorage));
  $('hideStorage').hidden = !info.folder;
  $('folder').textContent = info.folder || 'Ông có thể chọn một thư mục riêng trên máy tính.';
  $('storageTitle').textContent = info.folder ? 'Thư mục dữ liệu đang sử dụng' : 'Chọn nơi lưu dữ liệu để bắt đầu';
  $('chooseFolder').textContent = info.folder ? 'Đổi thư mục…' : 'Chọn thư mục lưu trữ';
  $('chooseFolder').disabled = changingFolder || sending;
  $('version').textContent = 'Windows · v' + (info.version || '0.3.1'); $('welcome').hidden = !!info.folder;
  $('count').textContent = accounts.length + ' / 6'; $('addButton').disabled = !info.folder || accounts.length >= 6 || changingFolder;
  const accountKey = JSON.stringify(accounts.map(({ id, name, status, connecting }) => ({ id, name, status, connecting }))) + active;
  if (rendered !== accountKey) {
    rendered = accountKey; $('accounts').replaceChildren();
    for (const a of accounts) {
      const box = node('div', '', 'account-card' + (a.id === active ? ' active' : ''));
      const b = node('button', a.name, 'account-select'); b.append(node('small', a.status)); b.onclick = () => select(a.id);
      const actions = node('div', '', 'account-actions');
      const login = node('button', 'Đăng nhập lại', 'small'); login.disabled = a.connecting;
      login.onclick = async () => { try { error(); await api.login(a.id); await refresh(); } catch (e) { error(e.message); } };
      const remove = node('button', 'Xóa', 'small remove');
      remove.onclick = async () => { try { await api.remove(a.id); await refresh(); } catch (e) { error(e.message); } };
      actions.append(login, remove); box.append(b, actions); $('accounts').append(box);
    }
  }
  const a = accounts.find(a => a.id === active); $('qrArea').hidden = !a?.qr;
  if (a?.qr) $('qr').src = 'data:image/png;base64,' + a.qr; else $('qr').removeAttribute('src');
  $('qrStatus').textContent = a?.status || '';
  const threads = new Map(); for (const m of a?.messages || []) threads.set(m.type + ':' + m.threadId, m);
  $('threadCount').textContent = String(threads.size); $('threads').replaceChildren(); $('noThreads').hidden = threads.size > 0;
  const query = $('search').value.toLowerCase();
  for (const [key, m] of [...threads].reverse()) {
    if (!(m.name + ' ' + m.threadId).toLowerCase().includes(query)) continue;
    const b = node('button', '', 'thread-item' + (key === selected ? ' active' : ''));
    b.append(node('span', m.name.slice(0, 1).toUpperCase(), 'avatar'));
    const text = node('span', '', 'thread-copy'); text.append(node('strong', m.name + (m.type === 1 ? ' · Nhóm' : '')), node('small', m.text.slice(0, 55))); b.append(text);
    b.onclick = () => select(active, key); $('threads').append(b);
  }
  const thread = threads.get(selected);
  $('title').textContent = thread?.name || 'Chọn một cuộc trò chuyện'; $('avatar').textContent = thread?.name.slice(0, 1).toUpperCase() || 'S';
  $('chatSubtitle').textContent = thread ? a.name + ' · ' + a.status : 'Tin nhắn được lưu trong thư mục ông đã chọn.';
  const messages = (a?.messages || []).filter(m => m.type + ':' + m.threadId === selected);
  const conversation = active + ':' + selected;
  const changedConversation = !lastMessages.startsWith(conversation + '|');
  const messageKey = conversation + '|' + JSON.stringify(messages);
  if (lastMessages !== messageKey) {
    lastMessages = messageKey;
    const pane = $('messages'), nearBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 60;
    pane.replaceChildren();
    if (!thread) { const empty = node('div', '', 'empty'); empty.append(node('span', '☏'), node('h3', 'Hộp thư đang chờ ông'), node('p', 'Thêm tài khoản, nhận tin mới rồi chọn cuộc trò chuyện để trả lời.')); pane.append(empty); }
    for (const m of messages) {
      const b = node('div', m.text, 'message' + (m.self ? ' self' : '')); const date = new Date(Number(m.at));
      b.append(node('small', (m.self ? 'Ông' : m.name) + ' · ' + (Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN')))); pane.append(b);
    }
    if (nearBottom || changedConversation) pane.scrollTop = pane.scrollHeight;
  }
  $('text').disabled = !thread || changingFolder;
  $('sendButton').disabled = sending || changingFolder || !thread || a?.status !== 'Đã kết nối';
}
async function refresh() {
  if (busy || changingFolder) return; busy = true;
  try {
    const data = await api.list(); info = await api.info(); accounts = data;
    if (!accounts.some(a => a.id === active)) select(accounts[0]?.id || '');
    if (info.storageError) error(info.storageError);
    render();
  } catch (e) { error(e.message); } finally { busy = false; }
}
$('storageSettings').onclick = () => { storageOpen = !storageOpen; render(); };
$('hideStorage').onclick = () => { storageOpen = false; render(); $('storageSettings').focus(); };
$('chooseFolder').onclick = async () => {
  if (changingFolder || sending) return; changingFolder = true; render();
  try { error(); const next = await api.chooseFolder(); if (next.folder !== info.folder) { drafts.clear(); active = ''; selected = ''; accounts = []; $('text').value = ''; rendered = ''; storageOpen = false; } info = next; }
  catch (e) { error(e.message); } finally { changingFolder = false; await refresh(); }
};
$('add').onsubmit = async e => { e.preventDefault(); $('addButton').disabled = true; try { error(); const result = await api.add($('name').value); select(result.id); $('name').value = ''; await refresh(); } catch (e) { error(e.message); render(); } };
$('search').oninput = render;
$('text').oninput = saveDraft;
$('send').onsubmit = async e => {
  e.preventDefault(); if (sending) return;
  const a = accounts.find(a => a.id === active); const thread = a?.messages.find(m => m.type + ':' + m.threadId === selected); if (!thread) return;
  const text = $('text').value, accountId = active, draftKey = active + ':' + selected;
  sending = true; render();
  try { error(); const result = await api.send(accountId, { threadId: thread.threadId, type: thread.type, text }); if (drafts.get(draftKey) === text) { drafts.delete(draftKey); if (active + ':' + selected === draftKey) $('text').value = ''; } if (result.warning) error(result.warning); await refresh(); }
  catch (e) { error(e.message); } finally { sending = false; render(); }
};
setInterval(refresh, 2000); refresh();
