// ========== 文件树加载与渲染 ==========

// 动画系统缓存
const heightCache={};
const newAnimThreshold=5;
const newAnimChildCount=4;
function shouldUseNewAnim(depth,childCount){return depth>=newAnimThreshold && childCount>newAnimChildCount;}
async function cacheChildrenHeight(path,childrenWrap,depth){
  if(heightCache[path])return heightCache[path];
  const items=await loadTree(path);
  let totalHeight=0;
  for(const item of items){totalHeight+=32;if(item.isDir)totalHeight+=28;}
  heightCache[path]=totalHeight;
  return totalHeight;
}
async function precacheAllHeights(path,depth){
  if(depth<newAnimThreshold)return;
  const items=await loadTree(path);
  for(const item of items){if(item.isDir){await cacheChildrenHeight(item.path,null,depth+1);await precacheAllHeights(item.path,depth+1);}}
}

// 新动画系统：展开
async function newAnimOpen(item,div,wrap,childrenWrap,row,toggle,depth,itemPath,isFirstLoad){
  wrap.classList.add('open','loading');
  await precacheAllHeights(itemPath,depth);
  if(isFirstLoad) await renderTree(childrenWrap,itemPath,depth+1);
  wrap.classList.remove('loading');
  const children=childrenWrap.querySelectorAll(':scope > .tree-item');
  children.forEach((child,i)=>{
    child.style.opacity='0';child.style.transform='translateY(-10px)';
    setTimeout(()=>{
      child.style.transition='transform .3s cubic-bezier(.34,1.56,.64,1),opacity .2s';
      child.style.opacity='1';child.style.transform='translateY(0)';
      setTimeout(()=>{child.style.transform='translateY(-2px)';setTimeout(()=>{child.style.transform='';},100);},300);
    },i*30);
  });
}

// 新动画系统：收起
function newAnimClose(div,wrap,childrenWrap,depth){
  const children=childrenWrap.querySelectorAll(':scope > .tree-item');
  children.forEach((child)=>{child.style.transition='opacity .2s,transform .2s';child.style.opacity='0';child.style.transform='translateY(-10px)';});
  setTimeout(()=>{childrenWrap.innerHTML='';wrap.classList.remove('open');},250);
}

// 加载文件列表 - 使用 REST API
async function loadTree(path=''){
  let targetPath = path || '/root';
  if(targetPath.startsWith('~')) targetPath = '/root' + (targetPath.length > 1 ? targetPath.slice(1) : '');
  
  try {
    const res = await fetch(API+'/files/list', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({path: targetPath, showHidden})
    });
    const data = await res.json();
    if(data.error) return [];    
    const items = data.items.map(item => ({
      name: item.name,
      isDir: item.isDir,
      isLink: false,
      path: item.path
    }));
    updateCacheDir(targetPath, items);
    return items;
  } catch(e) {
    console.error('loadTree error:', e);
    return [];
  }
}

// 渲染文件树
async function renderTree(container=document.getElementById('fileTree'),path='',depth=0){
  let savedPath=null;
  if(depth===0){
    // 保存光标状态
    const savedSelected=document.querySelector('.tree-item.selected');
    savedPath=savedSelected?.dataset?.path||null;
    container.innerHTML='<div class="loading-pulse"><div class="pulse-row"></div><div class="pulse-row"></div><div class="pulse-row"></div></div>';}
  const items=await loadTree(path);
  container.innerHTML='';
  const frag=document.createDocumentFragment();
  for(const item of items){
    const div=document.createElement('div');
    div.className='tree-item';div.dataset.path=item.path;
    const row=document.createElement('div');row.className='tree-row';
    const toggle=document.createElement('span');
    toggle.className='tree-toggle'+(expandedPaths[item.path]?' expanded':'');
    if(!item.isDir)toggle.classList.add('hidden');
    const name=document.createElement('span');
    name.className='tree-name'+(item.isLink?' link':'');
    name.textContent=item.name+(item.isLink?' →':'');
    row.append(toggle,name);div.appendChild(row);

    // 子目录容器
    const wrap=document.createElement('div');wrap.className='tree-children-wrap';
    const maxDepth=6;const depthRatio=Math.min(depth/maxDepth,1);
    const opacity=0.15+depthRatio*0.85;
    const bgTop=`rgba(124,58,237,${0.01+depthRatio*0.1})`;
    const bgBot=`rgba(124,58,237,${0.06+depthRatio*0.25})`;
    wrap.style.borderColor=`rgba(124,58,237,${opacity})`;
    const inner=document.createElement('div');
    inner.style.background=`linear-gradient(to bottom,${bgTop},${bgBot})`;
    const childrenWrap=document.createElement('div');
    if(expandedPaths[item.path]){wrap.classList.add('open');toggle.classList.add('expanded');}
    wrap.appendChild(inner);inner.appendChild(childrenWrap);div.appendChild(wrap);
    frag.appendChild(div);

    // 预加载已展开的子目录
    if(expandedPaths[item.path] && item.isDir) renderTree(childrenWrap,item.path,depth+1);

    // 右滑进入编辑模式
    let touchStartX=0,touchStartY=0;
    let rowMoved=false;
    row.addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;rowMoved=false;},{passive:true});
    let rowSwiped=false;
    row.addEventListener('touchmove',e=>{
      if(rowSwiped)return;
      const dx=e.touches[0].clientX-touchStartX;
      const dy=e.touches[0].clientY-touchStartY;
      if(Math.abs(dx)>10||Math.abs(dy)>10)rowMoved=true;
    },{passive:true});
    row.addEventListener('touchend',()=>{rowSwiped=false;},{passive:true});

    // 点击事件 - 移动光标 或 展开收起
    row.addEventListener('click',async(e)=>{
      const isCurrentlySelected=div.classList.contains('selected');
      
      if(isCurrentlySelected){
        // 点击已选中项：如果是文件夹，展开/收起
        if(item.isDir){
          const isOpen=wrap.classList.contains('open');
          if(!isOpen&&!childrenWrap.querySelector('.tree-item')){
            await renderTree(childrenWrap,item.path,depth+1);
          }
          wrap.classList.toggle('open');
          toggle.classList.toggle('expanded');
          expandedPaths[item.path]=!isOpen;
          localStorage.setItem('expandedPaths',JSON.stringify(expandedPaths));
          
          // 叠叠乐动画
          const doBounce=(el,dir,delay)=>{
            setTimeout(()=>{
              const offset=dir?-10:10;const rebound=dir?2:-2;
              el.style.transition='transform .3s cubic-bezier(.34,1.56,.64,1)';
              el.style.transform='translateY('+offset+'px)';
              setTimeout(()=>{el.style.transform='translateY('+rebound+'px)';},320);
              setTimeout(()=>{el.style.transform='';el.style.transition='';},450);
            },delay);
          };
          if(isOpen){
            doBounce(div,true,0);
            let sibling=div.nextElementSibling;let i=1;
            while(sibling){if(sibling.classList.contains('tree-item')){doBounce(sibling,true,(i-1)*20);i++;}sibling=sibling.nextElementSibling;}
          }else{
            doBounce(div,false,0);
            let sibling=div.nextElementSibling;let i=1;
            while(sibling){if(sibling.classList.contains('tree-item')){doBounce(sibling,false,(i-1)*20);i++;}sibling=sibling.nextElementSibling;}
          }
          
          // 光标跟随盒子跳动（传入兄弟数量以计算同步时长）
          let sc=0;{let s=div.nextElementSibling;while(s){if(s.classList.contains('tree-item'))sc++;s=s.nextElementSibling;}}
          syncCursorDuringBounce(sc);
        }
      }else{
        // 点击非选中项：移动光标（选中）
        const prevSelected=document.querySelector('.tree-item.selected');
        if(prevSelected)prevSelected.classList.remove('selected');
        div.classList.add('selected');
        selectedFile=item.path;
        
        // 更新光标高亮条位置（触发平滑动画）
        updateCursorHighlight();
      }
      
      e.stopPropagation();
    });
  }
  container.appendChild(frag);
  
  // 恢复选中状态（仅根层渲染后）
  if(depth===0 && savedPath){
    const newItem=document.querySelector(`.tree-item[data-path="${savedPath}"]`);
    if(newItem){
      newItem.classList.add('selected');
      resetCursorHighlight();
      updateCursorHighlight(true);
    }
  }
}

function refreshTree(){renderTree();}