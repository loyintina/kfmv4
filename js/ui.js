// ========== UI控制（侧栏、导航） ==========

// 显示/隐藏文件
function toggleHidden(){showHidden=!showHidden;document.getElementById('toggleHiddenBtn').classList.toggle('active',showHidden);renderTree();}

// 导航
function navigateToHome(){
  document.getElementById('homePage').style.display='block';
  closeSidebar();
}

// 光标位置记忆键
const CURSOR_POS_KEY='kfm_cursor_position';

// 光标高亮条（独立元素）
let cursorHighlight=null;

// 初始化光标高亮条
function initCursorHighlight(){
  if(cursorHighlight)return;
  
  const container=document.querySelector('.sidebar-content');
  if(!container)return;
  
  cursorHighlight=document.createElement('div');
  cursorHighlight.className='cursor-highlight';
  cursorHighlight.style.top='0px';
  container.appendChild(cursorHighlight);
}

// 更新光标高亮条位置
function updateCursorHighlight(){
  if(!cursorHighlight)initCursorHighlight();
  
  const selected=document.querySelector('.tree-item.selected');
  if(!selected){
    cursorHighlight.style.opacity='0';
    return;
  }
  
  const row=selected.querySelector('.tree-row')||selected;
  const container=document.querySelector('.sidebar-content');
  const containerRect=container.getBoundingClientRect();
  const rowRect=row.getBoundingClientRect();
  
  // 计算相对于容器的位置
  const top=rowRect.top-containerRect.top+container.scrollTop;
  cursorHighlight.style.top=top+'px';
  cursorHighlight.style.opacity='1';
  cursorHighlight.style.height=rowRect.height+'px';
}

// 侧栏
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  
  // 初始化并恢复光标位置
  setTimeout(()=>{
    initCursorHighlight();
    restoreCursorPosition();
  },100);
}

function closeSidebar(){
  // 保存光标位置
  saveCursorPosition();
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// 保存光标位置
function saveCursorPosition(){
  const selected=document.querySelector('.tree-item.selected');
  if(selected){
    const items=document.querySelectorAll('#fileTree .tree-item');
    let index=-1;
    items.forEach((item,i)=>{if(item===selected)index=i;});
    if(index!==-1){
      localStorage.setItem(CURSOR_POS_KEY,JSON.stringify({index,timestamp:Date.now()}));
    }
  }
}

// 恢复光标位置
function restoreCursorPosition(){
  const items=document.querySelectorAll('#fileTree .tree-item');
  if(items.length===0)return;
  
  // 清除旧选中
  document.querySelectorAll('.tree-item.selected').forEach(el=>el.classList.remove('selected'));
  
  // 尝试恢复保存的位置
  let targetIndex=-1;
  try{
    const saved=JSON.parse(localStorage.getItem(CURSOR_POS_KEY));
    if(saved&&saved.index>=0&&saved.index<items.length){
      targetIndex=saved.index;
    }
  }catch(e){}
  
  // 首次打开或无效位置：光标放在中间
  if(targetIndex===-1){
    targetIndex=Math.floor(items.length/2);
  }
  
  // 设置选中（无动画）
  items[targetIndex].classList.add('selected');
  selectedFile=items[targetIndex].dataset.path;
  
  // 更新光标高亮条位置
  updateCursorHighlight();
  centerCursorToView(items[targetIndex]);
}

// 光标居中显示
function centerCursorToView(item){
  const sidebarContent=document.querySelector('.sidebar-content');
  const containerRect=sidebarContent.getBoundingClientRect();
  const treeRow=item.querySelector('.tree-row')||item;
  const rowRect=treeRow.getBoundingClientRect();
  const rowCenter=rowRect.top+rowRect.height/2;
  const containerCenter=containerRect.top+containerRect.height/2;
  const scrollOffset=rowCenter-containerCenter;
  sidebarContent.scrollTop+=scrollOffset;
}

// overlay 点击 - 已移至 gestures.js 的 touchend 处理
// 注意：移动端会同时触发 touchend 和 click，为避免重复执行，这里不再监听 click
document.getElementById('overlay').addEventListener('click',(e)=>{
  // 光标动作由 gestures.js 的 touchend 处理
});