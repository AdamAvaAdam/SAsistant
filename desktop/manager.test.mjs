import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountManager } from './manager.mjs';
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let saved = { version: 1, accounts: [] }, sent = 0, fail = false, connects = 0;
  const store = { read: async () => structuredClone(saved), write: async value => { if (fail) throw Error('disk full'); saved = structuredClone(value); } };
  const connect = async (a, { credentials, onChange }) => {
    connects++; a.status = 'Đã kết nối'; a.credentials = credentials || { imei: 'fake-imei', userAgent: 'fake-UA', cookie: [{ value: 'secret-fixture' }] };
    a.api = { sendMessage: async () => { sent++; }, listener: { stop() {} } };
    if (!a.messages.length) a.messages = [{ id: 'received', threadId: 'friend', type: 0, name: 'Fixture', self: false, text: 'Hi', at: '1' }]; onChange();
  };
  const manager = new AccountManager({ connect, store });
  return { manager, store, connect, get sent() { return sent; }, get connects() { return connects; }, fail: () => { fail = true; }, recover: () => { fail = false; } };
}
test('six slots, redacted renderer data, manual send and restart restore without automatic send', async () => {
  const f = fixture(), m = f.manager; await m.load();
  for (let i = 0; i < 6; i++) await m.add('Account ' + i);
  await settle(); await assert.rejects(m.add('seventh'), /6/);
  assert.equal(f.sent, 0); assert.ok(!JSON.stringify(m.list()).includes('secret-fixture'));
  const id = m.list()[0].id;
  await assert.rejects(m.send(id, { text: 'hello', threadId: 'stranger', type: 0 }), /đã nhận/);
  assert.equal(f.sent, 0);
  await m.send(id, { text: 'hello', threadId: 'friend', type: 0 }); assert.equal(f.sent, 1);
  await assert.rejects(m.send(id, { text: 'again', threadId: 'friend', type: 0 }), /3 giây/);
  await m.stop();
  const restored = new AccountManager({ connect: f.connect, store: f.store }); await restored.load(); restored.restore(); await settle();
  assert.equal(restored.list().length, 6); assert.equal(restored.list()[0].status, 'Đã kết nối'); assert.equal(f.sent, 1);
  assert.ok(restored.list()[0].messages.some(message => message.text === 'hello'));
  await restored.remove(id); await restored.stop();
  const reopened = new AccountManager({ connect: f.connect, store: f.store }); await reopened.load(); assert.equal(reopened.list().length, 5); await reopened.stop();
});
test('save failure after a successful send warns without requesting resend', async () => {
  const f = fixture(), m = f.manager; await m.add('Test'); await settle(); f.fail();
  const result = await m.send(m.list()[0].id, { text: 'hello', threadId: 'friend', type: 0 });
  assert.equal(f.sent, 1); assert.equal(result.ok, true); assert.match(result.warning, /không gửi lại/);
  f.recover(); await m.stop();
});
test('failed first save does not start authentication or leave a phantom account', async () => {
  const f = fixture(); f.fail(); await assert.rejects(f.manager.add('Test'), /Chưa lưu/); await settle();
  assert.equal(f.manager.list().length, 0); assert.equal(f.connects, 0); f.recover(); await f.manager.stop();
});
