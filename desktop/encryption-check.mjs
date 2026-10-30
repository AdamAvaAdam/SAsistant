// Developer-only integration check. Excluded from installer; synthetic data only.
import { app, safeStorage } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { EncryptedStore } from './storage.mjs';
async function run() {
  mkdirSync(path.resolve('.local/encryption-profile'), { recursive: true });
  app.setPath('userData', path.resolve('.local/encryption-profile'));
  await app.whenReady();
  assert.equal(await safeStorage.isAsyncEncryptionAvailable(), true);
  const dir = await mkdtemp(path.resolve('.local/dpapi-check-'));
  const cipher = { encrypt: t => safeStorage.encryptStringAsync(t), decrypt: async b => (await safeStorage.decryptStringAsync(b)).result };
  const store = new EncryptedStore(dir, cipher);
  const value = { version: 1, accounts: [{ id: '12345678-1234-1234-1234-123456789abc', name: 'Fixture', messages: [], credentials: { imei: 'fixture', userAgent: 'fixture', cookie: [{ value: 'synthetic-DPAPI-secret' }] } }] };
  await store.write(value);
  assert.ok(!(await readFile(store.file)).includes(Buffer.from('synthetic-DPAPI-secret')));
  assert.deepEqual(await new EncryptedStore(dir, cipher).read(), value);
  console.log('WINDOWS_ENCRYPTION_CHECK_PASS: actual Electron safeStorage encrypted file and restart read');
  app.exit(0);
}
run().catch(e => { console.error('WINDOWS_ENCRYPTION_CHECK_FAIL: ' + e.message); app.exit(1); });
