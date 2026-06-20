# 遇见运营中台 · 功能增强开发文档

> 参考 [vue-pure-admin](https://github.com/pure-admin/vue-pure-admin) 交互逻辑，自写实现，不直接引入其源码。
> 编写时间：2026-06-18
> 状态：待实施

---

## 一、背景与目标

### 现状
遇见运营中台已完成基础框架搭建，UI 风格精致（紫蓝渐变、圆角卡片），但以下功能缺失：

- 侧边栏固定 232px，无法折叠，小屏幕下内容区被严重挤压
- 无多标签页，频繁切换页面需反复导航
- 无面包屑导航，用户无法感知当前层级
- 无全屏切换
- 无明暗主题切换

### 目标
参考 vue-pure-admin 的交互逻辑和功能设计，用当前项目的技术栈（Vue 3 + JS + Element Plus + 现有 CSS 体系）**自写实现**，保持现有 UI 风格不变。

---

## 二、技术可行性分析

| 维度 | 当前项目 | vue-pure-admin | 兼容性 |
|------|----------|----------------|--------|
| 框架 | Vue 3.4 | Vue 3 + TS | ✅ 完全兼容 |
| UI 库 | Element Plus 2.6 | Element Plus | ✅ 完全兼容 |
| 状态管理 | Pinia（已引入未用）| Pinia 完整使用 | ✅ 直接升级 |
| 构建工具 | Vite 5 | Vite 7 | ✅ 无冲突 |
| 样式方案 | 纯 CSS + 内联 style | Tailwind CSS | ⚠️ 需自写样式 |
| 语言 | JavaScript | TypeScript | ⚠️ 需 JS 重写 |

**结论**：技术栈高度兼容，但因样式体系（Tailwind vs 纯 CSS）和语言（TS vs JS）不同，**不能**直接引入 vue-pure-admin 源码，应参考其逻辑自写。

---

## 三、功能改造清单

### P0 — 必做（本次实施）

| 功能 | 说明 | 参考来源 |
|------|------|----------|
| 布局组件化拆分 | 将 App.vue 拆分为独立 layout 组件 | vue-pure-admin `src/layout/` |
| 侧边栏折叠/展开 | 折叠时 64px（icon-only），展开 232px，过渡动画 | `useAppStore.toggleSideBar()` |
| Pinia 状态管理升级 | 将 systemSettings.js 的 localStorage 逻辑迁移到 Pinia store | `store/modules/app.ts` |
| 多标签页（tagsView） | 顶部多标签，支持关闭/刷新/右键菜单 | `useTag.ts` + `lay-tag/index.vue` |

### P1 — 建议做（第二阶段）

| 功能 | 说明 |
|------|------|
| 面包屑导航 | 扩展路由 meta，在 topbar 显示层级面包屑 |
| 全屏切换 | topbar-right 加全屏按钮，调用 Fullscreen API |
| 系统设置面板 | 设置抽屉，控制折叠偏好、标签风格等 |

### P2 — 可选（按需）

| 功能 | 说明 | 难度 |
|------|------|------|
| 明暗主题切换 | CSS 变量体系 + 顶层 class 切换 | 中等 |
| 按钮级权限指令 | `v-permission` 指令，根据角色隐藏按钮 | 中等 |
| 菜单布局模式切换 | 左侧/顶部/混合，需大幅重构 | 较难 |

---

## 四、详细技术方案

---

### 4.1 布局组件化拆分

#### 现状问题
`App.vue` 当前 937 行，承担了：布局骨架、侧边栏、topbar、通知、搜索、移动端适配。**单体过大，难以维护，也无法接入新功能。**

#### 目标结构

```
frontend/src/
├── layout/
│   ├── index.vue           # 主布局骨架（grid 布局）
│   ├── components/
│   │   ├── AppSidebar.vue  # 侧边栏（含折叠逻辑）
│   │   ├── AppTopbar.vue   # 顶部栏（面包屑+搜索+通知+用户）
│   │   ├── AppTags.vue     # 多标签页（新增）
│   │   └── AppBreadcrumb.vue  # 面包屑（新增）
│   └── hooks/
│       └── useLayout.js    # 布局相关逻辑（折叠状态、响应式）
├── store/
│   ├── app.js             # 布局状态（sidebar 折叠、设备类型）
│   ├── multiTags.js       # 多标签页状态
│   └── settings.js        # 系统设置（从 systemSettings.js 迁移）
└── router/
    └── modules/           # 路由按模块拆分（已有，保持不变）
```

#### 拆分步骤

1. **新建 `layout/index.vue`**：只保留 grid 布局骨架，引入 `AppSidebar`、`AppTopbar`、`AppTags`、`router-view`
2. **提取 `AppSidebar.vue`**：将原 `App.vue` 的 `<aside class="sidebar">` 区块移入，接收 `isCollapsed` prop
3. **提取 `AppTopbar.vue`**：将原 `<header class="topbar">` 区块移入
4. **修改 `App.vue`**：只保留移动端 `mobile-topbar` + `mobile-tabbar` + `<router-view>`，桌面端渲染 `<layout>`

---

### 4.2 侧边栏折叠功能

#### 参考逻辑（来自 vue-pure-admin）

```ts
// store/modules/app.ts 核心逻辑
TOGGLE_SIDEBAR(opened?: boolean, resize?: string) {
  if (opened && resize) {
    // 响应式：窗口变大，恢复展开
    this.sidebar.opened = true;
  } else if (!opened && resize) {
    // 响应式：窗口变小，自动折叠
    this.sidebar.opened = false;
  } else {
    // 用户点击：切换状态
    this.sidebar.opened = !this.sidebar.opened;
    this.sidebar.isClickCollapse = !this.sidebar.opened;
  }
  // 持久化到 localStorage
  storageLocal().setItem(`layout`, { ...layout, sidebarStatus: this.sidebar.opened });
}
```

#### 自写实现方案

**状态管理（Pinia store）**：

```js
// frontend/src/store/app.js
import { defineStore, storeToRefs } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebar: {
      opened: localStorage.getItem('sidebar_opened') !== 'false',
      withoutAnimation: false
    }
  }),
  actions: {
    toggleSidebar(forceClose) {
      if (forceClose !== undefined) {
        this.sidebar.opened = !forceClose
      } else {
        this.sidebar.opened = !this.sidebar.opened
      }
      localStorage.setItem('sidebar_opened', String(this.sidebar.opened))
    }
  }
})
```

**侧边栏宽度过渡（CSS）**：

```scss
// 展开态
.sidebar {
  width: 232px;
  transition: width 0.3s ease;
}

// 折叠态
.sidebar.is-collapsed {
  width: 64px;

  .brand-text,
  .nav-section,
  .nav-item span,
  .nav-group span,
  .sidebar-foot {
    display: none;
  }

  .brand-logo {
    margin: 0 auto;
  }

  .nav-item,
  .nav-group {
    justify-content: center;
    padding: 9px 0;
  }
}
```

**折叠按钮位置**：放在侧边栏底部（sidebar-foot 区域），或者顶部 brand 右侧。

**Tooltip 显示**：折叠态下，鼠标 hover 导航项时，用 Element Plus `<el-tooltip>` 显示菜单名称。

**响应式折叠**：监听 `window.resize`，宽度 < 990px 时自动折叠，< 760px 时隐藏侧边栏（移动端已有处理）。

---

### 4.3 多标签页（tagsView）

#### 参考逻辑（来自 vue-pure-admin）

核心数据结构（`multiTags` store）：
```ts
// 每个标签
{
  path: '/dashboard',
  name: 'Dashboard',
  meta: { title: '工作台', icon: 'home' }
}
```

核心行为：
1. **路由切换时**：自动将当前路由加入 `multiTags`（去重）
2. **点击标签**：`router.push(tag.path)`
3. **关闭标签**：从 `multiTags` 中移除，若关闭的是当前页，自动跳转到最后一个标签
4. **右键菜单**：刷新、关闭当前、关闭左侧、关闭右侧、关闭其他、关闭全部

#### 自写实现方案

**Pinia store（multiTags）**：

```js
// frontend/src/store/multiTags.js
export const useMultiTagsStore = defineStore('multiTags', {
  state: () => ({
    multiTags: [
      // 固定首页标签（不可关闭）
      { path: '/dashboard', name: 'Dashboard', meta: { title: '工作台' } }
    ]
  }),
  actions: {
    addTag(route) {
      const exists = this.multiTags.some(t => t.path === route.path)
      if (!exists) {
        this.multiTags.push({
          path: route.path,
          name: route.name,
          meta: route.meta,
          query: route.query,
          params: route.params
        })
      }
    },
    removeTag(index) {
      this.multiTags.splice(index, 1)
    },
    removeOtherTags(currentPath) {
      this.multiTags = this.multiTags.filter(
        (t, i) => i === 0 || t.path === currentPath
      )
    }
  }
})
```

**AppTags.vue 组件结构**：

```vue
<template>
  <div class="tags-view">
    <div class="tags-scroll">
      <div
        v-for="(tag, index) in multiTags"
        :key="tag.path"
        class="tag-item"
        :class="{ active: tag.path === $route.path }"
        @click="router.push(tag.path)"
      >
        <span>{{ tag.meta.title }}</span>
        <span
          v-if="index !== 0"
          class="tag-close"
          @click.stop="removeTag(index)"
        >×</span>
      </div>
    </div>
  </div>
</template>
```

**样式设计（保持现有 UI 风格）**：

```scss
.tags-view {
  background: #fff;
  border-bottom: 1px solid #ececf1;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  color: #4b5563;
  background: #f5f6fa;
  cursor: pointer;
  transition: background 0.18s;

  &.active {
    background: linear-gradient(90deg, #eef2ff, #f5f3ff);
    color: #4338ca;
    font-weight: 600;
  }

  &:hover:not(.active) {
    background: #eef2ff;
  }
}

.tag-close {
  font-size: 14px;
  color: #9ca3af;
  &:hover { color: #4338ca; }
}
```

**路由监听（自动添加标签）**：

```js
// 在 AppTags.vue 或 layout/index.vue 中
watch(() => route.path, () => {
  multiTagsStore.addTag(route)
}, { immediate: true })
```

---

### 4.4 Pinia 状态管理升级

#### 现状
`systemSettings.js` 使用 `localStorage` + `window.addEventListener('storage')` + 自定义事件 `system-settings-updated` 实现跨组件状态同步，较繁琐。

#### 升级方案

保留 `systemSettings.js` 作为持久化工具函数，新增 Pinia store：

```js
// frontend/src/store/settings.js
export const useSettingsStore = defineStore('settings', {
  state: () => ({
    brand: { name: '遇见运营中台', logoUrl: '', subtitle: 'Media Operations' },
    preferences: { compactMode: false, enableNotifications: true }
  }),
  actions: {
    async loadFromRemote() {
      const data = await getSystemSettings()
      this.$patch(data)
      localStorage.setItem('system_settings', JSON.stringify(data))
    }
  }
})
```

`systemSettings.js` 保留，但改为只负责 localStorage 的读写，不再负责状态同步。

---

### 4.5 面包屑导航

#### 实现方案

1. **扩展路由 meta**：在每个路由定义中添加 `meta.breadcrumb` 或利用 `meta.title` 自动生成

```js
// router 定义
{
  path: '/material/list',
  name: 'MaterialList',
  meta: { title: '素材列表', breadcrumb: ['素材', '素材列表'] },
  component: () => import('@/views/MaterialList.vue')
}
```

2. **AppBreadcrumb.vue 组件**：

```vue
<template>
  <div class="breadcrumb">
    <span
      v-for="(item, index) in breadcrumbList"
      :key="index"
      :class="{ 'is-link': index < breadcrumbList.length - 1 }"
      @click="index < breadcrumbList.length - 1 && router.push(item.path)"
    >
      {{ item.title }}
      <span v-if="index < breadcrumbList.length - 1" class="separator">/</span>
    </span>
  </div>
</template>
```

---

### 4.6 全屏切换

#### 实现方案

使用浏览器原生 Fullscreen API，封装一个工具函数：

```js
// frontend/src/utils/fullscreen.js
export function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}
```

在 `AppTopbar.vue` 的 `topbar-right` 区域添加一个全屏按钮：

```vue
<button class="icon-btn" title="全屏" @click="toggleFullscreen">
  <IconFont :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'" />
</button>
```

---

### 4.7 明暗主题切换（P2 可选）

#### 实现方案

1. **建立 CSS 变量体系**：在 `:root` 定义一套亮色变量，在 `.dark` 下定义暗色变量
2. **切换方式**：在 `<html>` 或 `#app` 上切换 class

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f6fa;
  --text-primary: #111827;
  --border-color: #ececf1;
}

.dark {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --text-primary: #f9fafb;
  --border-color: #374151;
}
```

3. **切换按钮**：放在 `AppTopbar.vue` 或系统设置面板中

---

## 五、实施步骤（分阶段）

### 第一阶段：布局组件化 + 侧边栏折叠（P0）

1. 新建 `frontend/src/store/app.js`（Pinia store，管理 sidebar 状态）
2. 新建 `frontend/src/layout/components/AppSidebar.vue`，将原侧边栏移入，添加折叠态样式
3. 新建 `frontend/src/layout/components/AppTopbar.vue`，将原 topbar 移入
4. 新建 `frontend/src/layout/index.vue`，组合 Sidebar + Topbar + router-view
5. 修改 `App.vue`，引用 `layout/index.vue`
6. 添加折叠按钮，绑定 `toggleSidebar`  action
7. 添加折叠态 tooltip
8. 添加响应式折叠（resize 监听）

### 第二阶段：多标签页（P0）

9. 新建 `frontend/src/store/multiTags.js`
10. 新建 `frontend/src/layout/components/AppTags.vue`
11. 在 `layout/index.vue` 中添加 Tags 区域
12. 实现标签点击切换
13. 实现标签关闭（含首页保护）
14. 实现右键菜单（刷新、关闭其他等）
15. 样式适配现有 UI 风格

### 第三阶段：体验增强（P1）

16. 新建 `AppBreadcrumb.vue`，接入路由 meta
17. 在 Topbar 左侧显示面包屑
18. 添加全屏切换按钮
19. 新建系统设置面板（抽屉式）

---

## 六、关键文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/store/app.js` | 新建 | 布局状态（sidebar 折叠） |
| `frontend/src/store/multiTags.js` | 新建 | 多标签页状态 |
| `frontend/src/store/settings.js` | 新建 | 系统设置状态（从 systemSettings.js 迁移）|
| `frontend/src/layout/index.vue` | 新建 | 主布局骨架 |
| `frontend/src/layout/components/AppSidebar.vue` | 新建 | 侧边栏组件 |
| `frontend/src/layout/components/AppTopbar.vue` | 新建 | 顶部栏组件 |
| `frontend/src/layout/components/AppTags.vue` | 新建 | 多标签页组件 |
| `frontend/src/layout/components/AppBreadcrumb.vue` | 新建 | 面包屑组件 |
| `frontend/src/App.vue` | 修改 | 引用 layout，精简为移动端 + router-view |
| `frontend/src/utils/systemSettings.js` | 修改 | 保留持久化函数，移除事件逻辑 |
| `frontend/src/router/index.js` | 修改 | 扩展 meta（breadcrumb 等）|

---

## 七、注意事项

1. **保持 UI 风格**：所有新组件必须使用现有的配色体系（紫蓝 `#4338ca` / `#6366f1`，圆角 `8-12px`，背景 `#f5f6fa`），不可引入 Tailwind 或 vue-pure-admin 的样式
2. **Pinia 注册**：新建的 store 需在 `main.js` 中注册 `app.use(pinia)`
3. **移动端兼容**：侧边栏折叠只在桌面端生效，移动端保持现有 drawer 式交互
4. **持久化**：sidebar 折叠状态需持久化到 localStorage，页面刷新后保持
5. **性能**：多标签页需注意组件缓存（`keep-alive`），避免切换时重复渲染

---

## 八、参考资源

- vue-pure-admin 源码：`/Users/zhanglin/Documents/xitongkaifa/vue-pure-admin-main/`
- 侧边栏状态管理：`src/store/modules/app.ts`
- 多标签页 hooks：`src/layout/hooks/useTag.ts`
- 多标签页组件：`src/layout/components/lay-tag/index.vue`
- 主布局：`src/layout/index.vue`
- 项目技术栈说明：`/Users/zhanglin/Documents/xitongkaifa/.workbuddy/memory/MEMORY.md`
