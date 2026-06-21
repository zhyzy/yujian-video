<div align="center">

# 遇见自媒体运营系统

面向总部运营与城市账号协作的一站式自媒体运营管理后台。

![Version](https://img.shields.io/badge/version-v1.0.0-4f46e5?style=for-the-badge)
![Vue](https://img.shields.io/badge/Vue-3-42b883?style=for-the-badge&logo=vuedotjs)
![Node](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=nodedotjs)
![License](https://img.shields.io/badge/license-Proprietary-111827?style=for-the-badge)

</div>

## 项目定位

遇见自媒体运营系统用于管理总部与城市端之间的短视频运营协作流程。系统覆盖素材录入、发布排期、城市分发、账号管理、数据追踪、AI 日报和可视化页面布局配置，让多账号、多城市、多平台的运营工作可以统一管理、持续追踪和沉淀复盘。

适用场景：

- 总部统一规划内容、排期和发布任务。
- 城市账号查看自己的任务并填报发布结果。
- 运营人员追踪播放、点赞、评论、成交和金额等数据。
- 管理员通过页面布局中心调整各页面模块展示。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 管理端工作台 | 展示发布进度、月度完成度、超期任务、城市分布、快捷入口等运营概览。 |
| 素材管理 | 支持素材录入、素材列表、类型维护、文件上传和预览。 |
| 发布管理 | 支持发布日历、发布排期、发布台账和城市任务下发。 |
| 城市端协作 | 城市账号可查看任务、提交发布结果、录入数据、查看通知。 |
| 账号管理 | 维护总部账号、城市账号、其他账号和系统登录账号。 |
| 数据总览 | 汇总播放量、点赞、评论、成交、金额、平台占比和账号明细。 |
| AI 日报 | 基于运营数据生成日报，并支持手动保存报告。 |
| 页面布局 | 支持组件拖拽、显示隐藏、宽高调整、字段绑定和后端持久化。 |
| 系统设置 | 支持品牌、存储、页面文案、展示字段和全局偏好设置。 |
| 登录安全 | 支持滑块验证、登录失败限流和可配置登录有效期。 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router、Pinia、Element Plus、ECharts、Vite |
| 后端 | Node.js、Express、SQLite、better-sqlite3、JWT |
| 存储 | 本地 SQLite、腾讯云 COS |
| 工程化 | Docker、Docker Compose、1Panel 部署脚本 |

## 项目结构

```text
yujian-video/
├── backend/                 # 后端 API 服务
│   ├── server.js            # 服务入口与业务接口
│   ├── database.js          # 数据库初始化与迁移
│   ├── services/            # 后端服务模块
│   └── test/                # 后端测试
├── frontend/                # 前端管理后台
│   ├── src/views/           # 管理端与城市端页面
│   ├── src/layout-builder/  # 页面布局引擎
│   ├── src/api/             # API 封装
│   └── src/router/          # 前端路由
├── docs/                    # 项目文档
├── CHANGELOG.md             # 更新日志
├── VERSION                  # 当前版本号
├── docker-compose.yml       # Docker 编排配置
├── deploy.sh                # 部署脚本
└── README.md
```

## 快速启动

### 1. 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. 配置后端环境变量

```bash
cd backend
cp .env.example .env
```

至少需要配置：

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

如需使用腾讯云 COS 上传素材，请继续配置：

```ini
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

默认地址：`http://localhost:3001`

### 4. 启动前端

```bash
cd frontend
npm run dev
```

默认地址：`http://localhost:3000`

首次进入系统后，使用 `.env` 中配置的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录。

## 构建与测试

```bash
cd frontend
npm run build
```

```bash
cd backend
npm test
```

如果 `better-sqlite3` 与当前 Node 版本不匹配，可在后端目录执行：

```bash
npm rebuild better-sqlite3
```

## 部署

### Docker Compose

```bash
docker compose up -d --build
```

生产环境建议重点确认：

- `JWT_SECRET` 已设置为强随机字符串。
- `ADMIN_PASSWORD` 已修改为强密码。
- `DB_PATH` 指向持久化目录。
- 数据库、上传目录和日志目录有备份策略。
- COS 权限范围与上传路径符合业务安全要求。

### 1Panel

项目提供 `deploy.sh` 作为部署参考：

```bash
./deploy.sh all
```

部署前请根据服务器实际情况修改脚本中的服务器地址、部署目录和运行参数。

## 上线检查

| 检查项 | 状态 |
| --- | --- |
| 环境变量已配置 | 必须 |
| 管理员默认密码已修改 | 必须 |
| 数据库持久化目录已挂载 | 必须 |
| 上传目录和数据库已纳入备份 | 建议 |
| COS 密钥未提交到代码仓库 | 必须 |
| `.env`、数据库、日志、上传文件未提交 | 必须 |
| 前端构建通过 | 建议 |
| 后端测试通过 | 建议 |

## 版本

当前版本：`v1.0.0`

版本记录：

- [VERSION](VERSION)
- [CHANGELOG.md](CHANGELOG.md)
- [docs/version-management.md](docs/version-management.md)

## 许可证

本项目为内部业务系统，采用专有许可。未经授权，不允许复制、分发、开源、转售或用于其他商业项目。

详情见 [LICENSE](LICENSE)。
