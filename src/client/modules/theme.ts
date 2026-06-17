/**
 * theme.ts — KFM v4 主题系统
 *
 * 所有视觉颜色的唯一来源。
 * 加主题：写一个新的 ThemeConfig 对象，切换 currentTheme 引用。
 * 不改引用 = 不影响任何已有代码。
 */

// ============================================================
// 类型定义
// ============================================================

export interface ThemeConfig {
  /** 主题名 */
  name: string;

  /** Canvas 渲染层 */
  canvas: {
    bg: string;              // #0a0a0f
    gridLine: string;        // #2a2a3a
    text: string;            // #e0e0e0
    cursor: string;          // rgba(0,212,255,0.7)
    cursorBg: string;        // rgba(46,213,163,0.15)
    accent: string;          // #00d4ff
    /** 玻璃管液体光效（模式联动光标动态效果），undefined 则禁用 */
    cursorLiquid?: {
      count: number;      // 液体段数量
      segLen: number;     // 每段沿路径长度 px（上/下线默认）
      speed: number;      // 移动速度 px/s
      radius: number;     // 段圆角半径 px
      /** 竖线路径倍率（>1=减慢竖线遍历速度，增大竖线段粒子密度），默认 1 */
      verticalMul?: number;
      /** 竖线粒子长度 px，默认同 segLen */
      segLenVertical?: number;
    };
  };

  /** 文件树 */
  tree: {
    dir: string;             // #7c3aed
    file: string;            // #e0e0e0
    label: string;           // #e8e0f0
    selectedBg: string;      // rgba(124,58,237,0.15)
    folderBg: string;        // rgba(124,58,237,0.3)
    fileBg: string;          // rgba(124,58,237,0.3)
    toggleColor: string;     // #00d4ff
    containerBorder: string; // rgba(180,130,255,{op})
    shadow: string;          // rgba(0,0,0,0.5)
  };

  /** 卡片表面（毛玻璃 + 边框渐变） */
  surface: {
    bg: string;              // rgba(20,16,32,0.92)
    bgLight: string;         // rgba(10,10,15,0.85)
    bgLighter: string;       // rgba(10,15,30,0.88)
    border: string;          // transparent
    borderRadius: string;    // 12px
  };

  /** AI 对话卡（紫色） */
  aiChat: {
    panelBorderGradient: string;  // linear-gradient(135deg,rgba(0,212,255,.8),rgba(99,102,241,.7),rgba(124,58,237,.7))
    panelShadow: string;         // 0 0 24px 8px rgba(124,58,237,0.25), 0 8px 32px rgba(0,0,0,0.5)
    panelShadowEdit: string;     // 0 0 40px 20px rgba(124,58,237,0.55), 0 8px 32px rgba(0,0,0,0.5)
    headerBorder: string;        // rgba(124,58,237,0.2)
    headerText: string;          // #7c3aed
    stateText: string;           // rgba(255,255,255,0.3)
    bubbleSelfGradient: string;  // linear-gradient(135deg,#7c3aed,rgba(0,212,255,.8))
    bubbleAIGradient: string;    // linear-gradient(135deg,rgba(0,212,255,.8),rgba(99,102,241,.7),rgba(124,58,237,.7))
    bubbleSelfShadow: string;    // 0 0 10px 2px rgba(124,58,237,0.12)
    bubbleAIShadow: string;      // 0 0 10px 2px rgba(99,102,241,0.08)
    bubbleLabelSelf: string;     // #7c3aed
    bubbleLabelAI: string;       // #818cf8
    bubbleText: string;          // #e0e0e0
    orbGradient: string;         // radial-gradient(... 实际在 debug-orb 中硬编码了不同样式)
  };



  /** 工具卡片颜色（7 色星云光谱） */
  cardAccents: Array<{
    border: string;
    bg: string;
    iconBg: string;
  }>;

  /** 卡片堆叠系统阴影 */
  stack: {
    focusShadow: string;
    blurShadow: string;
    cardBg: string;
    cardBorderRadius: string;
    cardGap: number;
    cardHeight: number;
  };

  /** 浮卡四角光球装饰 */
  cornerOrb: {
    size: number;               // 26 光球直径
    cornerOff: number;          // -13 光球超出卡片边缘的距离（负值=向外突出）
    rightOffAdj: number;        // +1 右侧光球偏移调整量（cornerOff + rightOffAdj）
    bottomOffAdj: number;       // -1 底部光球偏移调整量（cornerOff + bottomOffAdj）
    glowCenterAlpha: number;    // 0.85 光晕中心透明度
    glowMidAlpha: number;       // 0.35 光晕中层透明度
    glowPos: string;            // "30% 30%" 渐变中心位置
    shadow1Blur: string;        // "10px 4px" 主阴影扩散
    shadow1Alpha: number;       // 0.4 主阴影透明度
    shadow2Blur: string;        // "20px 8px" 次阴影扩散
    shadow2Alpha: number;       // 0.15 次阴影透明度
    symAlpha: number;           // 0.95 符号默认透明度
    symStroke: number;          // 1.2 符号线条宽度(SVG stroke-width)
    symScale: number;           // 0.92 3D球面缩放
    symShift: number;           // 1.0 3D球面向外位移(viewBox单位)
    symMaskAngle: string;       // "135deg" 光照渐变角度
    symMaskCutoff: string;      // "#000 30%" 光照截止点
    tlAlpha: number;            // 0.95 左上角透明度覆盖值
  };

  /** 文件扩展名 -> 颜色映射 */
  extColors: Record<string, string>;
}

// ============================================================
// Nebula 主题（当前默认）
// ============================================================

export const nebula: ThemeConfig = {
  name: 'nebula',

  canvas: {
    bg: '#0a0a0f',
    gridLine: '#2a2a3a',
    text: '#e0e0e0',
    cursor: 'rgba(0,212,255,0.7)',
    cursorBg: 'rgba(46,213,163,0.15)',
    accent: '#00d4ff',
    cursorLiquid: {
      count: 8,
      segLen: 18,
      speed: 20,
      radius: 1.5,
      verticalMul: 2.5,
      segLenVertical: 6,
    },
  },

  tree: {
    dir: '#7c3aed',
    file: '#e0e0e0',
    label: '#e8e0f0',
    selectedBg: 'rgba(124,58,237,0.15)',
    folderBg: 'rgba(124,58,237,0.3)',
    fileBg: 'rgba(124,58,237,0.3)',
    toggleColor: '#00d4ff',
    containerBorder: 'rgba(180,130,255,',
    shadow: 'rgba(0,0,0,0.5)',
  },

  surface: {
    bg: 'rgba(20,16,32,0.92)',
    bgLight: 'rgba(10,10,15,0.85)',
    bgLighter: 'rgba(10,15,30,0.88)',
    border: 'transparent',
    borderRadius: '12px',
  },

  aiChat: {
    panelBorderGradient: 'linear-gradient(135deg,rgba(0,212,255,.8),rgba(99,102,241,.7),rgba(124,58,237,.7))',
    panelShadow: '0 0 24px 8px rgba(124, 58, 237, 0.25), 0 8px 32px rgba(0, 0, 0, 0.5)',
    panelShadowEdit: '0 0 40px 20px rgba(124, 58, 237, 0.55), 0 8px 32px rgba(0, 0, 0, 0.5)',
    headerBorder: 'rgba(124,58,237,0.2)',
    headerText: '#7c3aed',
    stateText: 'rgba(255,255,255,0.3)',
    bubbleSelfGradient: 'linear-gradient(135deg,#7c3aed,rgba(0,212,255,.8))',
    bubbleAIGradient: 'linear-gradient(135deg,rgba(0,212,255,.8),rgba(99,102,241,.7),rgba(124,58,237,.7))',
    bubbleSelfShadow: '0 0 10px 2px rgba(124,58,237,0.12)',
    bubbleAIShadow: '0 0 10px 2px rgba(99,102,241,0.08)',
    bubbleLabelSelf: '#7c3aed',
    bubbleLabelAI: '#818cf8',
    bubbleText: '#e0e0e0',
    orbGradient: '',
  },


  cardAccents: [
    { border: '#B46478', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(180,100,120,0.25)' },
    { border: '#C88C5A', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(200,140,90,0.25)' },
    { border: '#B4AA50', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(180,170,80,0.25)' },
    { border: '#50A880', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(80,168,128,0.25)' },
    { border: '#5088C8', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(80,136,200,0.25)' },
    { border: '#6C5CC8', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(108,92,200,0.25)' },
    { border: '#9650C8', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(150,80,200,0.25)' },
  ],

  stack: {
    focusShadow: '0 4px 8px rgba(0,0,0,0.4),0 12px 24px rgba(0,0,0,0.3),0 24px 48px rgba(0,0,0,0.25),-6px 6px 12px rgba(0,0,0,0.2)',
    blurShadow: '0 2px 4px rgba(0,0,0,0.3),0 8px 16px rgba(0,0,0,0.25),0 16px 32px rgba(0,0,0,0.2),-4px 4px 8px rgba(0,0,0,0.15)',
    cardBg: 'rgba(20,16,32,0.92)',
    cardBorderRadius: '12px',
    cardGap: 26,
    cardHeight: 68,
  },

  /** 浮卡四角光球装饰 */
  cornerOrb: {
    size: 26,
    cornerOff: -13,
    rightOffAdj: 1,
    bottomOffAdj: -1,
    glowCenterAlpha: 0.45,
    glowMidAlpha: 0.18,
    glowPos: '30% 30%',
    shadow1Blur: '6px 2px',
    shadow1Alpha: 0.2,
    shadow2Blur: '12px 4px',
    shadow2Alpha: 0.08,
    symAlpha: 0.95,
    symStroke: 1.2,
    symScale: 0.92,
    symShift: 1.0,
    symMaskAngle: '135deg',
    symMaskCutoff: '#000 30%',
    tlAlpha: 0.95,
  },

  extColors: {
    ts: '#3178c6', js: '#f7df1e', json: '#292929',
    html: '#e34f26', css: '#1572b6', md: '#083fa1',
    py: '#3776ab', rs: '#dea584', go: '#00d800',
    rsync: '#7c3aed', zip: '#f39c12', gz: '#f39c12',
    tar: '#f39c12', bak: '#888', old: '#888',
  },
};

/** 当前激活主题。切换主题时替换此引用。 */
export const currentTheme: ThemeConfig = nebula;
