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

// 侧栏
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  
  // 恢复光标位置
  setTimeout(()=>{
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
  try{
    const saved=JSON.parse(localStorage.getItem(CURSOR_POS_KEY));
    if(saved&&saved.index>=0&&saved.index<items.length){
      items[saved.index].classList.add('selected');
      selectedFile=items[saved.index].dataset.path;
      centerCursorToView(items[saved.index]);
      return;
    }
  }catch(e){}
  
  // 首次打开或无效位置：光标放在中间
  const middleIndex=Math.floor(items.length/2);
  items[middleIndex].classList.add('selected');
  selectedFile=items[middleIndex].dataset.path;
  centerCursorToView(items[middleIndex]);
}

// overlay 点击 - 已移至 gestures.js 的 touchend 处理
// 注意：移动端会同时触发 touchend 和 click，为避免重复执行，这里不再监听 click
document.getElementById('overlay').addEventListener('click',(e)=>{
  // 光标动作由 gestures.js 的 touchend 处理
});