# 生成演示视频与文档的工具

这三个东西都不是手工做的：截图、录屏、PDF 全部由脚本驱动无头浏览器产出，可以重跑。
放这里是为了让「这些材料是怎么来的」本身也能被检查。

需要 Node 18+、Edge（或 Chrome）、ffmpeg、Python 3（可选，用于字幕与 PDF 校验）。
这些都不是产品运行依赖，产品本身仍然是零依赖静态站点。

---

## 一、演示视频（5′37″）

最终文件：`video/身知BodyLens-演示视频.mp4`（1920×1080 / 30fps / AAC 立体声 / 约 29MB）

换文案后另出一版：`video/身知BodyLens-演示视频-新版文案.mp4`，只有产品段的字幕不同，
时长、画面、音轨完全一样（同为 5′37″）。两份都留着，对比着看。字幕文本分别是
`video/字幕-产品段.srt`（旧）与 `video/产品演示段-新版字幕.srt`（新）。

| 段落 | 时间 | 内容 | 由什么生成 |
| --- | --- | --- | --- |
| 片头 | 0:00–0:04 | 品牌卡 | `front.html` → `shot-front.cjs` 截 2 倍图 → ffmpeg 拉成 4 秒 |
| 产品演示 | 0:04–2:28 | 记一笔 → 器官聚焦 → 推演 → 资料库 → 计划 → 设置 | `rec-product.cjs` 录屏 → `build-video.cjs` 合成 |
| AI 协同实录 | 2:28–5:37 | 三个 bug 的三次返工 | 已有素材 `AI协同段-三个bug-1080p.mp4` + 补音轨 |

### 产品演示段是怎么录的

```bash
# 1. 起本地服务（用从服务器拉下来的真实文件，见 docs/evidence/screenshots/README.md）
python -m http.server 4173 --bind 127.0.0.1

# 2. 录。视口 1280×720、像素密度 1.5，所以帧是 1920×1080 且文字是高清渲染不是拉伸
node docs/tooling/rec-product.cjs http://127.0.0.1:4173

# 3. 合成：帧是可变间隔的，用 concat 的 duration 表达「这一帧停多久」，再转 30fps
node docs/tooling/build-video.cjs <帧目录> video/产品演示段-无声.mp4

# 4. 字幕（ASS，锁字体锁位置）
python docs/tooling/make-ass.py

# 4b. 如果字幕来自一份 .srt（改文案时走这条），先转成同样的样式
python docs/tooling/srt-to-ass.py video/产品演示段-新版字幕.srt .tmpdoc/sub-product-v2.ass

# 5. 烧字幕 + 配乐
ffmpeg -i 产品演示段-无声.mp4 -i music.m4a \
  -filter_complex "[0:v]ass=sub-product.ass:fontsdir=fonts,fps=30[v];[1:a]afade=t=out:st=140:d=5,volume=0.85[a]" \
  -map [v] -map [a] -c:v libx264 -c:a aac video/产品演示段-1080p.mp4
```

**改文案不用重录。** 画面在 `产品演示段-无声.mp4` 里是干净的（无字幕、无音轨），
换一份字幕重跑第 4b、5 两步就行，两分钟出片，鼠标轨迹和页面状态一个字都不会变。

`sub-product.ass` 里那条样式是照着画面底部留白量出来的（微软雅黑 42px、3.4 描边、
距底 62px），换工具会丢，所以 `srt-to-ass.py` 把样式写死在脚本里，只换文字和时间。

两个踩过的坑：

- **`Page.startScreencast` 会以约 90fps 推帧**，两分半就是一万帧、1.5GB。不要用定时截图（每张 100–200ms，抓不到动画），也不要指望它按 30fps 给你。
- **`-ss` 放在 `-i` 前面是 input seeking，会把时间轴重置为 0**，ASS 字幕就整段不触发。要预览某一刻的字幕，`-ss` 必须放在 `-i` 后面。

## 二、截图

```bash
node docs/tooling/shot-evidence.cjs http://127.0.0.1:4173
```

会拍 8 张：今天页空态 / 记账后 / 推演 / 资料库 / 详情弹窗 / 计划 / 设置 / 390 窄屏。
放到 `docs/evidence/screenshots/`，每步都轮询等元素出现（线上首屏要 4 秒，写死 sleep 会假失败）。

## 三、技术文档 PDF（28 页）

```bash
node docs/tooling/to-pdf.cjs            # HTML → PDF，走 CDP 的 printToPDF
python docs/tooling/verify-doc.py       # 校验目录页码与章节实际页是否一致
```

源文件是三段 HTML 拼起来的（`.tmpdoc/part1..3.html` → `.tmpdoc/doc.html`），不进仓库；
成品是 `docs/身知BodyLens-技术文档.pdf`。

**目录页码不是手写的**：先导一遍拿到每章起始页，回填进目录，再导一遍，最后用 `verify-doc.py`
把「目录写的页码」和「章节实际所在页」逐条对撞。改内容之后必须重跑这一步，否则页码会漂。

几个排版坑记录在此，免得下次重踩：

- 表格里某一列宽度不够时，中文会被挤成逐字竖排（「把」「会」「变」各占一行）。看到提取出来的文本里有大量空格，就是列太窄。
- `page-break-before: always` 出现在两个相邻元素上会多出一张空白页。目录和封面不要加 `page-break-after`。
- Chrome 的 `printToPDF` 模板不继承页面 CSS，页脚的字号字体要在 `footerTemplate` 里重新写一遍。
