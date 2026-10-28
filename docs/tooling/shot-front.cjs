const { spawn } = require('child_process');
const http = require('http'); const fs = require('fs'); const path = require('path');
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; const PORT=9781;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const getT=()=>new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json'},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>res(JSON.parse(b)))}).on('error',rej)});
const child=spawn(EDGE,['--headless=new','--remote-debugging-port='+PORT,'--user-data-dir='+path.resolve('.tmpdoc/cdp-front'),'--no-proxy-server','--proxy-bypass-list=*','--window-size=1920,1080','--force-device-scale-factor=2','about:blank'],{stdio:'ignore'});
(async()=>{
  let t; for(let i=0;i<60;i++){try{t=await getT();if(t&&t.length)break}catch(e){}await sleep(200)}
  const page=t.find(x=>x.type==='page'); const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pend=new Map();
  const call=(m,p)=>new Promise(res=>{const mid=++id;pend.set(mid,res);ws.send(JSON.stringify({id:mid,method:m,params:p||{}}))});
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result||m);pend.delete(m.id)}});
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:2,mobile:false});
  await call('Page.navigate',{url:'file:///'+path.resolve('.tmpdoc/front.html').replace(/\\/g,'/')});
  await sleep(1200);
  const s=await call('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1920,height:1080,scale:1}});
  fs.writeFileSync('.tmpdoc/front.png',Buffer.from(s.data,'base64'));
  console.log('saved', fs.statSync('.tmpdoc/front.png').size);
  ws.close();child.kill();process.exit(0);
})().catch(e=>{console.error(e);child.kill();process.exit(1)});
