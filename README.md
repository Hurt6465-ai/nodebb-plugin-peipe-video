# nodebb-plugin-peipe-video

Peipe /video 独立发现页插件，目标环境：NodeBB 4.10.x + HA 主题。

## 这版做了什么

- 使用 NodeBB 官方 quickstart 风格的插件结构：`plugin.json`、`library.js`、`staticDirs`、`templates`、`languages`、`static:app.load`、`static:api.routes`。
- `/video` 独立页面，不依赖帖子列表再点开全屏。
- 前端只调用聚合接口：`GET /api/v3/plugins/peipe-video/feed?page=1&pageSize=12`。
- 后端内部读取 cid=6 主题，聚合 TikTok、图片、作者、点赞数、评论数，并缓存后分发给用户。
- 公共内容缓存 72 小时；第一页短缓存；点赞/评论数短缓存；用户 liked/following 状态单独短缓存。
- 图片最多 4 张。
- 发布按钮每次进入 `/video` 时显示在右下角；用户开始上下滑后隐藏，不收缩成小 +。
- TikTok 官方 iframe 保留 `controls=1`、`volume_control=1`、`muted=0`，不遮挡官方声音区域。
- 滑屏逻辑参考开源抖音 `SlideVerticalInfinite`：虚拟渲染 5 个 slide，当前 + 下方 3 条预载。
- 图片点击后左右切换；视频上下切换。
- 单击播放/暂停，双击点赞/取消点赞。
- 右侧头像、关注 +、点赞、评论、分享。
- 底部完整用户名、正文、翻译按钮；长按正文打开翻译设置。
- 翻译语言包含：中文、英文、缅语、泰语、越南语、高棉语、老挝语、日语、韩语、马来语、菲律宾语。

## 文件结构

```text
nodebb-plugin-peipe-video/
├── package.json
├── plugin.json
├── library.js
├── templates/
│   └── video.tpl
├── static/
│   ├── video-app.js
│   └── video-app.css
└── languages/
    ├── zh-CN/peipe-video.json
    ├── en-GB/peipe-video.json
    └── my-MM/peipe-video.json
```

## 安装

```bash
cd /path/to/nodebb
unzip nodebb-plugin-peipe-video-v2.zip -d node_modules/
./nodebb build
./nodebb restart
```

然后后台启用插件：

```text
ACP → Extend → Plugins → Peipe Video Discover
```

访问：

```text
https://你的域名/video
```

## 侧栏入口

目前不自动加底部导航。可以先在 HA 主题侧栏或导航里加链接：

```text
/video
```

显示名称：发现。

## API

前端重接口只有一个：

```text
GET /api/v3/plugins/peipe-video/feed?page=1&pageSize=12
```

写操作仍使用 NodeBB 核心 API：

```text
/api/v3/posts/:pid/vote
/api/v3/users/:uid/follow
/api/post/upload
/api/v3/topics
```

这些是单次写操作，不是 feed 的 N+1 读取压力；后续也可以继续代理到插件接口。

## 缓存策略

- `feed:first-page`：2 分钟，保证新内容能较快出现。
- `feed:old-page`：72 小时，老内容基本不变。
- `feed:item:tid`：72 小时，缓存正文解析结果、TikTok id、图片、作者快照。
- `feed:counts:tid`：45 秒，缓存点赞数、评论数。
- `viewer:uid:tid`：2 分钟，缓存当前用户 liked/following。

管理员可以调用：

```text
POST /api/v3/plugins/peipe-video/cache/purge
```

清空插件内存缓存。

