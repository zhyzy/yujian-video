<div align="center">

# 🏢 遇见自媒体运营系统

> 面向总部运营与城市账号协作的一站式管理后台

![Version](https://img.shields.io/badge/version-v1.0.0-blue?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-%3E%3D16-green?style=flat-square)
![Vue](https://img.shields.io/badge/Vue-3.x-42b883?style=flat-square&logo=vuedotjs)
![Status](https://img.shields.io/badge/status-已上线-success?style=flat-square)

---

</div>

## 📋 项目简介

**遇见自媒体运营系统** 是一套面向总部运营与城市账号协作的管理后台。总部可以集中管理素材、制定排期、分发任务给各个城市账号；城市账号可以在独立的工作台中查看待办、填报发布、录入数据。

- 🎯 **目标**：让多账号多平台的短视频运营变得可追踪、可协同、可衡量
- 🗂️ **覆盖**：素材录入 · 发布排期 · 城市分发 · 账号管理 · 数据总览 · AI 日报 · 页面布局配置
- 🏢 **场景**：总部运营 + N 个城市账号，城市账号只能看到自己的数据和任务

---

## ✨ 功能一览

### 🏠 管理端（总部）

| 模块 | 功能说明 |
|---|---|
| **工作台** | 今日发布、待发布、月度完成度、超期任务、城市发布分布 |
| **素材管理** | 素材录入、素材列表、类型管理、文件上传与预览 |
| **发布管理** | 发布日历、发布计划矩阵、发布台账（按日核对每个账号的发布情况） |
| **城市管理** | 城市看板、城市列表、城市账号与任务下发 |
| **账号管理** | 总部账号、城市账号、其他账号、系统登录账号 |
| **数据分析** | 数据总览、平台趋势、城市对比、账号明细 |
| **AI 日报** | 自动生成每日运营日报、报告列表与手动保存 |
| **系统设置** | 品牌、存储桶、页面文案、展示字段、全局偏好配置 |
| **页面布局** | 拖拽式组件、显示隐藏、调整宽高、字段绑定，配置保存到后端 |
| **登录安全** | 滑块验证、登录失败限流、可配置登录有效期 |

### 🏙️ 城市端

| 模块 | 功能说明 |
|---|---|
| **城市工作台** | 本城市今日任务概览、进度、通知 |
| **我的任务** | 待办任务列表、素材下载、去发布、复制链接 |
| **发布填报** | 按日期填报发布链接、发布时间、异常原因 |
| **数据录入** | 播放量、点赞、评论、成交等数据的录入与汇总 |
| **通知中心** | 下发任务提醒、系统通知、已读标记 |
| **我的账号** | 本城市账号信息查看与修改 |
| **发布日历 / 发布台账** | 城市视角的排期与台账 |

---

## 🛠️ 技术栈

### 前端

```text
Vue 3            🟢 渐进式 JS 框架
Vue Router       🟢 前端路由
Pinia            🟢 状态管理
Element Plus     🟢 UI 组件库
ECharts          🟢 图表可视化
Vite             🟢 构建工具
```

### 后端

```text
Node.js          🟢 服务端运行时
Express          🟢 Web 框架
SQLite           🟢 本地关系型数据库（better-sqlite3）
JWT              🟢 鉴权
Tencent COS SDK  🟢 对象存储（素材文件、视频上传）
Winston          🟢 日志模块
```

---

## 📂 项目结构

```text
yujian-video/
├── backend/                 ── 后端 API 服务
│   ├── server.js            ── 入口
│   ├── db/                  ── 数据库迁移 & 初始化
│   ├── routes/              ── 路由模块
│   ├── middleware/          ── 中间件（鉴权、日志等）
│   └── data.db              ── SQLite 数据文件（首次启动自动生成）
├── frontend/                ── 前端管理后台
│   ├── src/
│   │   ├── views/           ── 页面组件（管理端 + 城市端）
│   │   ├── api/             ── API 封装
│   │   ├── layout-builder/  ── 可拖拽布局引擎
│   │   └── router/          ── 路由
│   └── vite.config.js       ── Vite 配置
├── docs/                    ── 项目文档与规划
├── vue-animated-login/      ── 本地登录页组件依赖
├── CHANGELOG.md             ── 更新日志
├── VERSION                  ── 当前版本号
├── docker-compose.yml       ── Docker 编排
├── deploy.sh                ── 1Panel 部署脚本
└── README.md
```

---

## 🚀 本地快速启动

### 第一步：安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 第二步：配置后端环境变量

```bash
cd backend
cp .env.example .env
```

**必改的几项**（`.env`）：

```ini
NODE_ENV=development
PORT=3001
DB_PATH=./data.db

JWT_SECRET=请换成一个很长的随机字符串
JWT_EXPIRES_IN=12h

LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15
LOGIN_LOCK_MINUTES=15

ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
```

**如果需要使用腾讯 COS 上传素材**，再补充：

```ini
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=ap-shanghai
COS_DOMAIN=
COS_CDN_DOMAIN=
```

### 第三步：启动后端

```bash
cd backend
npm run dev
# 服务启动在 http://localhost:3001
```

### 第四步：启动前端

```bash
cd frontend
npm run dev
# 前端启动在 http://localhost:3000
```

### 首次登录

打开浏览器访问 `http://localhost:3000`，用你在 `.env` 中配置的 `ADMIN_USERNAME / ADMIN_PASSWORD` 登录。

登录后可以在 **系统设置 → 账号管理** 中创建城市账号（角色选择 `city`，并绑定城市）。

---

## 🧪 构建与测试

### 前端构建

```bash
cd frontend
npm run build
```

### 后端测试

```bash
cd backend
npm test
```

> 如果后端测试报 `better-sqlite3` 与当前 Node 版本不一致，执行：
> ```bash
> cd backend
> npm rebuild better-sqlite3
> ```

---

## 📦 部署

### Docker Compose

```bash
docker compose up -d --build
```

生产环境请记得挂载持久化目录，并在 `.env` 中设置：

- `DB_PATH`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- COS 相关参数

### 1Panel 部署

项目内置脚本 `deploy.sh`，在仓库根目录执行：

```bash
./deploy.sh all
```

脚本中的服务器地址和目录需要按实际服务器情况修改。

---

## 🔒 上线前检查清单

- [ ] `backend/.env` 的 `JWT_SECRET` 已改成强随机字符串
- [ ] 初始管理员密码已修改
- [ ] 数据库文件和上传目录有定时备份策略
- [ ] COS 权限范围和上传路径安全
- [ ] **不要**把 `.env`、`.jwt_secret`、数据库文件、日志、上传文件提交到 Git
- [ ] 服务器上**不要**直接复制本机的 `node_modules`，需要重新 `npm install`

---

## 📌 版本管理

当前版本记录在：

- `VERSION`
- `CHANGELOG.md`
- `frontend/package.json`
- `backend/package.json`

### 简单版本规则

- 修复问题 → `1.0.0` → `1.0.1`
- 新增功能 → `1.0.0` → `1.1.0`
- 大版本改造 → `1.0.0` → `2.0.0`

详细规则见 [docs/version-management.md](docs/version-management.md)

---

## 📄 许可证

Copyright © 2026 遇见自媒体运营团队 · All Rights Reserved.

本项目为**内部业务系统**，**默认不开放任何外部许可**。

**你可以：**

- 在本组织内部使用、修改、运行本项目

**你不可以：**

- 将本项目的全部或部分代码用于对外公开、分发、再许可
- 将本项目用于商业销售或二次授权
- 移除或修改本版权声明

如需开源发布或商业分发，请先联系运营团队补充正式的 LICENSE 文件并获得书面授权。

---

<div align="center">

**Made with ❤️ by 遇见自媒体运营团队**

*当前版本 v1.0.0 · 2026*

</div>
