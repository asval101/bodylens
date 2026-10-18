# AGENTS.md — 身知 BodyLens

> 本文件供 AI 编码工具（Codex / Cursor / 其他 Agent）在每次会话开始时自动读取。
> 每次动手前请按顺序读：`PRD.md`（需求与验收基准）→ `docs/UI-SPEC.md`（视觉数值，动效与景深在第 8 节）→ `docs/CODEX-PLAYBOOK.md`（当前迭代与验收）。
> 本文件只由人修改，Agent 不得自动改写。

## 1. 当前状态

V0.1 已在本地可运行：四个导航入口、30 条行为、10 个器官入口、单项与综合分析、今日计划、localStorage 持久化、JSON 备份与恢复、恢复点撤销。
视觉已升级到 V2（分层景深 + 器官聚焦 + 点击脉冲），实现在 `vfx.js` 与 `styles.css` 末尾区块。
未完成：写实人体素材、医学与解剖专业审校、完整无障碍审计、全部 PRD 验收。

## 2. 技术栈（已锁定，禁止迁移）

| 项 | 结论 |
| --- | --- |
| 语言 | 原生 HTML / CSS / JavaScript（ES2020，浏览器直接执行） |
| 构建 | **无**。没有打包器、没有转译、没有框架 |
| 依赖 | **零运行时依赖**。`npm` 只用于 `start` 与 `test` 两个脚本 |
| 模块方式 | 全局 IIFE + `window.BodyLens` 命名空间（沿用 `data/catalog.js` 的写法） |
| 静态服务 | `scripts/serve.cjs`，绑定 `127.0.0.1:4173` |
| 测试 | `node:test`（`tests/`）+ 本地 Playwright（`scripts/qa.cjs`，非启动依赖） |
| 数据 | 内置只读 `data/catalog.js`；用户数据走 `localStorage` + 手动导出 JSON |

**禁止引入**：React、Vue、Next、Svelte、Tailwind、TypeScript 构建链、任何 CDN 资源、在线字体、付费 API、云数据库。

这个约束不是为了省事，而是为了满足 PRD 第 8 节的三条硬指标：AC-24（断网可用）、AC-28（10 分钟启动）、零额外支出。任何“顺手升级一下技术栈”的建议都应先被拒绝。

## 3. 目录与职责

```
index.html          # 页面骨架与静态文案
styles.css          # 全部样式与设计 token（:root 内；末尾有 V2 视觉层区块）
vfx.js              # 视觉增强层：分层景深、指针柔光、器官聚焦、点击脉冲
app.js              # 页面编排：器官交互、计划、持久化、恢复（已 38KB，见下方拆分红线）
domain.js           # 纯函数领域规则：输入匹配、日期、组合影响、备份校验
data/catalog.js     # 只读资料：行为、器官、影响、来源、指标、素材署名
anatomy.js          # 随应用发布的人体 SVG
assets/             # 素材与 asset-licenses.json
tests/              # node:test 用例
scripts/            # 本地服务、QA、离线数据处理脚本
docs/               # 本目录下的工程文档
```

### 视觉增强层（V2）的边界，改动前必读

`vfx.js` 与 `styles.css` 末尾的「V2 视觉层」区块共同构成表现层，规则见 `docs/UI-SPEC.md` 第 8 节。三条不可违反：

1. **`vfx.js` 不得读写业务状态**。它只允许读 DOM 与 `body` 上的 `no-motion` / `no-depth` 类，不得碰 `state`、`localStorage`、`catalog`。
2. **不得在 `app.js` 里新增视觉动效**。新增的指针、视差、focus、脉冲一律进 `vfx.js`；`app.js` 只保留业务编排。
3. **新增动效必须落在既有的两个开关下**。`body.no-motion` 关全部动画，`body.no-depth` 关景深位移；`prefers-reduced-motion` 等同 `no-motion`。PRD 5.4 要求「默认动效克制」，不得引入常驻闪烁或粒子。

修改 `#anatomy-art`、`#organ-labels`、`.stage-grid` 的 `transform` 时特别注意：这些元素已被三层景深占用，直接写死 `transform` 会让分层失效。需要调整就改 CSS 变量（`--vfx-rx` / `--vfx-ry` / `--vfx-ax` / `--vfx-ay` / `--vfx-gx` / `--vfx-gy` / `--vfx-lx` / `--vfx-ly`）。

**拆分红线**：`app.js` 不得再新增超过 150 行新功能代码。新功能（如 `plan.js`、`backup.js`、`organ-focus.js`）建成独立文件，在 `index.html` 里以 `<script>` 顺序引入，挂到 `window.BodyLens` 命名空间下。理由：单文件继续膨胀会让 AI 每次改动的上下文成本失控，也让 diff 无法评审。

## 4. 文件归属（WorkBuddy × Codex 协作边界）

| 范围 | 归属 | 说明 |
| --- | --- | --- |
| `styles.css`、`index.html` 的结构与文案 | 视觉层 | 改动前必须读 `docs/UI-SPEC.md` |
| `vfx.js` | 视觉层 | 纯表现层，不得读写业务状态 |
| `domain.js`、`app.js`、新模块、`tests/` | 逻辑层 | 可自由实现与重构 |
| `data/catalog.js` | **仅人可改** | 见第 5 节红线 |
| `anatomy.js`、`assets/` | 视觉层 | 由 `scripts/prepare-*.py` 生成，不手改成品 |

同一轮里不要既重写 `index.html` 又重写 `app.js`。改动超过 3 个文件时，先交一个最小可运行版本。

**与 WorkBuddy 协作时的分工**：WorkBuddy 负责视觉实现（`styles.css` 的 V2 区块、`vfx.js`、`docs/UI-SPEC.md`），Codex 负责逻辑层与数据规则。改动视觉层前，先 `git log --oneline` 看最近提交，避免和已有实现冲突。

## 5. 内容红线（比代码规范更重要）

这个产品的评分核心是“不把推测表现成已测量的身体损伤”。以下为不可协商项：

1. **不得编造来源**。任何 `effect` 必须带 `source`，且该 key 必须存在于 `sources` 中。机构名、标题、年份、URL、样本量一律不得凭印象填写。
2. **不得把相对风险写成个人概率**。研究里的“近 12 倍”只能作为长期人群研究的相对风险呈现，必须同时给出研究人群、暴露条件与限制。
3. **不得输出**器官年龄、损伤百分比、统一健康分、寿命预测、病情模拟图。
4. **“未收录”不等于“无害”**。缺资料时显示“当前未收录对应结论”，不得标为安全。
5. **不得为凑数量编造条目**。PRD 要求 30 条，数量不足应如实记录为未达标，而不是补几条看起来合理的。
6. **否定与歧义不得用子串匹配**。“不抽烟”不能匹配到抽烟；“晚睡”不能无条件等于睡眠不足。
7. 新增或修改 `data/catalog.js` 的内容，必须在回复中单独列出“新增了哪些条目、依据哪个来源的哪句话”，供人核对。

违反第 1–6 条产生的代码一律视为需要回滚的缺陷，而不是“待优化项”。

## 6. 工程硬约束

- 动画只作用于 `transform` 与 `opacity`；`prefers-reduced-motion: reduce` 下全部关闭（`styles.css` 已有全局规则，新增动画必须落在规则覆盖范围内）。
- 器官悬停反馈不得改变布局、不得让命中区错位。
- 每个器官必须有等效的文字按钮，键盘可完整操作（AC-12）。
- 不新增任何外部网络请求。字体、图像、纹理一律本地。
- `localStorage` 写入失败、配额不足、JSON 损坏必须显式提示，禁止“未写入却提示已保存”。
- 修一个 bug 就要在 `tests/` 里补一条对应用例，除非该行为无法在不引入 DOM 的前提下测试（此时在 `TESTING.md` 记录原因）。
- 不承诺无法验证的事：没有实现的离线缓存、定时备份、云同步，不得写进 UI 文案。

## 7. Commit 规范（直接影响比赛 25% 的分数）

格式：`<type>: <中文描述>`

`feat` / `fix` / `style` / `refactor` / `docs` / `test`

粒度要求：
- 一次提交 = 一个可独立描述的改动。一个器官交互、一条规则、一次视觉调整、一组测试，各自一个 commit。
- 提交信息要写清「改了什么 + 为什么」。禁止 `update`、`修复`、`优化一下` 这类零信息量描述。
- **禁止一次性提交多个功能**。这是 PRD 第 8 节明令禁止的，评委会直接看 log 判断演进真实性。

正确示例：
```
feat: 新增肾脏悬停时的体积感高亮，命中区随缩放同步
fix: 修正“不抽烟”被识别为吸烟的子串误匹配
test: 补充跨午夜日期归档与昨日任务隔离的用例
style: 收紧器官标签字号至 10px，避免 1024px 下重叠
```

## 8. 每轮交付自检

1. `npm test` 全绿
2. 1366×768 / 1024×768 / 390px 三档宽度无关键文字裁切（AC-26）
3. 断网状态下核心流程可用（AC-24）
4. 控制台无报错、无新增外部请求
5. 关闭动效后交互仍完整可用（AC-27）
6. 若改了环境或依赖，同步更新 `README.md`
