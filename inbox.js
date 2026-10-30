'use strict';
const $ = id => document.getElementById(id);
const base = 'http://127.0.0.1:4317';
let token='', accounts=[], active='', selected='', busy=false, sending=false, generation=0;
function error(message='') { $('error').textContent=message; }
async function api(path, method='GET', body) {
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(12000)});
  const data=await response.json(); if(!response.ok)throw Error(data.error || 'Kết nối thất bại');return data;
}
function node(tag,text,className){const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
function render(){
  $('count').textContent=accounts.length+'/6';$('addButton').disabled=!token||accounts.length>=6;
  $('accounts').replaceChildren();
  for(const a of accounts){const box=node('div'),b=node('button',a.name+' · '+a.status,'item'+(a.id===active?' active':''));b.onclick=()=>{active=a.id;selected='';render();};const remove=node('button','Xóa phiên trên máy','remove');remove.onclick=async()=>{try{await api('/api/accounts/'+a.id,'DELETE');await refresh();}catch(e){error(e.message);}};box.append(b,remove);$('accounts').append(box);}
  const a=accounts.find(a=>a.id===active);$('qr').hidden=!a?.qr;if(a?.qr)$('qr').src='data:image/png;base64,'+a.qr;else $('qr').removeAttribute('src');$('qrStatus').textContent=a?.status||'';
  const threads=new Map();for(const m of a?.messages||[])threads.set(m.type+':'+m.threadId,m);
  $('threads').replaceChildren();const query=$('search').value.toLowerCase();
  for(const [key,m] of threads){if(!(m.name+' '+m.threadId).toLowerCase().includes(query))continue;const b=node('button',m.name+(m.type===1?' · Nhóm':''),'item'+(key===selected?' active':''));b.onclick=()=>{selected=key;render();};$('threads').append(b);}
  const thread=threads.get(selected);$('title').textContent=thread?thread.name+' · '+a.name:'Chọn một hội thoại';$('messages').replaceChildren();
  for(const m of a?.messages||[]){if(m.type+':'+m.threadId!==selected)continue;const b=node('div',m.text,'message'+(m.self?' self':''));const date=new Date(Number(m.at));b.append(node('small',m.self?'Ông · '+date.toLocaleString('vi-VN'):m.name+' · '+date.toLocaleString('vi-VN')));$('messages').append(b);}
  $('sendButton').disabled=sending||!thread||a?.status!=='Đã kết nối';
}
async function refresh(){if(!token||busy)return;busy=true;const g=generation;try{const data=await api('/api/accounts');if(g!==generation)return;accounts=data;if(!accounts.some(a=>a.id===active)){active=accounts[0]?.id||'';selected='';}$('connection').textContent='Đã ghép nối máy cá nhân';render();}catch(e){if(g===generation){$('connection').textContent='Mất kết nối';$('sendButton').disabled=true;error(e.message+' · Kiểm tra connector. Nếu Pages bị chặn, mở http://127.0.0.1:4317');}}finally{busy=false;}}
$('pair').onsubmit=async e=>{e.preventDefault();generation++;token=$('token').value.trim();$('token').value='';error();await refresh();};
$('disconnect').onclick=()=>{generation++;token='';accounts=[];active='';selected='';$('connection').textContent='Chưa ghép nối';render();error();};
$('add').onsubmit=async e=>{e.preventDefault();$('addButton').disabled=true;try{error();const result=await api('/api/accounts','POST',{name:$('name').value});active=result.id;selected='';$('name').value='';await refresh();}catch(e){error(e.message);}finally{render();}};
$('search').oninput=render;
$('send').onsubmit=async e=>{e.preventDefault();if(sending)return;const a=accounts.find(a=>a.id===active);const thread=a?.messages.find(m=>m.type+':'+m.threadId===selected);if(!thread)return;const text=$('text').value;sending=true;render();try{error();await api('/api/accounts/'+a.id+'/send','POST',{threadId:thread.threadId,type:thread.type,text});if($('text').value===text)$('text').value='';await refresh();}catch(e){error(e.message);}finally{sending=false;render();}};
setInterval(refresh,2000);render();
