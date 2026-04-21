// ========== 文件编辑器 ==========
let editorPath='';
let editorMode='NORMAL';
let editorOrigContent='';
let editorModified=false;
let editorUndoStack=[];
let editorRedoStack=[];
let editorClipboard='';
let editorLastSaveTime=0;
const SNAPSHOT_INTERVAL=10*60*1000;
const MAX_SNAPSHOTS=50;

// 快照存储
function getSnapshotKey(path){return 'editor_snapshots_'+path.replace(/[\/\\:]/g,'_');}
function loadSnapshots(path){const data=localStorage.getItem(getSnapshotKey(path));return data?JSON.parse(data):[];}
function saveSnapshots(path,snapshots){localStorage.setItem(getSnapshotKey(path),JSON.stringify(snapshots));}
function addSnapshot(path,content){
  const snaps=loadSnapshots(path);
  const newSnap={id:'v'+(snaps.length+1),time:Date.now(),content:content,label:'版本'+(snaps.length+1)};
  snaps.unshift(newSnap);
  if(snaps.length>MAX_SNAPSHOTS)snaps.pop();
  saveSnapshots(path,snaps);
  return newSnap;
}

// 编辑器UI元素
const $editorPage=()=>document.getElementById('editorPage');
const $editorContent=()=>document.getElementById('editorContent');
const $editorLines=()=>document.getElementById('editorLines');
const $editorFilename=()=>document.getElementById('editorFilename');
const $editorModified=()=>document.getElementById('editorModified');
const $modeIndicator=()=>document.getElementById('modeIndicator');
const $cmdInputWrap=()=>document.getElementById('cmdInputWrap');
const $cmdInput=()=>document.getElementById('cmdInput');

// 显示/隐藏编辑器
function showEditor(){
  $editorPage().classList.add('show');
  document.getElementById('homePage').style.display='none';
  document.getElementById('previewPage').classList.remove('show');
}
function hideEditor(){$editorPage().classList.remove('show');}

// 打开文件到编辑器
async function openInEditor(path){
  if(editorPath&&editorModified) await saveEditorFile();
  editorPath=path;
  const filename=path.split('/').pop();
  const parts=path.split('/');parts.pop();
  const dir=parts.join('/');
  const fullDir=expandPath(dir);
  $editorFilename().textContent=filename;
  document.getElementById('editorLoading').classList.add('show');
  await apiExec('cd "'+fullDir+'"');
  const result=await apiExec('cat "'+filename+'"',fullDir);
  const content=result.stdout||'';
  editorOrigContent=content;
  editorModified=false;
  editorUndoStack=[];
  editorRedoStack=[];
  $editorModified().classList.remove('show');
  $editorContent().textContent=content;
  updateLineNumbers();
  const snaps=loadSnapshots(path);
  if(snaps.length===0){addSnapshot(path,content);editorLastSaveTime=Date.now();}
  document.getElementById('editorLoading').classList.remove('show');
  setEditorMode('NORMAL');
  showEditor();
  $editorContent().focus();
}

// 保存文件
async function saveEditorFile(){
  if(!editorPath)return;
  const content=$editorContent().textContent;
  const filename=editorPath.split('/').pop();
  const parts=editorPath.split('/');parts.pop();
  const fullDir=expandPath(parts.join('/'));
  const escaped=content.replace(/'/g,"'\\''");
  const cmd='echo \''+escaped+'\' > '+filename;
  const result=await apiExec(cmd,fullDir);
  if(!result.error){
    editorOrigContent=content;
    editorModified=false;
    $editorModified().classList.remove('show');
    editorLastSaveTime=Date.now();
  }
}

// 自动保存（每30秒）
function checkAutoSave(){
  if(editorModified&&editorPath) saveEditorFile();
  if(editorPath&&editorModified&&Date.now()-editorLastSaveTime>=SNAPSHOT_INTERVAL){
    addSnapshot(editorPath,$editorContent().textContent);
    editorLastSaveTime=Date.now();
  }
}
setInterval(checkAutoSave,30000);

// 检测内容变化
function onEditorInput(){
  const current=$editorContent().textContent;
  if(current!==editorOrigContent){editorModified=true;$editorModified().classList.add('show');}
  updateLineNumbers();
}

// 更新行号
function updateLineNumbers(){
  const content=$editorContent().textContent;
  const lines=content.split('\n');
  $editorLines().innerHTML=lines.map((_,i)=>'<div>'+(i+1)+'</div>').join('');
}

// 模式切换
function setEditorMode(mode){
  editorMode=mode;
  const indicator=$modeIndicator();
  const content=$editorContent();
  switch(mode){
    case 'NORMAL':indicator.textContent='NORMAL';indicator.style.background='var(--primary)';content.contentEditable='false';break;
    case 'INSERT':indicator.textContent='INSERT';indicator.style.background='#00d4ff';content.contentEditable='true';break;
    case 'VISUAL':indicator.textContent='VISUAL';indicator.style.background='#ff4775';content.contentEditable='false';break;
  }
}

// 编辑器操作函数
function editorInsert(){setEditorMode('INSERT');$editorContent().focus();}
function editorExitInsert(){setEditorMode('NORMAL');}
function editorUndo(){if(editorUndoStack.length===0)return;editorRedoStack.push($editorContent().textContent);$editorContent().textContent=editorUndoStack.pop();onEditorInput();}
function editorRedo(){if(editorRedoStack.length===0)return;editorUndoStack.push($editorContent().textContent);$editorContent().textContent=editorRedoStack.pop();onEditorInput();}
function editorYank(){const sel=window.getSelection();if(sel.rangeCount>0&&sel.toString()){editorClipboard=sel.toString();return;}const lines=$editorContent().textContent.split('\n');editorClipboard=lines[lines.length-1]||'';}
function editorDelete(){const content=$editorContent().textContent;editorUndoStack.push(content);const lines=content.split('\n');if(lines.length>1)lines.pop();else lines[0]='';$editorContent().textContent=lines.join('\n');editorRedoStack=[];onEditorInput();}
function editorPaste(){if(!editorClipboard)return;const content=$editorContent().textContent;editorUndoStack.push(content);$editorContent().textContent=content+editorClipboard;editorRedoStack=[];onEditorInput();}
function editorVisual(){setEditorMode('VISUAL');}
function editorGotoStart(){setEditorMode('NORMAL');$editorContent().focus();const sel=window.getSelection();const range=document.createRange();range.setStart($editorContent(),0);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}
function editorGotoEnd(){setEditorMode('NORMAL');$editorContent().focus();const sel=window.getSelection();const range=document.createRange();const lc=$editorContent().lastChild;if(lc){range.selectNodeContents(lc);range.collapse(false);}else{range.setStart($editorContent(),0);range.collapse(true);}sel.removeAllRanges();sel.addRange(range);}
function editorSelectAll(){setEditorMode('VISUAL');const sel=window.getSelection();const range=document.createRange();range.selectNodeContents($editorContent());sel.removeAllRanges();sel.addRange(range);}
function editorCopy(){const sel=window.getSelection();if(sel.rangeCount>0)navigator.clipboard.writeText(sel.toString());}

// 命令输入
function editorCmd(cmd){$cmdInputWrap().classList.add('show');$cmdInput().value=cmd;$cmdInput().focus();}
function execCmd(cmd){
  cmd=cmd.trim();
  $cmdInputWrap().classList.remove('show');
  if(cmd==='wq'){saveEditorFile();editorClose();}
  else if(cmd==='q!'||cmd==='q')editorClose();
  else if(cmd==='w')saveEditorFile();
  else if(cmd==='gg')editorGotoStart();
  else if(cmd==='G')editorGotoEnd();
  else if(cmd==='redo')editorRedo();
  else if(/^\d+$/.test(cmd))gotoLine(parseInt(cmd));
  else if(cmd.startsWith(':'))execCmd(cmd.slice(1));
}

function gotoLine(lineNum){
  const lines=$editorContent().textContent.split('\n');
  if(lineNum<1||lineNum>lines.length)return;
  let offset=0;
  for(let i=0;i<lineNum-1;i++)offset+=lines[i].length+1;
  setEditorMode('NORMAL');
  $editorContent().focus();
  const sel=window.getSelection();const range=document.createRange();
  const walker=document.createTreeWalker($editorContent(),NodeFilter.SHOW_TEXT,null,false);
  let charCount=0;let node;
  while(node=walker.nextNode()){
    if(charCount+node.length>=offset){
      range.setStart(node,offset-charCount);range.collapse(true);
      sel.removeAllRanges();sel.addRange(range);
      const rect=range.getBoundingClientRect();
      $editorContent().parentElement.parentElement.scrollTop=rect.top-100;
      return;
    }
    charCount+=node.length+1;
  }
}

// 关闭编辑器
async function editorClose(){
  if(editorModified) await saveEditorFile();
  editorPath='';editorOrigContent='';editorModified=false;
  editorUndoStack=[];editorRedoStack=[];
  hideEditor();navigateToHome();
}

let editorMoreOpen=false;
function editorMore(){editorMoreOpen=!editorMoreOpen;document.getElementById('editorMoreBtn')?.classList.toggle('active',editorMoreOpen);}

// 快照历史
function editorSnapshots(){
  if(!editorPath)return;
  const snaps=loadSnapshots(editorPath);
  const list=document.getElementById('snapshotList');
  list.innerHTML=snaps.map((s,i)=>`<div class="snapshot-item" onclick="restoreSnapshot(${i})"><span class="version">${s.id}</span><div style="flex:1"><div class="time">${new Date(s.time).toLocaleString()}</div><div class="preview-text">${s.content.slice(0,50).replace(/\n/g,'↵')}...</div></div></div>`).join('');
  document.getElementById('snapshotPanel').classList.add('show');
}
function closeSnapshots(){document.getElementById('snapshotPanel').classList.remove('show');}
function restoreSnapshot(index){
  const snaps=loadSnapshots(editorPath);
  if(snaps[index]){$editorContent().textContent=snaps[index].content;editorUndoStack.push(snaps[index].content);editorModified=true;$editorModified().classList.add('show');onEditorInput();closeSnapshots();}
}

// 编辑器事件绑定
$editorContent().addEventListener('click',function(){if(editorMode==='NORMAL')setEditorMode('INSERT');});
let lastTap=0;
$editorContent().addEventListener('dblclick',function(){setEditorMode('NORMAL');});
let longPressTimer=null;
$editorContent().addEventListener('touchstart',function(e){longPressTimer=setTimeout(()=>{if(editorMode==='NORMAL')setEditorMode('VISUAL');longPressTimer=null;},500);},{passive:true});
$editorContent().addEventListener('touchend',function(){if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}},{passive:true});
$editorContent().addEventListener('touchmove',function(){if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}},{passive:true});
$editorContent().addEventListener('input',onEditorInput);
$cmdInput().addEventListener('keypress',function(e){if(e.key==='Enter')execCmd(this.value);else if(e.key==='Escape')$cmdInputWrap().classList.remove('show');});
$cmdInput().addEventListener('input',function(){if(this.value&&!this.value.startsWith(':'))this.value=':'+this.value;});

// JJ 快速退出
let jjBuffer='';let jjTimer=null;
$editorContent().addEventListener('keypress',function(e){
  if(editorMode==='INSERT'){jjBuffer+=e.key;if(jjTimer)clearTimeout(jjTimer);jjTimer=setTimeout(()=>{jjBuffer='';},1000);if(jjBuffer==='jj'){jjBuffer='';setEditorMode('NORMAL');}}
});

// 快照时间更新
function updateSnapshotTime(){
  if(editorPath&&editorModified){const snaps=loadSnapshots(editorPath);if(snaps.length>0){snaps[0].time=Date.now();saveSnapshots(editorPath,snaps);}}
}
setInterval(updateSnapshotTime,60000);