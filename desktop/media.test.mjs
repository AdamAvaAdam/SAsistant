import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedMediaUrl, fetchMedia } from './media.mjs';
test('media URL and redirects reject local files, unknown hosts and CDN lookalikes', async () => {
  assert.ok(allowedMediaUrl('https://photo.zaloapp.com/image'));
  for (const url of ['http://127.0.0.1/a', 'https://localhost/a', 'https://zaloapp.com.evil.example/a', 'file:///C:/data', 'https://photo.zaloapp.com:8080/a']) assert.throws(() => allowedMediaUrl(url));
  let calls = 0;
  await assert.rejects(fetchMedia('https://photo.zaloapp.com/image', '', async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://localhost/private' } }); })); assert.equal(calls, 1);
});
