import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function createConnector({ connect, token = randomBytes(32).toString('hex') } = {}) {
  const accounts = new Map();
  const origins = new Set(['https://adamavaadam.github.io', 'http://127.0.0.1:4317']);
  const server = http.createServer(async (req, res) => {
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers.host !== '127.0.0.1:4317' && req.headers.host !== `127.0.0.1:${server.address()?.port}`) return reply(403, {error:'Host bị từ chối'});
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) return reply(403, {error:'Origin bị từ chối'});
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Private-Network', 'true'); res.writeHead(204); return res.end();
    }
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && ['/', '/inbox.html', '/inbox.js', '/inbox.css'].includes(path)) {
      const file = path === '/' ? 'inbox.html' : path.slice(1);
      res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' http://127.0.0.1:4317; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
      return res.end(await readFile(new URL('../'+file, import.meta.url)));
    }
    const supplied = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, {error:'Mã ghép nối không đúng'});
    try {
      let body = {};
      if (req.method === 'POST') {
        if (req.headers['content-type'] !== 'application/json') return reply(415, {error:'Cần JSON'});
        let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 8192) return reply(413,{error:'Nội dung quá dài'}); }
        body = JSON.parse(raw || '{}');
      }
      if (path === '/api/accounts' && req.method === 'GET') return reply(200, [...accounts.values()].map(a => ({id:a.id,name:a.name,status:a.status,qr:a.qr,messages:a.messages})));
      if (path === '/api/accounts' && req.method === 'POST') {
        if (accounts.size >= 6) return reply(409, {error:'Tối đa 6 tài khoản'});
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80) return reply(400,{error:'Tên không hợp lệ'});
        const a = {id:randomUUID(), name:body.name.trim(),status:'Đang yêu cầu QR',qr:null,messages:[]};
        accounts.set(a.id,a);
        Promise.resolve().then(()=>connect(a)).catch(()=>{a.qr=null;a.status='Đăng nhập thất bại; xóa tài khoản và thử lại';});
        return reply(202, {id:a.id});
      }
      const match = path.match(/^\/api\/accounts\/([a-f0-9-]+)(\/send)?$/);
      const a = match && accounts.get(match[1]);
      if (!a) return reply(404,{error:'Không tìm thấy'});
      if (!match[2] && req.method === 'DELETE') {
        a.cancelled=true; a.abort?.(); a.api?.listener.stop(); a.messages=[]; a.qr=null; accounts.delete(a.id); return reply(200,{ok:true});
      }
      if (match[2] && req.method === 'POST') {
        if (!a.api || a.status !== 'Đã kết nối') return reply(409,{error:'Tài khoản chưa kết nối'});
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) return reply(400,{error:'Tin nhắn phải có 1–2000 ký tự'});
        const thread = a.messages.find(m => m.threadId === body.threadId && m.type === body.type);
        if (!thread) return reply(400,{error:'Chỉ gửi trong hội thoại đã nhận'});
        if (a.sending || Date.now() - (a.lastSend || 0) < 3000) return reply(429,{error:'Chờ 3 giây giữa các lần gửi'});
        a.sending=true;
        try {
          await a.api.sendMessage(body.text.trim(), thread.threadId, thread.type);
          a.messages.push({id:randomUUID(),threadId:thread.threadId,type:thread.type,name:thread.name,self:true,text:body.text.trim(),at:String(Date.now())});
          a.messages=a.messages.slice(-1000); a.lastSend=Date.now();
        } finally { a.sending=false; }
        return reply(200,{ok:true});
      }
      return reply(405,{error:'Phương thức không hỗ trợ'});
    } catch { return reply(400,{error:'Thao tác thất bại; không tự gửi lại để tránh trùng tin'}); }
  });
  server.requestTimeout=15000;
  return {server, token, accounts};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { connect } = await import('./zalo.mjs');
  const { server, token } = createConnector({connect});
  server.listen(4317,'127.0.0.1',()=>{
    console.log('SAsistant: http://127.0.0.1:4317');
    console.log('Mã ghép nối chỉ dùng trên máy này: '+token);
    console.log('Phiên và tin nhắn chỉ nằm trong RAM. Dừng bằng Ctrl+C.');
  });
}
