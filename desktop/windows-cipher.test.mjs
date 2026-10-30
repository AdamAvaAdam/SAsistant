import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const run = promisify(execFile);
test('Windows data file decrypts in an independent process without a Chromium profile key', { skip: process.platform !== 'win32', timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sasistant-cross-process-')), file = path.join(dir, 'fixture.sasistant');
  const moduleURL = new URL('./windows-cipher.mjs', import.meta.url).href;
  const writer = `import {writeFile} from 'node:fs/promises';import {createWindowsCipher} from ${JSON.stringify(moduleURL)};await writeFile(process.argv[1],await createWindowsCipher().encrypt('synthetic-fixture-only'));`;
  const reader = `import {readFile} from 'node:fs/promises';import {createWindowsCipher} from ${JSON.stringify(moduleURL)};if(await createWindowsCipher().decrypt(await readFile(process.argv[1]))!=='synthetic-fixture-only')throw Error('Mismatch');console.log('ok');`;
  await run(process.execPath, ['--input-type=module', '-e', writer, file], { windowsHide: true });
  assert.ok(!(await readFile(file)).includes(Buffer.from('synthetic-fixture-only')));
  const first = await run(process.execPath, ['--input-type=module', '-e', reader, file], { windowsHide: true });
  const second = await run(process.execPath, ['--input-type=module', '-e', reader, file], { windowsHide: true });
  assert.equal(first.stdout.trim(), 'ok'); assert.equal(second.stdout.trim(), 'ok');
});
