# 生成演示视频与文档的工具

这三个东西都不是手工做的：截图、录屏、PDF 全部由脚本驱动无头浏览器产出，可以重跑。
放这里是为了让「这些材料是怎么来的」本身也能被检查。

需要 Node 18+、Edge（或 Chrome）、ffmpeg、Python 3（可选，用于字幕与 PDF 校验）。
这些都不是产品运行依赖，产品本身仍然是零依赖静态站点。

---

## 一、演示视频（5′41″）

定稿：`video/身知BodyLens-演示视频-v5.mp4`（1920×1080 / 30fps / AAC 立体声 / 约 29MB）

旧稿都留着对比，差别只在产品段：

| 文件 | 时长 | 和定稿的差别 |
| --- | --- | --- |
| `身知BodyLens-演示视频.mp4` | 5′37″ | 第一版文案，资料库点的是「饮酒」 |
| `身知BodyLens-演示视频-新版文案.mp4` | 5′37″ | 换了文案，画面没重录 |
| `身知BodyLens-演示视频-v3.mp4` | 5′50″ | 开头讲初衷、多了「AI 解读」一段、资料库点回「抽烟」；**第一人称口播**，31 条字幕 |
| `身知BodyLens-演示视频-v4.mp4` | 5′50″ | 画面与 v3 逐帧相同，换成第三人称说明稿 28 条 |
| `身知BodyLens-演示视频-v5.mp4` | 5′41″ | **定稿**：开头 26 秒压到 17.5 秒，字幕时间码逐帧校准 |

**v3 → v4 → v5 都没有重录。** 产品段底板 `产品演示段-无声-v3.mp4` 是干净画面
（无字幕、无音轨），v4 只换字幕、v5 再调一次时间轴，鼠标轨迹和页面状态一个字不动。

| 段落 | 时间 | 内容 | 由什么生成 |
| --- | --- | --- | --- |
| 片头 | 0:00–0:04 | 品牌卡 | `front.html` → `shot-front.cjs` 截 2 倍图 → ffmpeg 拉成 4 秒 |
| 产品演示 | 0:04–2:32 | 讲初衷 → 记一笔 → 器官聚焦 → 解读（AI） → 推演 → 资料库 → 计划 → 设置 | `rec-product.cjs` 录屏 → `build-video.cjs` 合成 |
| AI 协同实录 | 2:32–5:41 | 三个 bug 的三次返工 | 已有素材 `AI协同段-三个bug-1080p.mp4` + 补音轨 |

### 开头为什么能压短而不用重录

录屏开头 26.3 秒里，真正在动的只有 4.8 秒（光标移到「抽烟」、往下滚、滚回来），
其余全是静止的空态。整段 1.5 倍会把滚动也拉快，看着像快进；**分段压**只压停顿：

```
[0, 9.2)   ×0.50   空态静止
[9.2, 9.8) ×1.00   光标移到「抽烟」
[9.8,12.2) ×0.50   停住
[12.2,14.2)×1.00   往下滚，露出「这张卡还没有数字」
[14.2,19.4)×0.55   停住
[19.4,21.6)×1.00   滚回顶部
[21.6,26.31)×0.85  最后停住，留够「首页显示还没开始」这句
```

26.31s → 17.46s，省 8.85 秒，滚动还是原来的手感。做法是写一份新时间轴
（`docs/tooling/warp-timeline.cjs` → `times-warped.json`），`build-video.cjs` 第三个参数指过去即可，
帧一张不动：

```bash
node docs/tooling/warp-timeline.cjs .tmpdoc/rec4
node docs/tooling/build-video.cjs .tmpdoc/rec4 video/产品演示段-无声-v4.mp4 times-warped.json
```

压完之后**后面每一条字幕都要减 8.85 秒**，不能只改开头那几条。

### 产品演示段是怎么录的

```bash
# 1. 起服务。要拍「AI 解读」这个标签，就必须走这个脚本：
#    它把 server/.env 读进环境变量，再把 /api 反代到 server/proxy.cjs。
#    用 `npm start` 只有一个静态服务，没有 /api，标签会一直停在「本地解读」。
cp server/.env.example server/.env    # 填上 AI_API_KEY
node docs/tooling/serve-with-ai.cjs   # → http://127.0.0.1:4173，另一个窗口保持不关

# 2. 录。视口 1280×720、像素密度 1.5，所以帧是 1920×1080 且文字是高清渲染不是拉伸。
#    每个 beat 结束会打印时间戳并写进 <DIR>/marks.json —— 字幕按它排，不靠估。
node docs/tooling/rec-product.cjs http://127.0.0.1:4173

# 3. 合成：帧是可变间隔的，用 concat 的 duration 表达「这一帧停多久」，再转 30fps
node docs/tooling/build-video.cjs <帧目录> video/产品演示段-无声.mp4

# 4. 字幕。先写 srt（时间码对齐 marks.json 里的 beat），再转成与画面同一套样式
python docs/tooling/srt-to-ass.py video/产品演示段-修订字幕-v5.srt .tmpdoc/sub-product-v5.ass

# 5. 烧字幕 + 配乐
ffmpeg -i 产品演示段-无声-v3.mp4 -i music.m4a \
  -filter_complex "[0:v]ass=sub-product-v5.ass:fontsdir=fonts,fps=30[v];[1:a]afade=t=out:st=143.8:d=4.5,volume=0.85[a]" \
  -map [v] -map [a] -t 148.3 -c:v libx264 -c:a aac video/产品演示段-v5.mp4
```

**字幕时间码的准头，只能靠抽帧量，不能靠算 sleep。** 两条都踩过：

1. `marks.json` 记的是每个 beat 的**结束**时刻，不是开始时刻。
2. 就算从 beat 边界往回推，也对不上——一次 `click()` 里有 700ms 悬停 + 按下 + 320ms 等反应，
   中间还夹着 `waitFor` 轮询，实际耗时比 `sleep()` 写的更长，越往后偏得越多。

v5 的做法是**逐条抽帧核对**：先按 beat 边界排出初稿，再在关键时刻拍图确认真实帧号，偏差
超过 1 秒就改。这一次抓到三处：数字出现比推算晚 0.4 秒、弹窗关闭晚 1 秒、今日计划里
打字/提交/勾选整段比推算晚 1.5 秒（照推算念会对着空输入框说「添加后任务就出现在下面」）。

**改文案不用重录。** 画面在 `产品演示段-无声-v3.mp4` 里是干净的（无字幕、无音轨），
换一份字幕重跑第 4、5 两步就行，两分钟出片，鼠标轨迹和页面状态一个字都不会变。
**但改了动作顺序就要重录**——字幕是按 beat 时间码排的，画面一变，时间码全部作废。

`sub-product.ass` 里那条样式是照着画面底部留白量出来的（微软雅黑 42px、3.4 描边、
距底 62px），换工具会丢，所以 `srt-to-ass.py` 把样式写死在脚本里，只换文字和时间。

三个踩过的坑：

- **`Page.startScreencast` 会以约 90fps 推帧**，两分半就是一万四千帧、1.5GB。不要用定时截图（每张 100–200ms，抓不到动画），也不要指望它按 30fps 给你。
- **`-ss` 放在 `-i` 前面是 input seeking，会把时间轴重置为 0**，ASS 字幕就整段不触发。要预览某一刻的字幕，`-ss` 必须放在 `-i` 后面。
- **`proxy.cjs` 自己不读 `.env`**：线上是 systemd 用 `EnvironmentFile` 注入的。本地直接 `node server/proxy.cjs` 会打印 `AI: off`，`/api/health` 返回 `{"ai":"off"}`——这不是密钥没配好，是变量根本没进来。

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
