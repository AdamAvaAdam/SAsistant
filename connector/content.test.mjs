import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageContent, safeUrl } from './content.mjs';
test('full text, image, video, audio and file keep displayable metadata without HTML evaluation', () => {
  assert.equal(messageContent({ content: 'x'.repeat(6000) }).text.length, 6000);
  for (const [msgType, type] of [['chat.photo', 'image'], ['chat.video.msg', 'video'], ['chat.voice', 'audio'], ['share.file', 'file']]) {
    const result = messageContent({ msgType, content: { title: 'Fixture', href: 'https://photo.zaloapp.com/fixture', params: '{}' } }); assert.equal(result.attachments[0].type, type); assert.equal(result.text, 'Fixture');
  }
  const video = messageContent({ msgType: 'chat.video.msg', content: { params: JSON.stringify({ videoUrl: 'https://video.zaloapp.com/fixture' }) } }); assert.match(video.attachments[0].url, /video.zaloapp/);
  assert.equal(safeUrl('javascript:alert(1)'), ''); assert.equal(safeUrl('file:///private'), '');
});
