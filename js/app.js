// ========== KFM 全局变量与初始化 ==========
const API='/kfmv4/api';
let selectedFile='';
let expandedPaths=JSON.parse(localStorage.getItem('expandedPaths')||'{}');
let showHidden=false;

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

