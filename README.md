<div align="center">

<img src="public/favicon.svg" width="72" alt="" />

# LifeOS

**一个为你的人生运行的操作系统。**
*An operating system for your life.*

任务 · 里程碑 · 学术与引用 · 时薪计 · 习惯追踪 · 奖励商店 · 成就 —— 全部变成一场可以升级的游戏。

</div>

![LifeOS desktop — light](docs/desktop-light.jpg)

| 暗夜模式 Dark | 时薪计 Earn |
| --- | --- |
| ![dark](docs/desktop-dark.jpg) | ![earn](docs/earn.jpg) |

---

## 它是什么

LifeOS 把人生里分散的系统——每日清单、人生里程碑、论文与引用、工作时长与收入、身体与阅读数据——收进一个**像操作系统一样的桌面**里，并用游戏化机制把它们串起来：

- **桌面 Desktop**：问候、可拖动旋转的 3D「人生星球」（树木随等级生长，旗帜是你达成的里程碑，月亮绕行速度随连胜加快）、今日任务、人生进度条（今天 / 本周 / 本月 / 今年 / 一生）、属性雷达、XP 热力图。
- **任务 Quests**：每日习惯 + 一次性任务。按难度给 XP，全部完成触发「全勤日」奖励，支持回看/补打卡前几天。
- **人生地图 Roadmap**：里程碑时间线（可拆解步骤、倒计时），以及「人生周格」——一生约 4,400 周，每一格一周，里程碑标在格子上。
- **学术 Research**：论文看板（想法 → 写作 → 投稿 → 审稿 → 接收 → 发表，每推进一步都有 XP），总引用 / h-index / i10 自动计算，引用曲线；可一键从 **OpenAlex** 或 **Semantic Scholar** 同步论文和引用数。
- **时薪计 Earn**：开始工作后，收入以滚轮数字**逐秒上涨**；每 15 分钟掉一次金币，浏览器标签页标题实时显示本次收入，菜单栏有常驻计时胶囊。每专注 1 分钟 +1 XP。
- **追踪 Trackers**：体重、跑量、阅读、睡眠……任意数值，「最新读数」或「累计」两种模式，带目标和趋势图。
- **奖励商店 Shop**：XP 会同时产出金币（5 XP = 1 币）。给自己想要的犒劳定价，用金币兑换。
- **成就 Trophies**：等级与称号、六维属性（智识 / 体魄 / 财富 / 创造 / 羁绊 / 心境），25 枚青铜 → 传说徽章。
- **系统设置 Settings**：中英双语、明亮 / 暗夜 / 跟随系统、动效减弱、货币与时薪、JSON 导出 / 导入备份。

系统级体验：开机动画、菜单栏（连胜、金币、等级、时钟）、带放大效果的 Dock、窗口（红黄绿按钮、双击标题栏放大）、**⌘K / Ctrl+K 聚焦搜索**（打开应用、勾选任务、开始计时、切换主题）、系统通知（成就解锁、升级）、+XP 飘字与彩纸。

## 本地运行

```bash
git clone https://github.com/yubol-bobo/LifeOS.git
cd LifeOS
npm install
npm run dev
```

打开终端里显示的地址（默认 http://localhost:5173）。第一次启动会出现设置助手，可以选择「先看看示例数据」。

构建静态文件：

```bash
npm run build
```

`dist/` 是纯静态站点，使用相对路径，可以丢到任何静态托管上（GitHub Pages、Netlify、Vercel、NAS、甚至直接本地打开预览服务）。

## 部署到 GitHub Pages

仓库自带 `.github/workflows/deploy.yml`，推送到 `main` 或 `claude/**` 分支会自动构建并发布。第一次需要在仓库里开一下：

1. **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
2. 如果想让非 `main` 分支（例如开发中的 `claude/...` 分支）也能发布预览：**Settings → Environments → github-pages → Deployment branches**，把该分支加进去。否则合并到 `main` 后会自动发布。
3. 发布地址：`https://<你的用户名>.github.io/LifeOS/`

Fork 之后同样适用，只需对自己的 fork 做第 1 步。

## 数据与隐私

- 没有后端、没有账号。所有数据保存在当前浏览器的 `localStorage`（键名 `lifeos:v1`）。
- 换设备或清理浏览器之前，请在 **系统设置 → 数据 → 导出备份** 下载 JSON；在新设备上导入即可。
- 只有你主动点击「同步引用」时，浏览器才会直接请求 OpenAlex / Semantic Scholar 的公开 API。Google Scholar 没有公开 API，无法在浏览器里同步。

### 如何找到学术 ID

- **OpenAlex**：在 [openalex.org](https://openalex.org) 搜索你的名字，作者页 URL 里的 `A50...` 就是 ID；也可以直接填 `orcid:0000-0000-0000-0000`。
- **Semantic Scholar**：作者主页 URL 最后那串数字。

## 游戏规则（可以自己改）

所有数值都在 [`src/store/rules.ts`](src/store/rules.ts)：

| 行为 | XP |
| --- | --- |
| 每日 / 一次性任务 | 轻松 10 · 标准 25 · 硬核 50 |
| 全勤日（所有每日习惯完成，至少 3 个） | +30 |
| 里程碑达成 | 小目标 120 · 大目标 400 · 史诗 1000 |
| 里程碑步骤 | 15 |
| 论文推进 | 写作 40 · 投稿 150 · 接收 400 · 发表 120 |
| 专注计时 | 每分钟 1 |
| 追踪记录 | 每项每天 5 |
| 成就解锁 | 青铜 50 · 白银 120 · 黄金 300 · 传说 800 |

升到第 L 级所需累计 XP 为 `50 × L × (L − 1)`。金币 = XP ÷ 5。所有 XP 都记录在一个以 `ref` 去重的账本里，取消勾选会精确撤回对应的 XP。

## 技术栈

Vite · React 19 · TypeScript · three.js（人生星球，按需懒加载）· 纯 CSS 设计系统（无 UI 框架）· lucide 图标 · Bricolage Grotesque + Manrope 字体。

```
src/
  os/        Shell、菜单栏、Dock、窗口、聚焦搜索、通知、开机与设置助手
  apps/      Desktop / Quests / Roadmap / Research / Earn / Trackers / Shop / Trophies / Settings
  store/     数据模型、XP 账本与动作、游戏规则与成就、示例数据
  scene/     three.js 低多边形星球
  ui/        按钮、卡片、进度、图表（面积 / 柱状 / 热力 / 雷达）、滚轮数字
  styles/    设计 token（明亮 / 暗夜）、基础组件、系统外壳、各应用样式
```

## License

MIT
