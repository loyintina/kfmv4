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
  if(depth===0)container.innerHTML='<div class="loading-pulse"><div class="pulse-row"></div><div class="pulse-row"></div><div class="pulse-row"></div></div>';
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

    // 点击事件
    row.addEventListener('click',(e)=>{
      const now=Date.now();
      const suppress=suppressUntil||0;
      const skip=skipNextClick||false;
      console.log('CLICK DEBUG:', {path:item.path, isDir:item.isDir, rowMoved, skip, suppressActive:now<suppress, suppressNow:now, suppressUntil:suppress});
      
      if(skip){
        console.log('click skipped: after initCursorToFirst');
        return;
      }
      if(rowMoved){
        console.log('click blocked: rowMoved=true');
        return;
      }
      if(now<suppress){
        console.log('click suppressed after swipe');
        return;
      }
      console.log('tree.js click:', item.path, 'isDir:', item.isDir);
      e.stopPropagation();
      
      // 检查是否点击的是当前光标所在项
      const currentSelected=document.querySelector('.tree-item.selected');
      const isCurrentSelected=(currentSelected===div);
      
      // 先移动光标到点击位置
      document.querySelectorAll('.tree-item').forEach(el=>el.classList.remove('selected'));
      div.classList.add('selected');
      selectedFile=item.path;
      
      // 只有点击的是当前光标所在项，才执行动作
      if(!isCurrentSelected){
        // 只是移动光标，不执行展开/打开动作
        return;
      }
      
      // 以下是原有动作逻辑
      // 正常模式
      if(item.isDir){
        console.log('文件夹点击处理:', item.path, '当前状态:', wrap.classList.contains('open')?'展开':'收起');
        const isOpen=wrap.classList.contains('open');
        if(!isOpen && !childrenWrap.querySelector('.tree-item')) renderTree(childrenWrap,item.path,depth+1);
        wrap.classList.toggle('open');toggle.classList.toggle('expanded');
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
          while(sibling){doBounce(sibling,true,(i-1)*20);sibling=sibling.nextElementSibling;i++;}
        }else{
          doBounce(div,false,0);
          let sibling=div.nextElementSibling;let i=1;
          while(sibling){doBounce(sibling,false,(i-1)*20);sibling=sibling.nextElementSibling;i++;}
        }
      }else{
        // 文件：无动作
      }
    });
  }
  container.appendChild(frag);
}

function refreshTree(){renderTree();}