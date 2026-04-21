// ========== KFM 全局变量与初始化 ==========
const API='/kfmv4/api';
let selectedFile='';
let expandedPaths=JSON.parse(localStorage.getItem('expandedPaths')||'{}');
let showHidden=false;

// ========== 远程调试日志 ==========
function rlog(msg){
  const t=new Date().toLocaleTimeString('zh-CN',{hour12:false});
  fetch(API+'/files/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/root/kfmv4/debug-swipe.log',content:t+' '+msg+'\n',append:true})}).catch(()=>{});
}

// ========== 调试日志保存函数 ==========
// 简化版本，确保不影响手势执行
function saveDebugLog(messages){
  const time=new Date().toLocaleTimeString('zh-CN',{hour12:false});
  const content=time+': '+messages.map(m=>String(m)).join(' ');
  const safe=content.replace(/"/g,'\\"');
  const cmd=`echo "${safe}" >> /sdcard/工作台/项目/termux-operitai/写入区/kfm/debug.log`;
  fetch(API+'/exec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,cwd:'/data/data/com.termux/files/home'})}).catch(()=>{});
}

function clearDebugLog(){
  const cmd=`> /sdcard/工作台/项目/termux-operitai/写入区/kfm/debug.log`;
  fetch(API+'/exec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,cwd:'/data/data/com.termux/files/home'})}).catch(()=>{});
}

// ========== API 函数 ==========
async function apiExec(cmd,cwd){
  try{
    const r=await fetch(API+'/exec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,cwd:cwd||'/data/data/com.termux/files/home'})});
    return r.json();
  }catch(e){return {success:false,error:e.message};}
}
async function apiInfo(){
  try{
    const r=await fetch(API+'/info');
    return r.json();
  }catch(e){return {};}
}

// 路径转换：~/开头转换为完整路径
function expandPath(p){
  if(p.startsWith('~')){
    return '/root'+(p.length>1?p.slice(1):'');
  }
  return p;
}

// ========== 缓存系统 ==========
let fileCache={version:1,updated:0,tree:{}};
const CACHE_LIMIT=10;
const CACHE_PATH='~/w/项目/kalo-file-manager/kalo-file-cache.json';

async function loadCache(){
  try{
    const r=await fetch(API+'/cache');
    const j=await r.json();
    if(j.success)fileCache=j.data;
  }catch(e){console.error('Cache load failed:',e);}
}
async function saveCache(){
  try{
    await fetch(API+'/write',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({path:CACHE_PATH,content:JSON.stringify(fileCache),append:false})
    });
  }catch(e){console.error('Cache save failed:',e);}
}
function updateCacheDir(path,children){
  fileCache.tree[path]={children,updated:Date.now()};
}
function getCacheDir(path){
  return fileCache.tree[path];
}

// ========== 提示 ==========
function showToast(msg){
  const toast=document.getElementById('operationToast');
  toast.textContent=msg;
  toast.classList.add('show');
  setTimeout(()=>{toast.classList.remove('show');},2000);
}

// ========== 日志系统 ==========
const logs=[];
const MAX_LOGS=100;

function addLog(msg,type='info'){
  const time=new Date().toLocaleTimeString();
  logs.unshift({time,msg:String(msg),type});
  if(logs.length>MAX_LOGS)logs.pop();
  renderLogs();
}

function renderLogs(){
  const content=document.getElementById('logContent');
  if(!content)return;
  content.innerHTML=logs.map(log=>{
    const cls=log.type==='error'?'error':log.type==='success'?'success':'';
    return `<div class="log-item ${cls}"><span class="time">${log.time}</span>${escapeHtml(log.msg)}</div>`;
  }).join('');
}

function escapeHtml(str){
  return String(str).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>');
}

function openLogPanel(){
  document.getElementById('logPanel').classList.add('open');
  renderLogs();
}

function closeLogPanel(){
  document.getElementById('logPanel').classList.remove('open');
}

function clearLogs(){
  logs.length=0;
  renderLogs();
}

// 日志面板滑动关闭
let logTouchStartX=0;
document.getElementById('logPanel')?.addEventListener('touchstart',(e)=>{
  logTouchStartX=e.touches[0].clientX;
},{passive:true});
document.getElementById('logPanel')?.addEventListener('touchmove',(e)=>{
  const dx=e.touches[0].clientX-logTouchStartX;
  const panel=document.getElementById('logPanel');
  if(dx>0){ // 向右滑动
    panel.style.transform=`translateX(${dx}px)`;
  }
},{passive:true});
document.getElementById('logPanel')?.addEventListener('touchend',(e)=>{
  const dx=e.changedTouches[0].clientX-logTouchStartX;
  const panel=document.getElementById('logPanel');
  panel.style.transform='';
  if(dx>80){ // 滑动超过 80px 关闭
    closeLogPanel();
  }
},{passive:true});

// 捕获 console.log
const originalLog=console.log;
const originalError=console.error;
console.log=function(...args){
  originalLog.apply(console,args);
  addLog(args.map(a=>typeof a==='object'?JSON.stringify(a):a).join(' '));
};
console.error=function(...args){
  originalError.apply(console,args);
  addLog(args.map(a=>typeof a==='object'?JSON.stringify(a):a).join(' '),'error');
};

// ========== 初始化 ==========
async function init(){
  await loadCache();
  renderTree();
  setInterval(()=>{saveCache();},30000);
}
init();