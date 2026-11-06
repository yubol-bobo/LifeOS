# LifeOS 上手指南 · Setup Guide

这份指南把 **所有需要的 ID、API Key 和设置** 按顺序列出来。大部分都是可选的——什么都不配，LifeOS 也能完整运行在你的浏览器里。

> 一句话版本：Fork → 开启 Pages → 打开网站就能用。想要 Google Scholar 自动同步，再加一个 SerpAPI Key 和你的 Scholar ID。

---

## 总览

| # | 需要什么 | 必须？ | 从哪里拿 | 放到哪里 |
|---|---|---|---|---|
| 1 | GitHub Pages 发布 | 想在线访问就要 | — | 仓库 Settings → Pages |
| 2 | 预览开发分支 | 可选 | — | Actions 里手动运行 + Settings → Environments |
| 3 | **Google Scholar ID** | 可选 | Scholar 主页网址 | 仓库 Variable `SCHOLAR_ID` |
| 4 | **SerpAPI Key** | 可选（配 #3 一起用） | serpapi.com | 仓库 Secret `SERPAPI_KEY` |
| 5 | OpenAlex / Semantic Scholar ID | 可选 | openalex.org / semanticscholar.org | LifeOS 网页里填 |
| 6 | 汇率 | 不需要 Key | 自动内置，可一键在线更新 | LifeOS 网页里 |
| 7 | 浏览器通知 | 可选 | — | LifeOS 网页里点一下授权 |
| 8 | **多设备同步**：GitHub token（只勾 gist）+ 同步密码 | 多设备使用时要 | github.com/settings/tokens | **只填在 LifeOS 网页里**（每台设备各填一次） |
| 9 | **AI 宠物**：OpenAI / Claude / DeepSeek / Kimi / GLM 任选一个的 API Key | 可选 | 各服务商后台 | **只填在 LifeOS 网页里**（系统设置 → AI 宠物） |

> 🔒 **原则：Key 永远不写进代码、不提交到仓库、不发到聊天里。** 部署要用的 Key（SerpAPI）只放 GitHub Secrets；你个人用的 Key（同步 token、AI Key）只在你自己浏览器打开的 LifeOS 里填——它们只保存在那台设备的浏览器中，不会出现在公开网站里，别的访客看不到。

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

## 2. 预览开发分支（可选）

**只有合并进 `main` 才会更新你的网站**，开发分支上的改动不会影响你每天用的版本。

想在合并前先看看某个开发分支的效果：

1. 先允许这个分支发布（只需设置一次）：**Settings → Environments → `github-pages` → Deployment branches and tags → Add deployment branch or tag rule**，填分支名，或通配符 `claude/*`。
2. **Actions → Deploy to GitHub Pages → Run workflow**，在下拉框里选这个分支，点运行。

⚠️ 一个仓库只有一个 Pages 网站，预览会**暂时替换**线上网站，直到下一次 `main` 更新（或者你对 `main` 再手动运行一次）。你的记录不受影响，因为它们在浏览器里，不在网站上。

---

## 3. Google Scholar ID

**是什么**：你 Google Scholar 主页网址里 `user=` 后面那串字符。

```
https://scholar.google.com/citations?user=hgN6B6kAAAAJ&hl=en
                                          ^^^^^^^^^^^^
                                          这就是 Scholar ID
```

**放到哪里（推荐）**：仓库 **Settings → Secrets and variables → Actions → Variables** 标签 → **New repository variable**，名字 `SCHOLAR_ID`，值填你的 ID。

这样 ID 不写进代码，别人 fork 你的仓库时不会带走你的 ID（不然他们的网站会抓你的主页）。

**其他可调参数**在仓库根目录的 `lifeos.config.json`（`id` 留空即可，Variable 优先）：

```json
{
  "scholar": {
    "id": "",
    "intervalHours": 8,
    "monthlyLimit": 100,
    "timezone": "UTC"
  }
}
```

| 字段 | 含义 | 默认 |
|---|---|---|
| `id` | 你的 Scholar ID（推荐留空，用 Variable `SCHOLAR_ID`） | — |
| `intervalHours` | 两次抓取的最短间隔（小时） | `8` |
| `monthlyLimit` | 每个自然月最多调用 SerpAPI 的次数 | `100` |
| `timezone` | 判断「今天」用的时区，如 `America/New_York`、`Asia/Shanghai` | `UTC` |

Scholar ID 本身是公开信息；放进 Variable 只是为了让 fork 的人不会继承它。

**网站上的 Scholar 数据只会进入「绑定」过的 LifeOS**：第一次在你自己的网站打开「学术」时，点「这是我的，绑定」。访客打开你的网站只会看到一个提示，你的论文不会被合并进他们的 LifeOS。

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

## 8. 多设备同步（电脑 ⇄ 手机）

数据会 **端到端加密** 后保存在你自己 GitHub 账号下的一个 **私密 Gist** 里，任何设备上的改动都会自动出现在其他设备上。

**第一台设备**

1. 打开 [创建 token 页面](https://github.com/settings/tokens/new?scopes=gist&description=LifeOS%20sync)（classic token），**只勾 `gist`**，可以设置过期时间，生成后复制。
2. LifeOS → **系统设置 → 同步**：粘贴 token，设一个 **同步密码**（至少 6 位），点「连接并同步」。

**其他设备**

- 新设备：打开网站 → 设置助手里点 **「从其他设备同步」**，填 **同一个 token 和同一个同步密码** → 数据自动出现。
- 已经在用的设备：系统设置 → 同步，填同样的信息；如果两边都有数据，会让你选「使用云端数据」或「合并两边」。

**它是怎么做到不丢数据的**

- 加密在浏览器里完成（AES-256-GCM，密钥由同步密码经 PBKDF2 派生），GitHub 只存密文；同步密码从不上传。
- 打开页面、切回标签页、每分钟、每次修改后几秒都会自动同步；菜单栏的云朵图标显示状态（绿色 = 已同步，红色 = 出错）。
- **按每一条记录合并**：两台设备各自改了不同的东西（比如电脑上加任务、手机上打卡），都会保留；只有同一项被两边改了，才以较新的为准。删除也会同步。离线时的修改，联网后会自动合并。

**注意**

- 🔑 **token 和同步密码只填在 LifeOS 网页里**，不要放进代码或仓库 Secrets（同步是浏览器直接和 GitHub 通信的，跟 Actions 无关）。它们只保存在每台设备本地，不会被同步或导出。
- 🔒 **同步密码忘了就无法解密云端数据**（这是加密的代价）。这时可以在一台有完整数据的设备上「断开」，删掉 Gist（[gist.github.com](https://gist.github.com) 里名为 `LifeOS sync` 的那个），再用新密码重新连接。
- token 泄露或过期：去 GitHub 删掉旧 token、生成新的，在各设备的「同步」里断开后重新连接。

---

## 9. AI 宠物（今日总结）

让宠物读取你一天的数据，写一份简短有趣的「今日总结」，可以编辑并存进当天的每日复盘。**不接也能用**：没有 Key 时宠物会写一份离线版。

1. 任选一个服务商，创建 API Key：

   | 服务商 | 获取 Key | 默认模型（可改） | 备注 |
   |---|---|---|---|
   | Claude（Anthropic） | console.anthropic.com → API Keys | `claude-opus-5-5` | 可选开启「联网找新闻」（会多一点费用）；想更省可以改成 `claude-sonnet-5-5` 或 `claude-haiku-5-5` |
   | OpenAI | platform.openai.com/api-keys | `gpt-5-mini` | |
   | DeepSeek | platform.deepseek.com/api_keys | `deepseek-chat` | |
   | Kimi（月之暗面） | platform.moonshot.cn → API Key | `moonshot-v1-8k` | 海外账号把接口地址改成 `https://api.moonshot.ai/v1` |
   | GLM（智谱） | open.bigmodel.cn → API Keys | `glm-4-flash` | |

2. 打开你的 LifeOS → **系统设置 → AI 宠物**，选服务商，粘贴 Key，点 **测试连接**。
3. 建议在服务商后台给这个 Key **设置额度上限**。一份总结大约几百到一千多个 token，一天一次花费很低。

**会发送什么？** 只有在生成总结时，浏览器把当天的数据摘要（完成的任务名、专注时长和项目、入账、XP、心情和备注、喝水起身、本周计划和目标进度、即将到来的倒计时、你当天写的复盘）直接发给你选的服务商。Key 和数据都不经过任何中间服务器。

**测试连接失败？**
- 「Key 无效」→ 重新复制 Key，注意没有多余空格。
- 「连接失败」→ 网络问题，或者该服务不允许浏览器直接调用（CORS）。可以在「接口地址」里填你自己的代理（例如一个 Cloudflare Worker 转发）。

---

## 10. 自己用的同时公开给别人 fork（隐私）

**结论：放心公开这个仓库。你的记录从来不在仓库里。**

| 东西 | 存在哪 | 会不会被 fork / 公开看到 |
|---|---|---|
| 任务、复盘、心情、资产、专注记录……所有个人记录 | 你浏览器的 localStorage | ❌ 不在仓库里，fork 带不走，访客看不到 |
| 多设备同步数据 | 你自己的 **secret Gist**，AES-256-GCM 加密 | ❌ 不在仓库里；Gist 内容是密文，没有同步密码解不开 |
| 同步 token、同步密码、AI Key | 只在你的浏览器里 | ❌ |
| SerpAPI Key | 仓库 Secrets | ❌ Secrets 不会被 fork，日志里也会被打码 |
| Scholar ID | 仓库 Variable `SCHOLAR_ID` | ❌ Variables 不会被 fork |
| Google Scholar 引用历史 | `scholar-data` 分支 | ⚠️ 公开仓库里能看到（本来就是你 Scholar 主页上的公开信息）；fork 默认只复制主分支，不会带走它 |
| 示例数据（Alex 的一天） | 代码里 | 虚构的，可以随便看 |

**你的网站（yubol-bobo.github.io/LifeOS）也是安全的**：每个访客打开看到的都是**他自己浏览器里**的 LifeOS（空的，或者他自己加载的示例），看不到你的任何记录；你的 Scholar 数据也只会进入你「绑定」过的 LifeOS。

**几条习惯**

1. **不要把导出的备份文件提交到仓库。** `.gitignore` 已经忽略 `lifeos-backup*.json`，但别手动强加进去。
2. **同步密码要够强**，不要和别的密码重复——Gist 是「secret（不公开列出）」不是「private」，拿到链接的人能看到密文。
3. **个人配置都放 Secrets / Variables，不写进文件。** 代码里只放大家通用的默认值。
4. 别人想用的话，推荐直接 **Fork**：以后你更新了，他们在 GitHub 上点一下 **Sync fork** 就能拿到（见第 11 节）。也可以在 **Settings → General** 勾选 **Template repository**，别人点 **Use this template** 会得到一个干净的新仓库，但之后拿你的更新就要手动合并。

**别人 fork 之后要做的**（和你当初一样）：开启 Pages（第 1 步）→ 可选：加自己的 `SCHOLAR_ID` Variable 和 `SERPAPI_KEY` Secret → 打开网站开始用。fork 出来的仓库里定时任务默认是关的，要在 Actions 页面点一下启用。

---

## 11. fork 之后怎么同步更新 · 自己继续扩充

### fork 的人：拿到原作者的新版本

1. 打开你 fork 的仓库首页，点 **Sync fork → Update branch**。
2. GitHub 会自动重新部署你的网站（只要 `main` 有更新就会部署）。
3. 打开网站，在 **系统设置 → 通用** 底部能看到版本号；对照 [CHANGELOG.md](CHANGELOG.md) 看看有没有 ⚠️ 需要手动做的事。

你的记录在你自己的浏览器 / Gist 里，**同步更新不会碰到它们**，新版本会自动把旧数据升级成新格式。

如果用的是 **Use this template**：在本地 `git remote add upstream https://github.com/yubol-bobo/LifeOS.git`，然后 `git pull upstream main` 合并。

> 为了同步不冲突：你的个人设置（Scholar ID、SerpAPI Key）放在 Variables / Secrets 里，**不要改代码文件**。只要没改过同一个文件，Sync fork 就不会出现冲突。

### 原作者 / 想自己扩充功能的人

- **在开发分支上改**，合并进 `main` 才上线（第 2 节）。
- **老数据要能自动升级**：新增的字段在 `src/store/store.ts` 的 `migrate()` 里给默认值；不要直接改名或删除字段，真要改就在 `migrate()` 里把旧值搬过去。大改之前先「导出备份」。
- **个人的东西不进仓库**：个人设置放 Secrets / Variables 或浏览器里，代码文件里只放通用默认值。
- **每次发版**：
  1. 把 `package.json` 里的 `version` 加一。
  2. 在 [CHANGELOG.md](CHANGELOG.md) 顶部写上改了什么，需要手动操作的用 ⚠️ 标出来。
  3. （可选）在 GitHub 上打一个 tag 或发一个 Release，方便 fork 的人知道该同步了。

---

## 数据在哪里？

- 你的任务、目标、心情、资产等保存在当前浏览器（localStorage）。**开启同步后**，还会加密保存一份到你自己的私密 Gist，用于多设备同步。
- 没开同步时，换电脑或清理浏览器前：**系统设置 → 通用 → 导出备份**，到新设备上 **导入备份**。
- 只有 Google Scholar 同步的数据存在仓库的 `scholar-data` 分支里（本来就是你主页上的公开信息）。

## 常见问题

**Actions 里 deploy 失败，提示 “Ensure GitHub Pages has been enabled”？** → 第 1 步，把 Pages Source 设为 GitHub Actions。

**deploy 任务 2 秒就失败、没有日志？** → 当前分支不在允许发布的列表里，见第 2 步。

**Scholar 数据一直不更新？** → 定时任务只在默认分支 `main` 上跑；确认代码已经合并到 `main`，并看第 4 步的日志对照表。
