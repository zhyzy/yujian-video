# 遇见自媒体运营系统

遇见自媒体运营系统是一套面向总部运营与城市账号协作的管理后台，覆盖素材录入、发布排期、城市分发、账号管理、数据总览、AI 日报和可视化页面布局配置。

当前版本：`v1.0.0`

## 功能概览

- 管理端工作台：今日发布、待发布、月度完成度、超期任务、城市发布分布等运营看板。
- 素材管理：素材录入、素材列表、类型管理、文件上传与预览。
- 发布管理：发布日历、发布计划、发布台账。
- 城市管理：城市看板、城市列表、城市账号与任务分发。
- 账号管理：总部账号、城市账号、其他账号、系统登录账号。
- 数据分析：数据总览、平台趋势、城市数据、账号数据。
- AI 日报：日报生成、手动保存、报告列表。
- 城市端：城市工作台、我的任务、发布填报、数据录入、通知中心。
- 页面布局：可拖拽页面组件、显示隐藏、调整宽高、字段绑定并保存到后端。
- 系统设置：品牌、存储桶、页面文案、展示字段、全局偏好配置。
- 登录安全：滑块验证、登录失败限流、可配置登录有效期。

## 技术栈

### 前端

- Vue 3
- Vue Router
- Pinia
- Element Plus
- ECharts
- Vite

### 后端

- Node.js
- Express
- SQLite / better-sqlite3
- JWT
- Tencent COS SDK
- Winston 日志

## 目录结构

```text
.
├── backend/                 # 后端 API 服务
├── frontend/                # 前端管理后台
├── docs/                    # 项目文档
├── vue-animated-login/      # 本地登录页组件依赖
├── CHANGELOG.md             # 更新日志
├── VERSION                  # 当前版本号
├── docker-compose.yml       # Docker 编排配置
├── deploy.sh                # 1Panel 部署脚本
└── README.md
```

## 本地启动

### 1. 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. 配置后端环境变量

复制后端配置模板：

```bash
cd backend
cp .env.example .env
```

至少修改这些配置：

```env
NODE_ENV=development
PORT=3001
DB_PATH=./data.db

JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=12h
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15
LOGIN_LOCK_MINUTES=15

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-before-first-start
```

如果需要 COS 上传，再配置：

```env
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=ap-shanghai
COS_DOMAIN=
COS_CDN_DOMAIN=
```

### 3. 启动后端

```bash
cd backend
npm run dev
```

默认后端地址：

```text
http://localhost:3001
```

### 4. 启动前端

```bash
cd frontend
npm run dev
```

默认前端地址：

```text
http://localhost:3000
```

## 构建与测试

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

如果后端测试提示 `better-sqlite3` 与 Node 版本不一致，请在服务器或当前机器执行：

```bash
cd backend
npm rebuild better-sqlite3
```

## 部署说明

项目包含 `docker-compose.yml` 和 `deploy.sh` 两种部署参考。

### Docker Compose

```bash
docker compose up -d --build
```

生产环境请务必挂载持久化目录，并配置：

- `DB_PATH`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- COS 存储参数

### 1Panel 部署

项目内置脚本：

```bash
./deploy.sh all
```

脚本中的服务器地址和目录需要按实际服务器修改。

## 上线前检查

- 确认 `backend/.env` 已配置强随机 `JWT_SECRET`。
- 确认初始管理员密码已修改。
- 确认数据库文件和上传目录有备份策略。
- 确认 COS 权限范围和上传路径安全。
- 不要把 `.env`、`.jwt_secret`、数据库文件、日志、上传文件提交到 GitHub。
- 服务器上不要直接复制本机 `node_modules`，应重新安装依赖。

## 版本管理

当前版本记录在：

- `VERSION`
- `CHANGELOG.md`
- `frontend/package.json`
- `backend/package.json`

版本号规则见：[docs/version-management.md](docs/version-management.md)

简单规则：

- 修复问题：`1.0.0` -> `1.0.1`
- 新增功能：`1.0.0` -> `1.1.0`
- 大版本改造：`1.0.0` -> `2.0.0`

## GitHub 提交流程

第一次提交：

```bash
git init
git add .
git commit -m "chore: initial release v1.0.0"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

后续更新：

```bash
git add .
git commit -m "feat: 描述本次功能"
git push
```

## 许可证

当前项目为内部业务系统，默认不开放许可。需要开源或商用分发前，请先补充许可证文件。
