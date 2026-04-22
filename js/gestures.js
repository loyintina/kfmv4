// ========== 摇杆光标系统 ==========
let joystickActive=false;   // 摇杆是否激活
let joystickOffset=0;        // 当前Y偏移量（负=手指上移=光标下移）
let joystickRafId=null;      // requestAnimationFrame ID
let joystickAccum=0;         // 累积偏移（用于离散化步进）
const JOYSTICK_DEADZONE=15;   // 死区（px）
const JOYSTICK_SENSITIVITY=80; // 每80px偏移 = 1格/秒的速度基数

function joystickTick(){
  if(!joystickActive)return;
  
  // 计算速度：偏移量 / 灵敏度 = 格/秒
  const normalizedOffset=joystickOffset;
  if(Math.abs(normalizedOffset)<=JOYSTICK_DEADZONE){
    joystickRafId=requestAnimationFrame(joystickTick);
    return;
  }
  
  // 速度 = 偏移量 / 灵敏度 * 一帧的时间占比
  // 偏移越大速度越快，使用平方让手感更自然
  const sign=normalizedOffset>0?1:-1;
  const absOffset=Math.abs(normalizedOffset)-JOYSTICK_DEADZONE;
  const speed=sign*(absOffset/JOYSTICK_SENSITIVITY); // 格/60fps
  
  // 累积
  joystickAccum+=speed;
  
  // 累积超过1格时移动光标
  if(Math.abs(joystickAccum)>=1){
    const steps=Math.trunc(joystickAccum);
    joystickAccum-=steps;
    
    // 移动光标（正=手指下移=光标上移，负=手指上移=光标下移）
    moveCursorBySteps(-steps);
  }
  
  joystickRafId=requestAnimationFrame(joystickTick);
}

function moveCursorBySteps(steps){
  if(steps===0)return;
  const items=document.querySelectorAll('#fileTree .tree-item');
  if(!items.length)return;
  
  const currentSelected=document.querySelector('.tree-item.selected');
  let currentIndex=0;
  items.forEach((item,i)=>{if(item===currentSelected)currentIndex=i;});
  
  const targetIndex=Math.min(Math.max(currentIndex+steps,0),items.length-1);
  if(targetIndex===currentIndex)return;
  
  // 更新选中状态
  if(currentSelected)currentSelected.classList.remove('selected');
  items[targetIndex].classList.add('selected');
  selectedFile=items[targetIndex].dataset.path;
  
  // 光标动画（复用已有过渡）
  updateCursorHighlight();
  updateSidebarPath(items[targetIndex]);
  
  // 摇杆模式下光标自动居中
  if(joystickActive){
    centerCursorToView(items[targetIndex]);
  }
}

function startJoystick(){
  joystickActive=true;
  joystickAccum=0;
  joystickTick();
}

function stopJoystick(){
  joystickActive=false;
  joystickAccum=0;
  if(joystickRafId){
    cancelAnimationFrame(joystickRafId);
    joystickRafId=null;
  }
}

document.addEventListener('touchstart',(e)=>{
  touchStartX=e.touches[0].clientX;
  touchStartY=e.touches[0].clientY;
  touchStarted=true;
  pullDownTriggered=false;
  hasMoved=false;
  
  // 判断是否在左栏右侧区域
  const sidebarOpen=document.getElementById('sidebar').classList.contains('open');
  if(sidebarOpen){
    const sidebarRect=document.getElementById('sidebar').getBoundingClientRect();
    if(touchStartX > sidebarRect.right){
      cursorMode=true; // 进入光标模式
    } else {
      cursorMode=false;
    }
  } else {
    cursorMode=false;
  }
},{passive:true});

document.addEventListener('touchmove',(e)=>{
  if(!touchStarted){
    console.log('touchmove: touchStarted false');
    return;
  }
  const currentX=e.touches[0].clientX;
  const currentY=e.touches[0].clientY;
  const dx=currentX-touchStartX;
  const dy=currentY-touchStartY;

  // 光标模式优先处理（摇杆模式）
  if(cursorMode){
    // 在光标模式下，左滑关闭左栏（优先级最高）
    if(dx<-60){
      hasMoved=true;
      stopJoystick();
      closeSidebar();
      touchStarted=false;
      return;
    }
    
    // 摇杆模式：手指偏移量 = 速度
    if(Math.abs(dy)>JOYSTICK_DEADZONE){
      if(!hasMoved){
        hasMoved=true;
        startJoystick();
      }
      joystickOffset=dy; // 正=手指下移=光标上移，负=手指上移=光标下移
    }else if(hasMoved){
      joystickOffset=0; // 回到死区，速度归零
    }
    return;
  }

  // 获取当前可滚动元素
  const mainEl=document.getElementById('main');
  const scrollTop=mainEl.scrollTop;
  const canScrollUp=scrollTop===0;

  // 下拉手势已禁用（命令行面板已删除）
  const sidebarOpen=document.getElementById('sidebar').classList.contains('open');
  const logOpen=document.getElementById('logPanel')?.classList.contains('open');

  // 左栏打开时，左滑收起
  if(document.getElementById('sidebar').classList.contains('open')){
    if(dx<-60){
      closeSidebar();
      touchStarted=false;
      return;
    }
  }

  // 日志面板打开时，右滑关闭日志面板
  if(logOpen){
    if(dx>60){
      closeLogPanel();
      touchStarted=false;
      return;
    }
    return;
  }

  // 编辑模式下禁用所有侧栏手势

  // 左栏未打开时，右滑打开
  if(!document.getElementById('sidebar').classList.contains('open')&&dx>60){
    openSidebar();
    initCursorToFirst();
    touchStarted=false;
    return;
  }
},{passive:true});

document.addEventListener('touchend',(e)=>{
  // 光标模式下点击右侧区域执行动作（只有在没有滑动过的情况下才执行）
  if(cursorMode && !hasMoved){
    executeCursorAction();
  }
  
  // 停止摇杆
  if(joystickActive)stopJoystick();
  
  touchStarted=false;
  cursorMode=false;
  hasMoved=false;
  scrollMode=false;
},{passive:true});

// ========== 隐藏滚动盒系统 ==========
// 创建并初始化隐藏滚动盒
function initHiddenScrollBox(){
  let scrollBox=document.getElementById('cursorScrollBox');
  
  if(!scrollBox){
    // 创建隐藏滚动盒
    scrollBox=document.createElement('div');
    scrollBox.id='cursorScrollBox';
    scrollBox.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 1px;
      height: 100vh;
      overflow-y: scroll;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    `;
    document.body.appendChild(scrollBox);
    
    // 监听滚动事件，映射到光标移动
    scrollBox.addEventListener('scroll',()=>{
      const scrollTop=scrollBox.scrollTop;
      const sensitivity=120; // 灵敏度：每120px滚动移动一个光标（越小越灵敏）
      const newIndex=Math.floor(scrollTop/sensitivity);
      
      // 移动光标到新位置
      const items=document.querySelectorAll('#fileTree .tree-item');
      if(items.length===0)return;
      
      // 限制范围
      const targetIndex=Math.min(Math.max(newIndex,0),items.length-1);
      
      // 更新选中状态
      const currentSelected=document.querySelector('.tree-item.selected');
      if(currentSelected)currentSelected.classList.remove('selected');
      items[targetIndex].classList.add('selected');
      selectedFile=items[targetIndex].dataset.path;
      
      // 光标居中
      centerCursorToView(items[targetIndex]);
    });
  }
  
  // 设置滚动盒高度 = 文件项数量 * 灵敏度
  const items=document.querySelectorAll('#fileTree .tree-item');
  const sensitivity=120;
  const totalHeight=items.length*sensitivity;
  scrollBox.innerHTML=`<div style="height:${totalHeight}px"></div>`;
  
  // 设置初始滚动位置
  scrollBox.scrollTop=lastCursorIndex*sensitivity;
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
  
  // 平滑滚动
  const targetScroll=sidebarContent.scrollTop+scrollOffset;
  sidebarContent.scrollTo({
    top: targetScroll,
    behavior: 'smooth'
  });
}

// 光标移动函数 - 带自动滚动
// 返回: 是否成功移动
function moveCursorWithScroll(direction){
  const items=document.querySelectorAll('#fileTree .tree-item');
  if(items.length===0)return false;
  
  const sidebarContent=document.querySelector('.sidebar-content');
  const containerRect=sidebarContent.getBoundingClientRect();
  
  // 查找当前选中项
  const currentSelected=document.querySelector('.tree-item.selected');
  let currentIndex=0;
  items.forEach((item,i)=>{if(item===currentSelected)currentIndex=i;});
  
  // 计算新索引
  let newIndex=currentIndex+direction;
  if(newIndex<0)newIndex=0;
  if(newIndex>=items.length)newIndex=items.length-1;
  
  // 检查是否真的移动了
  if(newIndex===currentIndex)return false;
  
  // 移动光标
  const oldSelected=currentSelected;
  items[newIndex].classList.add('selected');
  if(oldSelected)oldSelected.classList.remove('selected');
  selectedFile=items[newIndex].dataset.path;
  
  // 光标始终居中：只计算 tree-row（名称行）的位置，不包括展开的子元素
  const treeRow=items[newIndex].querySelector('.tree-row')||items[newIndex];
  const rowRect=treeRow.getBoundingClientRect();
  const rowCenter=rowRect.top+rowRect.height/2;
  const containerCenter=containerRect.top+containerRect.height/2;
  const scrollOffset=rowCenter-containerCenter;
  
  sidebarContent.scrollTop+=scrollOffset;
  
  return true;
}

// 旧函数保留（备用）
function moveCursor(direction){
  moveCursorWithScroll(direction);
}

// 初始化光标（使用 restoreCursorPosition）
function initCursorToFirst(){
  setTimeout(()=>{
    restoreCursorPosition();
  },100);
}

// 执行光标动作 - 直接触发光标所在行的点击事件
let isDispatching=false; // 防止循环触发

async function executeCursorAction(){
  if(isDispatching)return; // 防止循环
  isDispatching=true;
  
  const selectedItem=document.querySelector('.tree-item.selected');
  if(!selectedItem){
    console.log('executeCursorAction: 没有选中的项目');
    isDispatching=false;
    return;
  }
  
  console.log('executeCursorAction: 触发点击事件', selectedFile);
  
  // 直接触发 tree.js 中的点击处理逻辑
  const path=selectedItem.dataset.path;
  const toggle=selectedItem.querySelector('.tree-toggle');
  const isDir=toggle && !toggle.classList.contains('hidden');
  
  if(isDir){
    const wrap=selectedItem.querySelector('.tree-children-wrap');
    if(wrap && toggle){
      const isOpen=wrap.classList.contains('open');
      console.log('文件夹点击处理:', path, 'isOpen:', isOpen);
      
      const childrenWrap=wrap.querySelector('div');
      
      if(!isOpen){
        // 展开：先加载子目录（await 等待加载完成）
        console.log('准备展开, childrenWrap:', !!childrenWrap, 'hasChildren:', !!childrenWrap?.querySelector('.tree-item'));
        if(childrenWrap && !childrenWrap.querySelector('.tree-item')){
          await renderTree(childrenWrap,path,1);
          console.log('子目录加载完成');
        }
        wrap.classList.add('open');
        toggle.classList.add('expanded');
        expandedPaths[path]=true;
      }else{
        // 收起
        wrap.classList.remove('open');
        toggle.classList.remove('expanded');
        delete expandedPaths[path];
      }
      
      localStorage.setItem('expandedPaths',JSON.stringify(expandedPaths));
      
      // 叠叠乐动画
      const doBounce=(el,dir,delay)=>{
        setTimeout(()=>{
          const offset=dir?-10:10;
          el.style.transition='transform .3s cubic-bezier(.34,1.56,.64,1)';
          el.style.transform='translateY('+offset+'px)';
          setTimeout(()=>{el.style.transform='translateY('+(dir?2:-2)+'px)';},320);
          setTimeout(()=>{el.style.transform='';el.style.transition='';},450);
        },delay);
      };
      
      if(isOpen){
        doBounce(selectedItem,true,0);
        let sibling=selectedItem.nextElementSibling;
        let i=1;
        while(sibling){
          doBounce(sibling,true,(i-1)*20);
          sibling=sibling.nextElementSibling;
          i++;
        }
      }else{
        doBounce(selectedItem,false,0);
        let sibling=selectedItem.nextElementSibling;
        let i=1;
        while(sibling){
          doBounce(sibling,false,(i-1)*20);
          sibling=sibling.nextElementSibling;
          i++;
        }
      }
    }
  }else{
    // 文件：无动作
  }
  
  isDispatching=false;
}