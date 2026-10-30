import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachInbox } from './inbox-sync.mjs';
import { validateSnapshot } from '../desktop/storage.mjs';
const msg = (id, ts, self = false, type = 0, threadId = 'friend') => ({ type, threadId, isSelf: self, data: { msgId: id, ts: String(ts), dName: self ? 'Owner' : 'Customer', content: 'text-' + id } });
function fixture(timeoutMs = 20000) {
  const listener = new EventEmitter(), requests = [];
  listener.requestOldMessages = (...args) => requests.push(args);
  const api = { listener }, account = { id: '12345678-1234-1234-1234-123456789abc', name: 'Fixture', messages: [], api };
  const controller = attachInbox(account, api, () => {}, { timeoutMs });
  return { listener, requests, api, account, controller };
}
test('history requests wait for the real channel handshake; merge direct, group, own and live messages without duplicates', () => {
  const f = fixture();
  try {
    assert.notEqual(f.account.status, 'Đã kết nối');
    f.listener.emit('connected'); assert.notEqual(f.account.status, 'Đã kết nối'); assert.equal(f.requests.length, 0);
    f.listener.emit('cipher_key', 'synthetic-key');
    assert.equal(f.account.status, 'Đã kết nối'); assert.deepEqual(f.requests, [[0, null], [1, null]]);
    f.listener.emit('message', msg('new', 500));
    f.listener.emit('old_messages', [msg('old', 100), msg('sent', 200, true), msg('new', 500)], 0);
    f.listener.emit('old_messages', [msg('old', 150, false, 1, 'group')], 1);
    assert.equal(f.account.messages.length, 4);
    assert.deepEqual(f.account.messages.map(m => m.at), ['100', '150', '200', '500']);
    assert.equal(f.account.messages.find(m => m.id === 'sent').name, 'Customer');
    assert.equal(f.account.messages.find(m => m.id === 'sent').self, true);
    assert.ok(!JSON.stringify(f.account.messages).includes('synthetic-key'));
    assert.doesNotThrow(() => validateSnapshot({ version: 1, accounts: [{ id: f.account.id, name: f.account.name, messages: f.account.messages }] }));
    f.controller.requestHistory(true); assert.deepEqual(f.requests.slice(-2), [[0, 'old'], [1, 'old']]);
    assert.throws(() => f.controller.requestHistory(true), /Đang tải/);
    f.listener.emit('old_messages', [], 0); f.listener.emit('old_messages', [], 1);
    f.controller.requestHistory(true); assert.equal(f.requests.length, 4);
  } finally { f.controller.dispose(); }
});
test('socket timeout and duplicate connection never remain falsely connected', async () => {
  const f = fixture(15);
  try {
    await new Promise(resolve => setTimeout(resolve, 30)); assert.notEqual(f.account.status, 'Đã kết nối');
    f.listener.emit('cipher_key', 'fake'); assert.equal(f.account.status, 'Đã kết nối');
    f.listener.emit('disconnected', 3000); assert.match(f.account.status, /kết nối khác/);
    assert.throws(() => f.controller.requestHistory(), /chưa sẵn sàng/);
  } finally { f.controller.dispose(); }
});
test('no history response reports uncertainty; stale socket messages cannot enter the replacement account', async () => {
  const f = fixture(15);
  try {
    f.listener.emit('cipher_key', 'fake');
    await new Promise(resolve => setTimeout(resolve, 30)); assert.match(f.account.syncStatus, /chưa trả đủ/);
    f.controller.dispose(); f.account.api = {};
    f.listener.emit('message', msg('stale', 100)); f.listener.emit('closed', 3000);
    assert.equal(f.account.messages.length, 0);
  } finally { f.controller.dispose(); }
});
