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

  /** 调试面板（青色） */
  debug: {
    orbGradient: string;          // radial-gradient(circle at 35% 35%, rgba(0,255,200,0.9), rgba(0,180,150,0.6))
    orbShadow: string;            // 0 0 16px 4px rgba(0,255,200,0.4), 0 0 40px 12px rgba(0,200,160,0.2)
    panelBgGradient: string;      // linear-gradient(rgba(8,20,18,0.94),rgba(8,20,18,0.94))
    panelBorderGradient: string;  // linear-gradient(135deg,rgba(0,255,200,.7),rgba(0,180,150,.5))
    panelShadow: string;          // 0 0 20px 6px rgba(0,255,200,0.2), 0 6px 24px rgba(0,0,0,0.5)
    panelShadowEdit: string;      // 0 0 40px 20px rgba(0,255,200,0.45), 0 6px 24px rgba(0,0,0,0.5)
    headerBorder: string;         // rgba(0,255,200,0.2)
    headerText: string;           // rgba(0,255,200,0.9)
    buttonBg: string;             // rgba(0,255,200,0.15)
    buttonBorder: string;         // rgba(0,255,200,0.3)
    logText: string;              // rgba(180,255,230,0.85)
    accentColor: string;          // #00ffc8
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

  debug: {
    orbGradient: 'radial-gradient(circle at 35% 35%, rgba(0,255,200,0.9), rgba(0,180,150,0.6))',
    orbShadow: '0 0 16px 4px rgba(0,255,200,0.4), 0 0 40px 12px rgba(0,200,160,0.2)',
    panelBgGradient: 'linear-gradient(rgba(8,20,18,0.94),rgba(8,20,18,0.94))',
    panelBorderGradient: 'linear-gradient(135deg,rgba(0,255,200,.7),rgba(0,180,150,.5))',
    panelShadow: '0 0 20px 6px rgba(0,255,200,0.2), 0 6px 24px rgba(0,0,0,0.5)',
    panelShadowEdit: '0 0 40px 20px rgba(0,255,200,0.45), 0 6px 24px rgba(0,0,0,0.5)',
    headerBorder: 'rgba(0,255,200,0.2)',
    headerText: 'rgba(0,255,200,0.9)',
    buttonBg: 'rgba(0,255,200,0.15)',
    buttonBorder: 'rgba(0,255,200,0.3)',
    logText: 'rgba(180,255,230,0.85)',
    accentColor: '#00ffc8',
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
    cardGap: 36,
    cardHeight: 68,
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
