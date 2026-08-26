---
name: zhihu-mht-clipping
description: 把知乎 MHT（等网页另存为产物）剪藏进 kfmv4 library/collected/——解正文、提取并验证图片、坏图走 CDN 抓真、读图描述、产出单个 md。用于处理信箱里的知乎 .mht 文件。
whenToUse: 当任务涉及把知乎 MHT（或类似网页 MHT）剪藏入库、提取知乎图片、处理 .mht / page_1.html / mht_parts。也适用于"知乎 MHT 图片损坏"相关场景。
---

# 知乎 MHT 剪藏流程（kfmv4 → library/collected/）

## 已知教训（实测，2026-08 多轮）

- **MHT 必须用二进制模式解析**：`email.message_from_binary_file`。
  用文本模式 + `errors='replace'` 会把非 UTF-8 字节替换成 U+FFFD，**毁掉内嵌图片**。
- **知乎 MHT 的 webp/png 常坏、jpg 常好**（浏览器"另存为"产物）。解码器验证：
  `Image.open(p).load()` 报 `failed to read next frame` / `could not create decoder object`
  即为坏图。**坏图绝不喂上下文**（见 kimi-code 用户级 skill `zhihu-mht-image`）。
- **真正的图源在 page_1.html 的 `<img src>` 里**——坏的是下载字节，URL 是好着的。
  从 page_1.html 抠 URL → 去 `picx.zhimg.com` 重新下载。

## 流程

### 1. 取文件
`scp -P 8022 localhost:'~/w/信箱/<标题>.mht'  <工作目录>/`

### 2. 解正文（二进制）+ 图（带位置标记）
```python
import email, os, re, html
from email import policy
msg=email.message_from_binary_file(open(mht,'rb'), policy=policy.default)
print("url:", msg.get("Snapshot-Content-Location","?"))
# 最大 text/html part 才是正文
htmlpart=max((p for p in msg.walk() if p.get_content_type()=="text/html"),
             key=lambda p: len(p.get_payload(decode=True) or b""))
raw=htmlpart.get_payload(decode=True).decode("utf-8","replace")
open("page_1.html","w",encoding="utf-8").write(raw)
# 在 <img> 位置插 [[图N]] 标记（保留位置）
imgs=[]
for m in re.finditer(r'<img[^>]*>', raw):
    url=re.search(r'src="([^"]+)"', m.group(0))
    if re.search(r'(apple-touch|favicon|logo|avatar)', m.group(0), re.I): continue
    imgs.append(url.group(1) if url else None)
text=re.sub(r'<img...>', ' [[图N]] ', raw)   # 逐张编号
# 去标签/实体
text=re.sub(r'<script.*?</script>|<style.*?</style>',"",text,flags=re.S)
text=re.sub(r'<[^>]+>'," ",text); text=html.unescape(text)
text=re.sub(r'[ \t]+'," ",text); text=re.sub(r'\n\s*\n+',"\n",text)
open("article.txt","w",encoding="utf-8").write(text)
```

### 3. 提取并验证图
```python
os.makedirs("parts",exist_ok=True); i=0
for p in msg.walk():
    if p.get_content_type().startswith("image/"):
        ext=p.get_content_type().split("/")[-1].replace("jpeg","jpg")
        open(f"parts/img_{i:02d}.{ext}","wb").write(p.get_payload(decode=True)); i+=1
# 验证
for fn in glob.glob("parts/*"):
    try: Image.open(fn).load(); print("OK",fn)
    except: print("坏",fn)
```

### 4. 坏图走 CDN 抓真
```bash
# 从 page_1.html 抠正文图 URL（排除 logo/favicon/avatar）
grep -oE 'https://picx?\.zhimg\.com/[^"]*' page_1.html | grep -vE 'apple|favicon|logo|avatar|_200x0' | sort -u
# 下载（mobile UA + referer）
curl -s -A "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile Safari/537.36" \
  -e "https://zhuanlan.zhihu.com/p/<id>" "<url>" -o figN.jpg
# 验证 + 与坏 parts 对应（按序替换）
```

### 5. 读图描述（k3 视觉）/ 或按需转写
- 只读**验证过可用**的图（保证不崩）。
- 关键内容图详细描述；chrome（横幅/广告/推荐阅读/App 引导）一句话带过。
- **描述内插到对应位置**（用户偏好）：替换正文里的 `[[图N]]` 标记为描述块，
  **不要堆到文末**。

### 6. 产出单 md
`标题 - 作者 - 知乎 - YYYY-MM-DD.md`，结构：
- 头部引用块：作者 / 来源(url) / 发布时间 / 剪藏日期 / 剪藏说明（正文完整；图片文字描述内插；图经 CDN 处理）
- 正文：article.txt 全文，`[[图N]]` 就地替换为 `> **【图·…】** 描述`

### 7. 存库 + 提交
放到 `library/collected/<主题>-<作者>-<日期>.md`，`git add` 该文件 → commit
（`docs(library): 收知乎剪藏…`）。**只 add 这一个文件**，别带并行线的改动。

## 验收
- 单 md，正文完整，无 `[[图N]]` 残留，图片描述内插对应位置（不堆末尾）
- 坏图没进 agent 上下文（都被 CDN 真图/描述替代）

## 实例
`library/collected/FunctionCalling已死-CodeMode出现-知乎-2026-08-25.md`（单 md + 内插图描述）
`library/collected/Agent瓶颈-武子康-知乎-2026-08-23.md`（含图片文字转写）
