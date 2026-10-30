import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConnector } from './server.mjs';
import http from 'node:http';

test('security boundary, six slots, QR projection, receive and explicit send', async t => {
  let sent=0;
  const app=createConnector({connect:async a=>{
    a.status='Đã kết nối';a.qr='fake';a.secret='must-not-leak';
    a.messages=[{id:'1',threadId:'friend',type:0,name:'Test',text:'hello',at:'1'}];
    a.api={sendMessage:async()=>{sent++;},listener:{stop(){}}};
  }});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>app.server.close());
  const url='http://127.0.0.1:'+app.server.address().port;
  const call=(path,method='GET',body,extra={})=>fetch(url+path,{method,headers:{Authorization:'Bearer '+app.token,...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});
  assert.equal((await fetch(url+'/api/accounts')).status,401);
  assert.equal((await call('/api/accounts','GET',null,{Origin:'https://evil.example'})).status,403);
  const badHost=await new Promise((resolve,reject)=>{const req=http.get(url+'/api/accounts',{headers:{Host:'evil.example',Authorization:'Bearer '+app.token}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(badHost,403);
  const preflight=await call('/api/accounts','OPTIONS',null,{Origin:'https://adamavaadam.github.io'});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://adamavaadam.github.io');
  for(let i=0;i<6;i++)assert.equal((await call('/api/accounts','POST',{name:'Test '+i})).status,202);
  assert.equal((await call('/api/accounts','POST',{name:'Seventh'})).status,409);
  const response=await call('/api/accounts');const text=await response.text();assert.ok(!text.includes('must-not-leak'));const accounts=JSON.parse(text);assert.equal(accounts.length,6);
  const path='/api/accounts/'+accounts[0].id;
  assert.equal((await call(path+'/send','POST',{threadId:'unknown',type:0,text:'hi'})).status,400);
  assert.equal(sent,0);
  assert.equal((await call(path+'/send','POST',{threadId:'friend',type:0,text:'hi'})).status,200);
  assert.equal(sent,1);
  assert.equal((await call(path+'/send','POST',{threadId:'friend',type:0,text:'again'})).status,429);
  assert.equal((await call(path,'DELETE')).status,200);
  assert.equal(app.accounts.size,5);
  assert.equal((await call('/api/accounts','POST',{name:'Replacement'})).status,202);
});
