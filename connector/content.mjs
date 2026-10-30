export const MAX_MESSAGES = 5000;
export const MAX_TEXT = 50000;
export function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 12000) return '';
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
function object(value) { if (value && typeof value === 'object') return value; try { return JSON.parse(value || '{}') || {}; } catch { return {}; } }
export function messageContent(data) {
  let c = data.content;
  if (typeof c === 'string' && data.msgType && data.msgType !== 'webchat') {
    try { const parsed = JSON.parse(c); if (parsed && typeof parsed === 'object') c = parsed; } catch { /* Plain text stays plain text. */ }
  }
  if (typeof c === 'string') return { text: c.slice(0, MAX_TEXT), attachments: [] };
  const value = object(c), p = object(value.params), kind = String(data.msgType || '');
  const text = [value.title, value.description].filter(x => typeof x === 'string' && x).filter((x, i, a) => a.indexOf(x) === i).join('\n').slice(0, MAX_TEXT);
  const type = /photo|gif|sticker|doodle/.test(kind) ? 'image' : /video/.test(kind) ? 'video' : /voice/.test(kind) ? 'audio' : kind === 'chat.link' ? 'link' : 'file';
  const url = safeUrl(p.videoUrl || value.videoUrl || p.voiceUrl || p.m4aUrl || value.href || value.url || value.hdUrl || value.normalUrl);
  const thumbnail = safeUrl(value.thumb || p.thumbUrl || value.thumbUrl);
  const attachments = url || thumbnail ? [{ type, url: url || thumbnail, thumbnail, name: String(value.title || (type === 'image' ? 'Hình ảnh' : type === 'video' ? 'Video' : type === 'audio' ? 'Tin thoại' : 'Tệp đính kèm')).slice(0, 240) }] : [];
  return { text: text || (attachments.length ? '' : '[Nội dung chưa hỗ trợ: ' + (kind || 'khác') + ']'), attachments };
}
