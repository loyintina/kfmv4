/**
 * DOMRefs — DOM 元素引用注册中心
 *
 * 项目中所有 getElementById / querySelector 调用的唯一入口。
 * 如果 HTML 里改了元素 ID，只改这一个文件即可。
 */

export const DOM = {
  // ===== 页面固定元素（来自 index.html） =====
  get sidebar()           { return document.getElementById("sidebar"); },
  get fileTree()          { return document.getElementById("fileTree"); },
  get overlay()           { return document.getElementById("overlay"); },
  get aiInputBar()        { return document.getElementById("aiInputBar"); },
  get aiInput()           { return document.getElementById("aiInput") as HTMLTextAreaElement | null; },
  get aiSendBtn()         { return document.getElementById("aiSendBtn"); },
  get lightOrb()          { return document.getElementById("lightOrb") as HTMLDivElement | null; },
  get operationToast()    { return document.getElementById("operationToast"); },
  get toggleHiddenBtn()   { return document.getElementById("toggleHiddenBtn"); },
  get closeSidebarBtn()   { return document.getElementById("closeSidebarBtn"); },
  get sidebarToggleBtn()  { return document.getElementById("sidebarToggleBtn"); },
  get cardStackToggleBtn() { return document.getElementById("cardStackToggleBtn"); },
  get main()              { return document.getElementById("main"); },
  get homePage()          { return document.getElementById("homePage"); },

  // ===== JS 动态创建的元素 =====
  get treeCanvas()        { return document.getElementById("tree-canvas") as HTMLCanvasElement | null; },
  get sidebarTouchArea()  { return document.getElementById("sidebarTouchArea"); },
  get sidebarNav()        { return document.getElementById("sidebar-nav"); },


  // ===== querySelector 模式（参数化，不走 getElementById） =====
  /** 卡片面板内的序号元素 */
  stackCardIndex(el: Element) { return el.querySelector(".stack-card-index") as HTMLElement | null; },
  /** 光球面板内容区 */
  orbPanelContent(el: Element) { return el.querySelector(".orb-panel-content") as HTMLElement | null; },
  /** 光球面板状态标签 */
  orbPanelState(el: Element) { return el.querySelector(".orb-panel-state") as HTMLElement | null; },
};
