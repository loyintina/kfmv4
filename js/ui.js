// ========== UI控制（侧栏、导航） ==========

// 显示/隐藏文件
function toggleHidden(){showHidden=!showHidden;document.getElementById('toggleHiddenBtn').classList.toggle('active',showHidden);renderTree();}

// 导航
function navigateToHome(){
  document.getElementById('homePage').style.display='block';
  document.getElementById('previewPage').classList.remove('show');
  closeSidebar();
}

// 侧栏
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').classList.add('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('show');}

// overlay 点击 - 已移至 gestures.js 的 touchend 处理
// 注意：移动端会同时触发 touchend 和 click，为避免重复执行，这里不再监听 click
document.getElementById('overlay').addEventListener('click',(e)=>{
  // 光标动作由 gestures.js 的 touchend 处理
});

// 预览
async function previewFile(path){
  document.getElementById('homePage').style.display='none';
  document.getElementById('previewPage').classList.add('show');
  document.getElementById('previewFilename').textContent=path.split('/').pop();
  document.getElementById('previewContent').textContent='';
  const result=await apiExec('cat "'+path+'"');
  document.getElementById('previewContent').textContent=result.stdout||result.stderr||'(空文件)';
  closeSidebar();
}