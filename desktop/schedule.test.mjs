import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountManager } from './manager.mjs';
import { validateSnapshot } from './storage.mjs';
function fixture() {
  let time = 2000000000000, saved = { version: 1, accounts: [] }, sent = 0, mode = '', fail = false;
  const store = { read: async () => structuredClone(saved), write: async data => { if (fail) throw Error('disk'); validateSnapshot(data); saved = structuredClone(data); } };
  const m = new AccountManager({ store, now: () => time, connect: async () => {} });
  const a = { id: '12345678-1234-1234-1234-123456789abc', name: 'Fixture', status: 'Đã kết nối', messages: [{ id: '1', threadId: 'friend', type: 0, name: 'Customer', self: false, isLive: true, text: 'Hi', at: '100' }], api: { listener: { stop() {} }, sendMessage: async () => { sent++; if (mode === 'ambiguous') throw Error('timeout'); return { message: { msgId: 'sent' } }; } } };
  m.accounts.set(a.id, a);
  return { m, a, store, get sent() { return sent; }, advance: n => { time += n; }, due: () => time + 10000, mode: v => { mode = v; }, fail: v => { fail = v; } };
}
const body = dueAt => ({ threadId: 'friend', type: 0, text: 'Scheduled fixture', dueAt });
test('schedule persists before sending; does not send early and executes once across repeated ticks', async () => {
  const f = fixture(); const j = await f.m.schedule(f.a.id, body(f.due()));
  await f.m.runDue(); assert.equal(f.sent, 0); f.advance(11000); await Promise.all([f.m.runDue(), f.m.runDue()]);
  assert.equal(f.sent, 1); assert.equal(j.status, 'sent'); await f.m.runDue(); assert.equal(f.sent, 1); await f.m.stop();
});
test('cancellation and missed time never send; unavailable account waits within grace window', async () => {
  const f = fixture(); let j = await f.m.schedule(f.a.id, body(f.due())); await f.m.cancelSchedule(j.id); f.advance(20000); await f.m.runDue(); assert.equal(f.sent, 0);
  j = await f.m.schedule(f.a.id, body(f.due())); f.a.status = 'Offline'; f.advance(11000); await f.m.runDue(); assert.equal(j.status, 'pending'); assert.equal(f.sent, 0);
  f.advance(11 * 60000); await f.m.runDue(); assert.equal(j.status, 'missed'); assert.equal(f.sent, 0); await f.m.stop();
});
test('ambiguous network outcome is never retried', async () => {
  const f = fixture(); const j = await f.m.schedule(f.a.id, body(f.due())); f.mode('ambiguous'); f.advance(11000); await f.m.runDue();
  assert.equal(j.status, 'uncertain'); assert.equal(f.sent, 1); f.advance(6000); await f.m.runDue(); assert.equal(f.sent, 1); await f.m.stop();
});
test('disk failure before attempt prevents network send', async () => {
  const f = fixture(); const j = await f.m.schedule(f.a.id, body(f.due())); f.fail(true); f.advance(11000); await f.m.runDue(); assert.equal(f.sent, 0); assert.equal(j.status, 'failed'); f.fail(false); await f.m.stop();
});
test('restart changes in-flight sending to uncertain while keeping pending jobs and unread markers', async () => {
  const f = fixture(); const j = await f.m.schedule(f.a.id, body(f.due())); j.status = 'sending'; await f.m.markRead(f.a.id, 'friend', 0, 100); await f.m.persist();
  const restored = new AccountManager({ store: f.store, connect: async () => {} }); await restored.load(); assert.equal(restored.schedules[0].status, 'uncertain'); assert.equal(restored.list()[0].readAt['0:friend'], 100); assert.equal(f.sent, 0); await restored.stop(); await f.m.stop();
});
