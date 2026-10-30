import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { EncryptedStore, validateSnapshot } from './storage.mjs';

function testCipher() {
  const key = randomBytes(32);
  return {
    encrypt: async text => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); },
    decrypt: async b => { const cipher = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12)); cipher.setAuthTag(b.subarray(12, 28)); return Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString(); },
  };
}
const snapshot = name => ({ version: 1, accounts: [{ id: '12345678-1234-1234-1234-123456789abc', name, messages: [], credentials: { imei: 'synthetic-imei', userAgent: 'fixture', cookie: [{ name: 'test', value: 'synthetic-secret' }] } }] });
test('encrypted storage survives restart, queues writes, keeps encrypted backup and rejects tampering', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sasistant-storage-')), cipher = testCipher(), store = new EncryptedStore(dir, cipher);
  assert.deepEqual(await store.read(), { version: 1, accounts: [] });
  await Promise.all([store.write(snapshot('first')), store.write(snapshot('second'))]);
  const disk = await readFile(store.file), backup = await readFile(store.file + '.bak');
  assert.ok(!disk.includes(Buffer.from('synthetic-secret'))); assert.ok(!backup.includes(Buffer.from('synthetic-secret')));
  assert.equal((await new EncryptedStore(dir, cipher).read()).accounts[0].name, 'second');
  const wrongUser = new EncryptedStore(dir, testCipher()); await assert.rejects(wrongUser.read(), /Không mở được/);
  assert.deepEqual(await readFile(store.file), disk);
  await writeFile(store.file, Buffer.from('damaged')); await assert.rejects(store.read(), /Không mở được/);
  assert.deepEqual(await readFile(store.file + '.bak'), backup);
});
test('missing primary with backup is not treated as an empty fresh store', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sasistant-backup-')), store = new EncryptedStore(dir, testCipher());
  await store.write(snapshot('first')); await rename(store.file, store.file + '.bak');
  await assert.rejects(store.read(), /bản dự phòng/);
});
test('snapshot schema rejects duplicate accounts and unsupported versions', () => {
  assert.throws(() => validateSnapshot({ version: 2, accounts: [] }));
  const value = snapshot('first'); value.accounts.push(value.accounts[0]); assert.throws(() => validateSnapshot(value));
});
