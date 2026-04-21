// ========== UI控制（侧栏、命令栏、导航、工具栏） ==========

// 全部展开/收起
function expandAll(){document.querySelectorAll('.tree-children-wrap').forEach(el=>{el.classList.add('open');const t=el.previousElementSibling?.querySelector('.tree-toggle');if(t)t.classList.add('expanded');});}
function collapseAll(){document.querySelectorAll('.tree-children-wrap').forEach(el=>{el.classList.remove('open');const t=el.previousElementSibling?.querySelector('.tree-toggle');if(t)t.classList.remove('expanded');});}
function toggleExpand(){allExpanded=!allExpanded;if(allExpanded)expandAll();else collapseAll();}

// 显示/隐藏文件
function toggleHidden(){showHidden=!showHidden;document.getElementById('toggleHiddenBtn').classList.toggle('active',showHidden);renderTree();}

// 新建文件/文件夹
function createNewFile(){createNewItem(getTargetPath(),false);}
function createNewFolder(){createNewItem(getTargetPath(),true);}

function getTargetPath(){
  if(!selectedFile)return '/data/data/com.termux/files/home';
  const selectedItem=document.querySelector('.tree-item.selected');
  if(!selectedItem)return '/data/data/com.termux/files/home';
  const isDir=selectedItem.querySelector('.tree-toggle:not(.hidden)');
  if(isDir) return expandPath(selectedFile);
  const parts=selectedFile.split('/');parts.pop();
  return expandPath(parts.join('/'));
}

function createNewItem(parentPath,isDir){
  const container=findContainerByPath(parentPath);
  if(!container)return;
  
  // 创建编辑框（使用 fixed 定位，宽度固定为 sidebar 宽度）
  const inputWrap=document.createElement('div');inputWrap.className='tree-input-wrap tree-input-overlay';
  const input=document.createElement('input');input.className='tree-input';input.placeholder=isDir?'文件夹名':'文件名（含后缀）';
  const confirmBtn=document.createElement('button');confirmBtn.className='tree-input-btn confirm';confirmBtn.textContent='✓';
  const cancelBtn=document.createElement('button');cancelBtn.className='tree-input-btn cancel';cancelBtn.textContent='×';
  inputWrap.append(input,confirmBtn,cancelBtn);
  
  // 计算位置（添加到 container 第一个子元素上方）
  const firstChild=container.querySelector('.tree-item');
  const sidebar=document.getElementById('sidebar');
  const sidebarRect=sidebar.getBoundingClientRect();
  let initialTop=sidebarRect.top+50;
  if(firstChild){
    const rect=firstChild.getBoundingClientRect();
    initialTop=rect.top;
  }
  inputWrap.style.left=sidebarRect.left+8+'px';
  inputWrap.style.width=(sidebarRect.width-16)+'px';
  document.body.appendChild(inputWrap);
  
  // 更新位置的函数（处理键盘弹出）
  const updatePosition=()=>{
    const keyboardHeight=window.innerHeight-(window.visualViewport?.height||window.innerHeight);
    const safeTop=Math.min(initialTop,window.innerHeight-keyboardHeight-50);
    inputWrap.style.top=Math.max(10,safeTop)+'px';
  };
  updatePosition();
  
  // 监听视口变化（键盘弹出）
  const viewportHandler=()=>updatePosition();
  window.visualViewport?.addEventListener('resize',viewportHandler);
  window.visualViewport?.addEventListener('scroll',viewportHandler);
  window.addEventListener('resize',viewportHandler);
  
  input.focus();
  
  // 阻止编辑框事件冒泡
  inputWrap.addEventListener('click',e=>e.stopPropagation());
  inputWrap.addEventListener('touchstart',e=>e.stopPropagation());
  
  const cleanup=()=>{
    window.visualViewport?.removeEventListener('resize',viewportHandler);
    window.visualViewport?.removeEventListener('scroll',viewportHandler);
    window.removeEventListener('resize',viewportHandler);
    inputWrap.remove();
  };
  const confirm=async()=>{
    const name=input.value.trim();
    if(!name)return cleanup();
    const fullPath=parentPath+'/'+name;
    const cmd=isDir?`mkdir -p "${fullPath}"`:`touch "${fullPath}"`;
    const result=await apiExec(cmd);
    if(result.error){
      alert('创建失败：'+result.error);
    }else{
      cleanup();
      renderTree();
    }
  };
  const cancel=cleanup;
  confirmBtn.onclick=confirm;cancelBtn.onclick=cancel;
  input.onkeypress=(e)=>{if(e.key==='Enter')confirm();if(e.key==='Escape')cancel();};
}

function findContainerByPath(path){
  if(path==='/data/data/com.termux/files/home') return document.getElementById('fileTree');
  const item=document.querySelector(`.tree-item[data-path="${path}"]`);
  if(!item)return null;
  const wrap=item.querySelector('.tree-children-wrap');
  return wrap?wrap.querySelector('div'):null;
}

// 重命名
function renameSelected(){
  if(!selectedFile)return alert('请先选择文件或文件夹');
  const item=document.querySelector('.tree-item.selected');if(!item)return;
  const row=item.querySelector('.tree-row');const nameSpan=row.querySelector('.tree-name');
  const oldName=nameSpan.textContent.replace(' →','');
  const isLink=nameSpan.classList.contains('link');
  const oldPath=selectedFile; // 保存完整旧路径
  
  // 创建编辑框（使用 fixed 定位覆盖整行，宽度固定为 sidebar 宽度）
  const inputWrap=document.createElement('div');inputWrap.className='tree-input-wrap tree-input-overlay';
  const input=document.createElement('input');input.className='tree-input';input.value=oldName;
  const confirmBtn=document.createElement('button');confirmBtn.className='tree-input-btn confirm';confirmBtn.textContent='✓';
  const cancelBtn=document.createElement('button');cancelBtn.className='tree-input-btn cancel';cancelBtn.textContent='×';
  inputWrap.append(input,confirmBtn,cancelBtn);
  
  // 计算位置并添加到 body
  const sidebar=document.getElementById('sidebar');
  const sidebarRect=sidebar.getBoundingClientRect();
  const sidebarContent=document.querySelector('.sidebar-content');
  
  inputWrap.style.left=sidebarRect.left+8+'px';
  inputWrap.style.width=(sidebarRect.width-16)+'px';
  document.body.appendChild(inputWrap);
  
  // 更新位置的函数（处理键盘弹出）+ 同步滚动
  const updatePosition=()=>{
    const keyboardHeight=window.innerHeight-(window.visualViewport?.height||window.innerHeight);
    const editBoxHeight=44;
    const editBoxTop=Math.max(10,window.innerHeight-keyboardHeight-editBoxHeight-10);
    inputWrap.style.top=editBoxTop+'px';
    
    // 始终滚动文件树，让选中项显示在编辑框正上方 10px 处
    const rowRect=row.getBoundingClientRect();
    const targetTop=editBoxTop-36-10; // 编辑框上方 10px，36px 是行高
    const scrollDiff=rowRect.top-targetTop;
    sidebarContent.scrollTop+=scrollDiff;
  };
  
  // 初始定位
  setTimeout(updatePosition,50);
  
  // 监听视口变化（键盘弹出）
  const viewportHandler=()=>updatePosition();
  window.visualViewport?.addEventListener('resize',viewportHandler);
  window.visualViewport?.addEventListener('scroll',viewportHandler);
  window.addEventListener('resize',viewportHandler);
  
  // 隐藏原名
  nameSpan.style.visibility='hidden';
  input.focus();input.select();
  
  // 阻止编辑框事件冒泡
  inputWrap.addEventListener('click',e=>e.stopPropagation());
  inputWrap.addEventListener('touchstart',e=>e.stopPropagation());
  
  const cleanup=()=>{
    window.visualViewport?.removeEventListener('resize',viewportHandler);
    window.visualViewport?.removeEventListener('scroll',viewportHandler);
    window.removeEventListener('resize',viewportHandler);
    inputWrap.remove();nameSpan.style.visibility='';
  };
  const confirm=async()=>{
    const newName=input.value.trim();
    if(!newName||newName===oldName)return cleanup();
    const parts=selectedFile.split('/');parts.pop();
    const newPath=parts.join('/')+'/'+newName;
    
    // 展开路径：~/ 转换为完整路径
    const fullOldPath=expandPath(oldPath);
    const fullNewPath=expandPath(newPath);
    
    console.log('重命名:', {oldPath, newPath, fullOldPath, fullNewPath, oldName, newName});
    const cmd=`mv "${fullOldPath}" "${fullNewPath}"`;
    console.log('执行命令:', cmd);
    
    const result=await apiExec(cmd);
    console.log('API结果:', result);
    
    if(result.error || result.stderr){
      alert('重命名失败：'+(result.error||result.stderr));
      cleanup();
    }else{
      // 局部更新：只修改当前节点和子节点的路径
      selectedFile=newPath;
      item.dataset.path=newPath;
      nameSpan.textContent=newName+(isLink?' →':'');
      
      // 更新子节点的 data-path
      updateChildPathsByPrefix(item,oldPath,newPath);
      
      // 更新 expandedPaths 缓存
      for(const path in expandedPaths){
        if(path.startsWith(oldPath)){
          const newKey=path.replace(oldPath,newPath);
          expandedPaths[newKey]=expandedPaths[path];
          delete expandedPaths[path];
        }
      }
      localStorage.setItem('expandedPaths',JSON.stringify(expandedPaths));
      
      console.log('重命名成功！');
      cleanup();
    }
  };
  const cancel=cleanup;
  confirmBtn.onclick=confirm;cancelBtn.onclick=cancel;
  input.onkeypress=(e)=>{if(e.key==='Enter')confirm();if(e.key==='Escape')cancel();};
}

// 辅助函数：通过路径前缀匹配更新子节点的 data-path
function updateChildPathsByPrefix(item,oldPath,newPath){
  const children=item.querySelectorAll('.tree-item');
  children.forEach(child=>{
    const childPath=child.dataset.path;
    if(childPath && childPath.startsWith(oldPath)){
      child.dataset.path=childPath.replace(oldPath,newPath);
    }
  });
}

// 导航
function navigateToHome(){
  document.getElementById('homePage').style.display='block';
  document.getElementById('previewPage').classList.remove('show');
  document.getElementById('editorPage').classList.remove('show');
  closeSidebar();
}

// 侧栏
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('overlay').classList.add('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('show');}

// overlay 点击 - 已移至 gestures.js 的 touchend 处理
// 注意：移动端会同时触发 touchend 和 click，为避免重复执行，这里不再监听 click
document.getElementById('overlay').addEventListener('click',(e)=>{
  if(editMode)return;
  // 不做任何操作，光标动作由 gestures.js 的 touchend 处理
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