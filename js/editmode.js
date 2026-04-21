// ========== 编辑模式/盒子系统 ==========

// 进入编辑模式
function enterEditMode(){
  editMode=true;
  document.getElementById('editModeExit').classList.add('show');
  document.body.style.touchAction='none';
  document.body.classList.add('edit-mode');
}

// 退出编辑模式（带动画）
function exitEditMode(){
  const box=document.getElementById('operationBox');
  box.style.transition='all .35s cubic-bezier(.25,.46,.45,.94)';
  box.style.opacity='0';box.style.transform='translateX(-150px)';
  setTimeout(()=>{
    editMode=false;operationItems=[];multiSelectMode=false;multiSelectStart=null;
    document.getElementById('editModeExit').classList.remove('show');
    box.classList.remove('show','selecting','operating','copy-mode','move-mode','delete-mode');
    document.getElementById('operationActions').classList.remove('show');
    document.body.style.touchAction='';document.body.classList.remove('edit-mode');
    document.querySelectorAll('.tree-item.dimmed').forEach(el=>el.classList.remove('dimmed'));
  },350);
}

// 退出到左栏（带动画）
function exitToSidebar(){
  const box=document.getElementById('operationBox');
  box.style.transition='all .35s cubic-bezier(.25,.46,.45,.94)';
  box.style.opacity='0';box.style.transform='translateX(-150px)';
  setTimeout(()=>{
    editMode=false;justExitedEdit=true;setTimeout(()=>{justExitedEdit=false;},300);
    operationItems=[];multiSelectMode=false;multiSelectStart=null;
    box.classList.remove('show','selecting','operating','copy-mode','move-mode','delete-mode');
    document.getElementById('operationActions').classList.remove('show');
    document.getElementById('editModeExit').classList.remove('show');
    document.body.style.touchAction='';document.body.classList.remove('edit-mode');
    document.querySelectorAll('.tree-item.dimmed').forEach(el=>el.classList.remove('dimmed'));
  },350);
}

// 添加项目到操作盒子（带动画）
function addToOperationBox(path,name,isDir){
  if(operationItems.find(item=>item.path===path))return;
  const treeItem=document.querySelector(`.tree-item[data-path="${path}"]`);
  if(treeItem) treeItem.classList.add('dimmed');
  operationItems.push({path,name,isDir});
  const box=document.getElementById('operationBox');
  const isFirstItem=!box.classList.contains('show');
  if(isFirstItem){
    box.classList.add('show','selecting');
    box.style.transition='none';box.style.opacity='0';box.style.transform='translateX(100vw) translateY(110%)';
    updateOperationBox();
    requestAnimationFrame(()=>{
      box.style.transition='all .4s cubic-bezier(.25,.46,.45,.94)';
      box.style.opacity='1';box.style.transform='translateX(calc(100vw - 220px)) translateY(110%)';
    });
  }else{
    updateOperationBox();
    const content=box.querySelector('.operation-box-content');
    const lastItem=content.lastElementChild;
    if(lastItem){
      lastItem.style.transition='none';lastItem.style.opacity='0';lastItem.style.transform='translateX(50px)';
      setTimeout(()=>{lastItem.style.transition='all .3s cubic-bezier(.34,1.56,.64,1)';lastItem.style.opacity='1';lastItem.style.transform='translateX(0)';},10);
    }
  }
}

// 从操作盒子移除项目
function removeFromOperationBox(path){
  operationItems=operationItems.filter(item=>item.path!==path);
  updateOperationBox();
  const item=document.querySelector(`.tree-item[data-path="${path}"]`);
  if(item)item.classList.remove('dimmed');
  if(operationItems.length===0) exitToSidebar();
}

// 更新操作盒子显示
function updateOperationBox(){
  const box=document.getElementById('operationBox');
  const content=document.getElementById('operationContent');
  const count=document.getElementById('operationCount');
  if(operationItems.length===0){box.classList.remove('show');return;}
  box.classList.add('show','selecting');
  const fileCount=operationItems.filter(i=>!i.isDir).length;
  const folderCount=operationItems.filter(i=>i.isDir).length;
  count.textContent=`${fileCount} 文件 ${folderCount} 文件夹`;
  content.innerHTML=operationItems.map(item=>`<div class="operation-box-item" data-path="${item.path}"><span>${item.isDir?'📁':'📄'}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.name}</span></div>`).join('');
  content.querySelectorAll('.operation-box-item').forEach(el=>{
    let startX=0;let itemSwiped=false;
    el.addEventListener('touchstart',e=>{e.stopPropagation();startX=e.touches[0].clientX;itemSwiped=false;},{passive:true});
    el.addEventListener('touchmove',e=>{e.stopPropagation();if(itemSwiped)return;if(e.touches[0].clientX-startX<-60){itemSwiped=true;removeFromOperationBox(el.dataset.path);}},{passive:true});
    el.addEventListener('touchend',e=>{e.stopPropagation();itemSwiped=false;},{passive:true});
  });
}

// 上滑进入操作模式
function enterOperatingMode(){
  const box=document.getElementById('operationBox');
  const actions=document.getElementById('operationActions');
  box.classList.remove('selecting');box.classList.add('operating','move-mode');
  actions.classList.add('show');operationMode='move';updateOperationModeButtons();
  setTimeout(()=>{
    box.style.transition='transform .25s cubic-bezier(.34,1.56,.64,1)';
    box.style.transform='translateX(calc(100vw - 220px)) translateY(0) scale(1.1)';
    setTimeout(()=>{box.style.transform='translateX(calc(100vw - 220px)) translateY(0) scale(1)';},250);
  },350);
}

// 设置/更新操作模式
function setOperationMode(mode){
  operationMode=mode;const box=document.getElementById('operationBox');
  box.classList.remove('copy-mode','move-mode','delete-mode');box.classList.add(mode+'-mode');
  updateOperationModeButtons();
}
function updateOperationModeButtons(){
  document.querySelectorAll('.operation-action-btn').forEach(btn=>btn.classList.remove('active'));
  document.querySelector(`.operation-action-btn.${operationMode}`).classList.add('active');
}

// 循环切换操作模式（带弹跳）
function cycleOperationMode(){
  const modes=['copy','move','delete'];
  setOperationMode(modes[(modes.indexOf(operationMode)+1)%3]);
  const box=document.getElementById('operationBox');
  box.style.transition='transform .25s cubic-bezier(.34,1.56,.64,1)';
  box.style.transform='translateX(calc(100vw - 220px)) translateY(0) scale(1.1)';
  setTimeout(()=>{box.style.transform='translateX(calc(100vw - 220px)) translateY(0) scale(1)';},250);
}

// 执行操作（带动画）
async function executeOperation(targetPath,targetDir){
  if(operationItems.length===0)return;
  const fullTargetPath=expandPath(targetPath);
  const box=document.getElementById('operationBox');
  const content=box.querySelector('.operation-box-content');
  const items=content.querySelectorAll('.operation-box-item');
  // 盒子内元素依次向左滑出
  items.forEach((item,i)=>{setTimeout(()=>{item.style.transition='all .3s ease-out';item.style.opacity='0';item.style.transform='translateX(-150px)';},i*60);});
  // 盒子向右滑出
  setTimeout(()=>{box.style.transition='all .35s cubic-bezier(.34,1.56,.64,1)';box.style.opacity='0';box.style.transform='translateX(150px)';},items.length*60+100);
  await new Promise(r=>setTimeout(r,items.length*60+450));
  try{
    const savedExpanded=JSON.parse(localStorage.getItem('expandedPaths')||'{}');
    if(operationMode==='delete'||operationMode==='move'){
      for(const item of operationItems){const treeItem=document.querySelector(`.tree-item[data-path="${item.path}"]`);if(treeItem){treeItem.style.transition='all .3s ease-out';treeItem.style.opacity='0';treeItem.style.transform='translateX(-60px)';setTimeout(()=>treeItem.remove(),300);}delete savedExpanded[item.path];}
    }
    if(operationMode==='delete'){for(const item of operationItems) await apiExec(`rm -rf "${expandPath(item.path)}"`);}
    else{const cmd=operationMode==='copy'?'cp -r':'mv';for(const item of operationItems){const itemPath=expandPath(item.path);if(operationMode==='move'&&item.isDir&&fullTargetPath.startsWith(itemPath+'/')){showToast('错误：不能移动文件夹到其子文件夹');return;}await apiExec(`${cmd} "${itemPath}" "${fullTargetPath}/"`);}}
    if(targetDir&&operationMode!=='delete'){savedExpanded[targetDir]=true;localStorage.setItem('expandedPaths',JSON.stringify(savedExpanded));await refreshTargetFolder(targetDir);}
    else localStorage.setItem('expandedPaths',JSON.stringify(savedExpanded));
    exitEditMode();
  }catch(e){showToast('操作失败：'+e.message);}
}

// 刷新目标文件夹
async function refreshTargetFolder(dirPath){
  if(!dirPath){await renderTree();return;}
  const targetItem=document.querySelector(`.tree-item[data-path="${dirPath}"]`);
  if(!targetItem){await renderTree();return;}
  let wrap=targetItem.querySelector('.tree-children-wrap');
  if(!wrap){const toggle=targetItem.querySelector('.tree-toggle');if(toggle)toggle.click();return;}
  let inner=wrap.querySelector('div');let childrenWrap=inner?inner.querySelector('div'):null;
  if(!childrenWrap){const toggle=targetItem.querySelector('.tree-toggle');if(wrap.classList.contains('open')&&toggle){toggle.click();setTimeout(()=>{toggle.click();},200);}else if(toggle)toggle.click();return;}
  if(!wrap.classList.contains('open')){wrap.classList.add('open');const toggle=targetItem.querySelector('.tree-toggle');if(toggle)toggle.classList.add('expanded');}
  childrenWrap.innerHTML='';
  const currentDepth=calculateDepth(targetItem);
  await renderTree(childrenWrap,dirPath,currentDepth+1);
  addSlideInAnimation(childrenWrap);
}
function calculateDepth(item){let depth=0;let parent=item.parentElement;while(parent){if(parent.classList.contains('tree-children')||parent.classList.contains('tree-children-wrap'))depth++;parent=parent.parentElement;}return Math.floor(depth/2);}
function addSlideInAnimation(container){if(!container)return;container.querySelectorAll('.tree-item').forEach((el,i)=>{el.style.opacity='0';el.style.transform='translateX(30px)';setTimeout(()=>{el.style.transition='all .25s ease-out';el.style.opacity='1';el.style.transform='translateX(0)';},i*30+50);});}

// 退出按钮事件
document.getElementById('editModeExit').addEventListener('click',exitEditMode);

// 盒子手势：上滑进入操作/切换颜色，下滑回到选择
let boxTouchStartY=0;let boxGestureTriggered=false;
const gestureArea=document.getElementById('overlay');
gestureArea.addEventListener('touchstart',e=>{if(!editMode)return;boxTouchStartY=e.touches[0].clientY;boxGestureTriggered=false;},{passive:true});
gestureArea.addEventListener('touchmove',e=>{
  if(!editMode||boxGestureTriggered)return;
  const box=document.getElementById('operationBox');if(!box.classList.contains('show'))return;
  const dy=e.touches[0].clientY-boxTouchStartY;
  const isSelecting=box.classList.contains('selecting');const isOperating=box.classList.contains('operating');
  if(isSelecting&&dy<-60){boxGestureTriggered=true;enterOperatingMode();}
  else if(isOperating&&dy>60){boxGestureTriggered=true;box.classList.remove('operating','copy-mode','move-mode','delete-mode');box.classList.add('selecting');document.getElementById('operationActions').classList.remove('show');}
  else if(isOperating&&dy<-60){boxGestureTriggered=true;cycleOperationMode();}
},{passive:true});

// overlay左右滑手势
let execTouchStartX=0;let execGestureTriggered=false;
document.getElementById('overlay').addEventListener('touchstart',e=>{if(!editMode)return;execTouchStartX=e.touches[0].clientX;execGestureTriggered=false;},{passive:true});
document.getElementById('overlay').addEventListener('touchmove',e=>{
  if(!editMode||execGestureTriggered)return;
  const box=document.getElementById('operationBox');if(!box.classList.contains('show'))return;
  const dx=e.touches[0].clientX-execTouchStartX;
  if(box.classList.contains('selecting')&&dx<-80){execGestureTriggered=true;exitToSidebar();return;}
  if(!box.classList.contains('operating'))return;
  if(Math.abs(dx)>80){
    let targetPath;let targetDir='';
    if(!selectedFile)targetPath='/data/data/com.termux/files/home';
    else{const selectedItem=document.querySelector('.tree-item.selected');const isDir=selectedItem?.querySelector('.tree-toggle:not(.hidden)');if(isDir){targetPath=expandPath(selectedFile);targetDir=selectedFile;}else{const parts=selectedFile.split('/');parts.pop();targetPath=expandPath(parts.join('/'));targetDir=parts.join('/');}}
    executeOperation(targetPath,targetDir);
  }
},{passive:true});