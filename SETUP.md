# LifeOS 上手指南 · Setup Guide

这份指南把 **所有需要的 ID、API Key 和设置** 按顺序列出来。大部分都是可选的——什么都不配，LifeOS 也能完整运行在你的浏览器里。

> 一句话版本：Fork → 开启 Pages → 打开网站就能用。想要 Google Scholar 自动同步，再加一个 SerpAPI Key 和你的 Scholar ID。

---

## 总览

| # | 需要什么 | 必须？ | 从哪里拿 | 放到哪里 |
|---|---|---|---|---|
| 1 | GitHub Pages 发布 | 想在线访问就要 | — | 仓库 Settings → Pages |
| 2 | 允许发布的分支 | 用非 `main` 分支预览时要 | — | 仓库 Settings → Environments → `github-pages` |
| 3 | **Google Scholar ID** | 可选 | Scholar 主页网址 | `lifeos.config.json` |
| 4 | **SerpAPI Key** | 可选（配 #3 一起用） | serpapi.com | 仓库 Secret `SERPAPI_KEY` |
| 5 | OpenAlex / Semantic Scholar ID | 可选 | openalex.org / semanticscholar.org | LifeOS 网页里填 |
| 6 | 汇率 | 不需要 Key | 自动内置，可一键在线更新 | LifeOS 网页里 |
| 7 | 浏览器通知 | 可选 | — | LifeOS 网页里点一下授权 |

> 🔒 **原则：Key 永远只放在 GitHub Secrets 里。** 不要写进代码、不要填进网页、不要发到聊天里。网站是公开的，任何放进网页的东西访客都能看到。

---

## 1. 开启 GitHub Pages（在线访问）

1. Fork 本仓库（或者直接用你自己的仓库）。
2. 进入 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 推送任意提交到 `main`，等 Actions 跑完（约 1 分钟）。
4. 访问 `https://<你的用户名>.github.io/<仓库名>/`。

只想在本地跑？跳过这一步：

```bash
npm install
```

```bash
npm run dev
```

## 2. 允许其他分支发布预览（可选）

默认只有 `main` 能发布。想让开发分支（例如 `claude/...`）也能推送即预览：

**Settings → Environments → `github-pages` → Deployment branches and tags → Add deployment branch or tag rule**，填入分支名，或通配符 `claude/*`。

---

## 3. Google Scholar ID

**是什么**：你 Google Scholar 主页网址里 `user=` 后面那串字符。

```
https://scholar.google.com/citations?user=hgN6B6kAAAAJ&hl=en
                                          ^^^^^^^^^^^^
                                          这就是 Scholar ID
```

**放到哪里**：仓库根目录的 `lifeos.config.json`：

```json
{
  "scholar": {
    "id": "你的ScholarID",
    "intervalHours": 8,
    "monthlyLimit": 100,
    "timezone": "UTC"
  }
}
```

| 字段 | 含义 | 默认 |
|---|---|---|
| `id` | 你的 Scholar ID | — |
| `intervalHours` | 两次抓取的最短间隔（小时） | `8` |
| `monthlyLimit` | 每个自然月最多调用 SerpAPI 的次数 | `100` |
| `timezone` | 判断「今天」用的时区，如 `America/New_York`、`Asia/Shanghai` | `UTC` |

Scholar ID 本身是公开信息，写进仓库没有问题。（也可以改用仓库 Variable `SCHOLAR_ID`，优先级更高。）

## 4. SerpAPI Key（Google Scholar 自动同步）

Google Scholar 没有官方 API，LifeOS 通过 [SerpAPI](https://serpapi.com) 读取你的 Scholar 主页。

**拿 Key**

1. 去 [serpapi.com](https://serpapi.com) 注册（免费计划即可）。
2. 登录后在 **Dashboard → Your Private API Key** 复制 Key。

**放 Key**

1. 打开仓库 **Settings → Secrets and variables → Actions**。
2. 在 **Secrets** 标签页点 **New repository secret**。
3. Name 填 `SERPAPI_KEY`，Secret 粘贴你的 Key，保存。

**会发生什么**

- 定时任务每 8 小时运行一次（只在 `main` 分支上），抓取：每篇论文的引用数、新增 / 消失的论文、总引用、h-index、i10、每年引用。
- 两道保险保证不超额：两次抓取至少间隔 `intervalHours`；每月调用不超过 `monthlyLimit`。100 篇论文以内每次只用 1 次调用 → 每月约 90 次，在免费额度内。
- 数据保存在仓库的 `scholar-data` 分支，发布时打包进网站。打开 LifeOS 会自动合并到「学术」里，并显示近 7 / 30 天的变化。

**检查是否生效**：仓库 **Actions** → 最新一次 *Deploy to GitHub Pages* → *Sync Google Scholar* 步骤的日志：

| 日志 | 意思 |
|---|---|
| `Fetched N papers in 1 call(s) …` | 成功 ✅ |
| `Last fetch 2.1 h ago (< 8 h) — skipping.` | 正常，还没到下次抓取时间 |
| `Monthly budget reached` | 本月额度用完，下个月自动恢复 |
| `SCHOLAR_ID not set` | 没找到 Scholar ID → 检查第 3 步 |
| `SERPAPI_KEY not set` | 没找到 Key → 检查第 4 步（名字要完全一致） |
| `SerpAPI: Invalid API key` | Key 填错了，重新复制 |

> Key 泄露了？去 SerpAPI 后台重新生成一个，再回到 Secrets 覆盖 `SERPAPI_KEY` 即可。

## 5. OpenAlex / Semantic Scholar（可选的另一种引用来源）

不想用 SerpAPI，或者想对照其他数据源：在 LifeOS 里打开 **学术 → 同步引用**，选择数据源并填 ID。无需任何 Key，直接在浏览器里同步。

- **OpenAlex**：在 [openalex.org](https://openalex.org) 搜你的名字，作者页网址里的 `A50…` 就是 ID；也可以填 `orcid:0000-0000-0000-0000`。
- **Semantic Scholar**：作者主页网址最后那串数字。

## 6. 汇率（资产）

不需要任何 Key。LifeOS 内置了常见币种的参考汇率；在 **资产 → 账户卡片右上角的币种按钮** 里可以手动修改，或点「在线更新汇率」（来自 open.er-api.com 的免费接口）。

## 7. 浏览器通知（宠物提醒）

**系统设置 → 桌面宠物 → 浏览器通知**，点开后浏览器会询问一次授权。授权后，即使你在别的标签页，喝水 / 久坐 / 番茄钟提醒也能弹出来。

> 提醒只在 LifeOS 页面开着时运行（浏览器限制）。

---

## 数据在哪里？

- 你的任务、目标、心情、资产等 **全部只存在当前浏览器**（localStorage），不会上传。
- 换电脑或清理浏览器前：**系统设置 → 通用 → 导出备份**，到新设备上 **导入备份**。
- 只有 Google Scholar 同步的数据存在仓库的 `scholar-data` 分支里（本来就是你主页上的公开信息）。

## 常见问题

**Actions 里 deploy 失败，提示 “Ensure GitHub Pages has been enabled”？** → 第 1 步，把 Pages Source 设为 GitHub Actions。

**deploy 任务 2 秒就失败、没有日志？** → 当前分支不在允许发布的列表里，见第 2 步。

**Scholar 数据一直不更新？** → 定时任务只在默认分支 `main` 上跑；确认代码已经合并到 `main`，并看第 4 步的日志对照表。
