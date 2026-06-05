import { createFloatingCard } from "../../client/modules/floating-card.js";
import { layoutLines } from "../../client/engine/text-layout/index.js";
import { currentTheme as theme } from "../../client/modules/theme.js";
import { Registry } from "../../client/modules/ui-registry.js";
import { wsChannel } from "../../client/modules/ws-channel.js";

var msgs = [
  { role: "ai", text: "你好，我是蔚然。有什么可以帮你的吗？" },
  { role: "user", text: "帮我分析一下当前的目录结构" },
  { role: "ai", text: "好的，正在分析目录结构。当前目录下共有 12 个文件夹和 8 个文件。" },
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(el: HTMLElement, panelW: number): void {
  var innerWidth = Math.max(50, panelW - 24);
  var font = "13px sans-serif";
  var lineH = 20;
  var h = "";
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    var isUser = m.role === "user";
    var bgColor = isUser
      ? "linear-gradient(" + theme.surface.bgLight + "," + theme.surface.bgLight + ") padding-box," + theme.aiChat.bubbleSelfGradient + " border-box"
      : "linear-gradient(rgba(10,15,30,0.88),rgba(10,15,30,0.88)) padding-box," + theme.aiChat.panelBorderGradient + " border-box";
    var borderStyle = "border:1px solid transparent;border-left-width:3px;";
    var align = isUser ? "flex-end" : "flex-start";
    var label = isUser ? "你" : "蔚然";
    var labelColor = isUser ? theme.aiChat.bubbleLabelSelf : theme.aiChat.bubbleLabelAI;
    var boxShadow = isUser ? theme.aiChat.bubbleSelfShadow : theme.aiChat.bubbleAIShadow;
    try {
      var lines = layoutLines(m.text, font, innerWidth - 24, lineH);
      var textHtml = "";
      for (var j = 0; j < lines.length; j++) {
        textHtml += "<span style='display:block'>" + esc(lines[j].text) + "</span>";
      }
      h += "<div style='display:flex;justify-content:" + align + ";margin-bottom:8px'>"
        + "<div style='max-width:" + (innerWidth - 8) + "px;padding:6px 12px;background:" + bgColor + ";" + borderStyle + "border-radius:8px;box-shadow:" + boxShadow + "'>"
        + "<div style='font-size:10px;color:" + labelColor + ";margin-bottom:2px;font-weight:600'>" + label + "</div>"
        + "<div style='font-family:sans-serif;font-size:13px;line-height:" + lineH + "px;color:" + theme.aiChat.bubbleText + "'>" + textHtml + "</div></div></div>";
    } catch (e) {
      h += "<div style='display:flex;justify-content:" + align + ";margin-bottom:8px'>"
        + "<div style='max-width:85%;padding:6px 12px;background:" + bgColor + ";" + borderStyle + "border-radius:8px;box-shadow:" + boxShadow + "'>"
        + "<div style='font-size:10px;color:" + labelColor + ";margin-bottom:2px;font-weight:600'>" + label + "</div>"
        + "<div style='font-size:13px;color:" + theme.aiChat.bubbleText + "'>" + esc(m.text) + "</div></div></div>";
    }
  }
  el.innerHTML = h;
  el.scrollTop = el.scrollHeight;
}

export function initOrbCard(): void {
  createFloatingCard({
    id: "orb",
    name: "AI Chat",
    compactWidth: 0, compactHeight: 0,
    activeWidth: 300, activeHeight: 350,
    minWidth: 120, minHeight: 100,
    orbSize: 36, margin: 8,
    cornerTL: false, cornerTR: false, cornerBL: false,
    mode: "orb",
    alwaysOnTop: true, inputBarAvoid: true,
    accentColor: "#7c3aed",
    surfaceBg: "rgba(10,10,30,0.85)",
    initialPosition: { right: 8, bottom: 8 },
    onActivate(contentEl: HTMLElement) {
      var w = contentEl.parentElement ? parseFloat(contentEl.parentElement.style.width) || 300 : 300;
      render(contentEl, w);
    },
    onDeactivate(contentEl: HTMLElement) { contentEl.innerHTML = ""; },
    onCreate(el: HTMLElement) {},
  });

  Registry.registerElement({
    id: "orb-panel",
    type: "panel",
    label: "AI 对话面板",
    description: "AI 聊天对话面板",
    state: "closed",
    enabled: true,
    effect: "展开后显示聊天消息，可输入文字与 AI 对话",
    source: "orb-card.ts",
  });

  Registry.registerContentGenerator("orb-chat", function() {
    return {
      id: "orb-chat",
      type: "text-output",
      summary: msgs.length > 0
        ? "最后一条消息: " + (msgs[msgs.length - 1].role === "user" ? "我" : "AI") + "说" + msgs[msgs.length - 1].text.slice(0, 40)
        : "暂无对话历史",
    };
  });

  wsChannel.onCommand("expand-orb", function() {});
  wsChannel.onCommand("collapse-orb", function() {});
  wsChannel.onCommand("toggle-orb", function() {});
}
