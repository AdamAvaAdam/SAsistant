import { safeUrl } from '../connector/content.mjs';
const cdnDomains = ['zaloapp.com', 'zadn.vn', 'zalo.me', 'zaloapp.vn', 'zaloappcdn.com', 'zalo.cloud'];
export function allowedMediaUrl(value) {
  const url = safeUrl(value); if (!url) throw Error('Đường dẫn tệp không hợp lệ.');
  const u = new URL(url);
  if (u.port && u.port !== '443' || !cdnDomains.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) throw Error('Chỉ tải trực tiếp nội dung từ máy chủ Zalo được hỗ trợ.');
  return url;
}
export function attachment(manager, ref) {
  const a = manager.account(ref.accountId), m = a.messages.find(m => m.id === ref.id && m.threadId === ref.threadId && m.type === Number(ref.type));
  const item = m?.attachments?.[Number(ref.index)];
  if (!item) throw Error('Không tìm thấy tệp trong hội thoại.');
  return item;
}
export async function fetchMedia(value, range, fetcher = fetch) {
  let url = allowedMediaUrl(value);
  for (let redirects = 0; redirects < 5; redirects++) {
    const headers = range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {};
    const response = await fetcher(url, { redirect: 'manual', headers, signal: AbortSignal.timeout(45000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); url = allowedMediaUrl(new URL(response.headers.get('location'), url).href); continue; }
    if (!response.ok) { await response.body?.cancel(); throw Error('Tệp không còn khả dụng hoặc Zalo từ chối tải.'); }
    if (Number(response.headers.get('content-length') || 0) > 200 * 1024 * 1024) { await response.body?.cancel(); throw Error('Tệp quá 200 MB.'); }
    return response;
  }
  throw Error('Đường dẫn chuyển hướng quá nhiều lần.');
}
