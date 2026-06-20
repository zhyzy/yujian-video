<template>
  <router-view v-if="isPublicPage" />
  <div v-else class="app-shell" :class="{ 'is-compact': systemSettings.preferences.compactMode, 'is-collapsed': sidebarCollapsed }">
    <header class="mobile-topbar">
      <div class="mobile-brand">
        <img v-if="brandLogo" :src="brandLogo" :alt="brandName" class="mobile-logo">
        <div v-else class="mobile-logo mobile-logo-text">{{ brandName.slice(0, 1) || '遇' }}</div>
        <div class="mobile-title">
          <strong>{{ route.meta.title || brandName }}</strong>
          <span>{{ roleLabel }}</span>
        </div>
      </div>
      <div class="mobile-actions">
        <el-popover v-if="systemSettings.preferences.enableNotifications" placement="bottom-end" :width="300" trigger="click" @show="loadNotifications">
          <template #reference>
            <button class="icon-btn" title="通知">
              <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount">
                <IconFont name="notice" :fallback="Bell" />
              </el-badge>
            </button>
          </template>
          <div class="notice-pop">
            <div class="notice-pop-head">
              <strong>通知提醒</strong>
              <router-link to="/city/notifications">查看全部</router-link>
            </div>
            <div v-if="topNotifications.length" class="notice-pop-list">
              <div v-for="notice in topNotifications" :key="notice.id" class="notice-pop-item">
                <strong>{{ notice.title }}</strong>
                <span>{{ notice.content || notice.created_at }}</span>
              </div>
            </div>
            <div v-else class="notice-pop-empty">暂无新通知</div>
          </div>
        </el-popover>
        <button class="mobile-avatar" title="退出登录" @click="logout">
          <img v-if="avatarUrl" :src="avatarUrl" alt="账户头像">
          <span v-else>{{ userName.slice(0, 1).toUpperCase() }}</span>
        </button>
      </div>
    </header>

    <aside class="sidebar">
      <div class="brand">
        <img v-if="brandLogo" :src="brandLogo" :alt="brandName" class="brand-logo">
        <div v-else class="brand-logo brand-logo-text">{{ brandName.slice(0, 1) || '遇' }}</div>
        <div class="brand-text">
          <strong>{{ brandName }}</strong>
          <span>{{ brandSubtitle }}</span>
        </div>
      </div>

      <nav ref="navRef" class="nav" @scroll.passive="rememberNavScroll">
        <template v-for="section in filteredNavSections" :key="section.title || 'home'">
          <template v-for="item in section.items" :key="item.to || item.iconKey">
            <div
              v-if="item.children"
              class="nav-group-with-children"
              :class="{ expanded: expandedMenus.has(item.iconKey) }"
            >
              <el-tooltip :disabled="!sidebarCollapsed" :content="item.label" placement="right" :show-after="250">
                <div class="nav-group-header" @click="toggleMenuExpand(item.iconKey)">
                  <IconFont class="nav-icon" :name="item.iconKey" :fallback="item.icon" />
                  <span>{{ item.label }}</span>
                  <el-icon class="expand-arrow"><ArrowDown /></el-icon>
                </div>
              </el-tooltip>
              <transition name="slide">
                <div v-show="expandedMenus.has(item.iconKey)" class="nav-group-children">
                  <el-tooltip
                    v-for="child in item.children"
                    :key="child.to"
                    :disabled="!sidebarCollapsed"
                    :content="child.label"
                    placement="right"
                    :show-after="250"
                  >
                    <router-link
                      :to="child.to"
                      class="nav-item nav-child"
                      active-class="active"
                    >
                      <IconFont class="nav-icon" :name="child.iconKey" :fallback="child.icon" />
                      <span>{{ child.label }}</span>
                    </router-link>
                  </el-tooltip>
                </div>
              </transition>
            </div>
            <el-tooltip v-else :disabled="!sidebarCollapsed" :content="item.label" placement="right" :show-after="250">
              <router-link
                :to="item.to"
                :class="item.primary ? 'nav-group' : 'nav-item'"
                active-class="active"
              >
                <IconFont class="nav-icon" :name="item.iconKey" :fallback="item.icon" />
                <span>{{ item.label }}</span>
              </router-link>
            </el-tooltip>
          </template>
        </template>
      </nav>

      <div class="sidebar-foot">
        <div class="foot-card">
          <div class="foot-title">{{ userName }} · {{ roleLabel }}</div>
          <div class="foot-sub">本月完成 {{ monthProgress }}% · {{ monthProgressStatus }}</div>
          <div class="foot-bar"><i :style="{ width: monthProgress + '%' }"></i></div>
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div class="topbar-left">
          <div class="breadcrumb">
            <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path || crumb.title">
              <button
                class="breadcrumb-item"
                :class="{ current: index === breadcrumbs.length - 1 }"
                :disabled="index === breadcrumbs.length - 1 || !crumb.path"
                @click="router.push(crumb.path)"
              >
                {{ crumb.title }}
              </button>
              <span v-if="index < breadcrumbs.length - 1" class="breadcrumb-separator">/</span>
            </template>
          </div>
          <div v-if="systemSettings.preferences.showGlobalSearch" class="search">
            <IconFont name="search" :fallback="Search" />
            <input
              v-model.trim="searchText"
              placeholder="搜索账号、视频、城市..."
              @keydown.enter="runSearch"
            />
            <kbd>Enter</kbd>
          </div>
        </div>
        <div class="topbar-right">
          <button class="icon-btn" :title="isDark ? '切换到浅色模式' : '切换到深色模式'" @click="handleToggleDarkMode">
            <el-icon><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
          </button>
          <button class="icon-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="handleFullscreen">
            <el-icon><FullScreen /></el-icon>
          </button>
          <button
            v-if="systemSettings.preferences.enableNotifications"
            class="icon-btn notification-trigger"
            title="消息中心"
            @click="openNotificationCenter"
          >
            <el-badge :value="unreadCount" :max="99" :hidden="!unreadCount" :offset="[-2, 2]">
              <IconFont name="notice" :fallback="Bell" />
            </el-badge>
          </button>
          <button class="user-chip" title="退出登录" @click="logout">
            <img v-if="avatarUrl" class="avatar avatar-img" :src="avatarUrl" alt="账户头像">
            <div v-else class="avatar">{{ userName.slice(0, 1).toUpperCase() }}</div>
            <div class="user-meta">
              <strong>{{ userName }}</strong>
              <span>{{ roleLabel }}</span>
            </div>
          </button>
        </div>
      </header>

      <div class="tags-view">
        <div class="tags-scroll">
          <button
            v-for="(tag, index) in multiTags"
            :key="tag.path"
            class="tag-item"
            :class="{ active: tag.path === route.path }"
            @click="openTag(tag)"
            @contextmenu.prevent="openTagMenu($event, tag, index)"
          >
            <span>{{ tag.title }}</span>
            <el-icon v-if="tag.path !== homeTag.path" class="tag-close" @click.stop="closeTag(tag)"><Close /></el-icon>
          </button>
        </div>
      </div>

      <section ref="viewRef" class="view" @scroll.passive="rememberViewScroll">
        <div v-if="routeError" class="route-error">
          <div class="route-error-card">
            <strong>页面加载失败</strong>
            <span>{{ routeError }}</span>
            <div class="route-error-actions">
              <button class="primary-mini" @click="reloadCurrentPage">刷新页面</button>
              <button class="ghost-mini" @click="clearRouteError">重试</button>
            </div>
          </div>
        </div>
        <router-view v-else v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </section>

      <teleport to="body">
        <div
          v-if="tagMenu.visible"
          class="tag-context-menu"
          :style="{ left: `${tagMenu.x}px`, top: `${tagMenu.y}px` }"
          @click.stop
        >
          <button @click="refreshTag(tagMenu.tag)">刷新当前</button>
          <button :disabled="tagMenu.tag?.path === homeTag.path" @click="closeTag(tagMenu.tag)">关闭当前</button>
          <button @click="closeLeftTags(tagMenu.tag)">关闭左侧</button>
          <button @click="closeRightTags(tagMenu.tag)">关闭右侧</button>
          <button @click="closeOtherTags(tagMenu.tag)">关闭其他</button>
          <button @click="closeAllTags">关闭全部</button>
        </div>
      </teleport>
    </main>

    <!-- 消息通知中心 -->
    <NotificationCenter
      ref="notificationRef"
      :messages="allNotifications"
      :loading="notificationsLoading"
      @read="handleNotificationRead"
      @update="handleNotificationUpdate"
      @action="handleNotificationAction"
    />

    <nav class="mobile-tabbar">
      <router-link
        v-for="item in mobileNavItems"
        :key="item.to"
        :to="item.to"
        class="mobile-tab"
        active-class="active"
      >
        <IconFont class="mobile-tab-icon" :name="item.iconKey" :fallback="item.icon" />
        <span>{{ item.mobileLabel || item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onErrorCaptured, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import IconFont from '@/components/IconFont.vue'
import NotificationCenter from '@/components/NotificationCenter.vue'
import {
  ArrowDown,
  Bell,
  Calendar,
  Close,
  Collection,
  DataAnalysis,
  EditPen,
  Expand,
  Files,
  Fold,
  FullScreen,
  Grid,
  HomeFilled,
  List,
  Location,
  LocationFilled,
  MagicStick,
  Monitor,
  Moon,
  OfficeBuilding,
  Search,
  Setting,
  Sunny,
  Tickets,
  User
} from '@element-plus/icons-vue'
import { loadSystemSettings, syncSystemSettingsFromRemote } from '@/utils/systemSettings'
import { isCityUser } from '@/utils/authRole'
import { getNotifications, getTaskProgress, markAllNotificationsRead, markNotificationRead } from '@/api'
import { useAppStore } from '@/store/app'
import { useMultiTagsStore } from '@/store/multiTags'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const multiTagsStore = useMultiTagsStore()
const { sidebarCollapsed, isFullscreen, isDark } = storeToRefs(appStore)
const { visibleTags: multiTags, homeTag } = storeToRefs(multiTagsStore)
const searchText = ref('')
const systemSettings = ref(loadSystemSettings())
const taskProgress = ref({ progress: { percentage: 0, status: '进行中' } })
const topNotifications = ref([])
const unreadCount = ref(0)
const navRef = ref(null)
const viewRef = ref(null)
const navScrollTop = ref(Number(sessionStorage.getItem('app_nav_scroll_top') || 0))
const viewScrollPositions = new Map()
const routeError = ref('')
const expandedMenus = ref(new Set())
const notificationRef = ref(null)
const notificationsLoading = ref(false)
const allNotifications = ref([])

const handleToggleDarkMode = () => {
  appStore.toggleDarkMode()
}

const openNotificationCenter = () => {
  notificationRef.value?.openDrawer()
}
const tagMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  tag: null,
  index: -1
})

const readCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('auth_user') || '{}')
  } catch {
    return {}
  }
}
const currentUser = ref(readCurrentUser())

const navSections = [
  { items: [{ to: '/dashboard', label: '工作台', icon: HomeFilled, iconKey: 'dashboard', primary: true }] },
  {
    title: '素材',
    items: [
      {
        label: '素材管理',
        icon: EditPen,
        iconKey: 'material',
        children: [
          { to: '/material/entry', label: '素材录入', icon: EditPen, iconKey: 'materialEntry' },
          { to: '/material/list', label: '素材列表', icon: Tickets, iconKey: 'materialList' },
          { to: '/material/types', label: '类型管理', icon: Grid, iconKey: 'materialType' }
        ]
      }
    ]
  },
  {
    title: '发布',
    items: [
      {
        label: '发布管理',
        icon: Calendar,
        iconKey: 'publish',
        children: [
          { to: '/publish/calendar', label: '发布日历', icon: Calendar, iconKey: 'calendar' },
          { to: '/publish/list', label: '发布计划', icon: List, iconKey: 'publishPlan' },
          { to: '/publish/ledger', label: '发布台账', icon: Tickets, iconKey: 'ledger' }
        ]
      }
    ]
  },
  {
    title: '城市',
    items: [
      {
        label: '城市管理',
        icon: Monitor,
        iconKey: 'city',
        children: [
          { to: '/city/board', label: '城市看板', icon: Monitor, iconKey: 'cityBoard' },
          { to: '/city/list', label: '城市管理', icon: Location, iconKey: 'cityManage' }
        ]
      }
    ]
  },
  {
    title: '分析',
    items: [
      {
        label: '数据分析',
        icon: DataAnalysis,
        iconKey: 'analysis',
        children: [
          { to: '/data/overview', label: '数据总览', icon: DataAnalysis, iconKey: 'data' },
          { to: '/ai/reports', label: 'AI 日报', icon: MagicStick, iconKey: 'ai' }
        ]
      }
    ]
  },
  {
    title: '账号',
    items: [
      {
        label: '账号管理',
        icon: OfficeBuilding,
        iconKey: 'account',
        children: [
          { to: '/accounts/hq', label: '总部账号', icon: OfficeBuilding, iconKey: 'hqAccount' },
          { to: '/accounts/city', label: '城市账号', icon: LocationFilled, iconKey: 'cityAccount' },
          { to: '/accounts/other', label: '其他账号', icon: Collection, iconKey: 'otherAccount' }
        ]
      }
    ]
  },
  {
    title: '系统',
    items: [
      {
        label: '系统管理',
        icon: Setting,
        iconKey: 'system',
        children: [
          { to: '/system/settings', label: '系统设置', icon: Setting, iconKey: 'settings' },
          { to: '/system/page-layout', label: '页面布局', icon: Grid, iconKey: 'layout' },
          { to: '/system/component-library', label: '组件库', icon: Files, iconKey: 'component' },
          { to: '/system/accounts', label: '账号管理', icon: OfficeBuilding, iconKey: 'account' }
        ]
      }
    ]
  }
]
const cityNavSections = [
  {
    items: [
      { to: '/city/workbench', label: '城市工作台', icon: HomeFilled, iconKey: 'dashboard', primary: true }
    ]
  },
  {
    title: '任务管理',
    items: [
      {
        label: '任务管理',
        icon: Monitor,
        iconKey: 'task',
        children: [
          { to: '/city/tasks', label: '我的任务', icon: Monitor, iconKey: 'cityTask' },
          { to: '/city/publish-submit', label: '发布填报', icon: EditPen, iconKey: 'publishPlan' },
          { to: '/city/data-entry', label: '数据录入', icon: DataAnalysis, iconKey: 'dataEntry' }
        ]
      }
    ]
  },
  {
    title: '发布管理',
    items: [
      {
        label: '发布管理',
        icon: Calendar,
        iconKey: 'publish',
        children: [
          { to: '/publish/calendar', label: '发布日历', icon: Calendar, iconKey: 'calendar' },
          { to: '/publish/ledger', label: '发布台账', icon: Tickets, iconKey: 'ledger' }
        ]
      }
    ]
  },
  {
    title: '信息管理',
    items: [
      {
        label: '信息管理',
        icon: DataAnalysis,
        iconKey: 'info',
        children: [
          { to: '/data/overview', label: '数据总览', icon: DataAnalysis, iconKey: 'data' },
          { to: '/city/notifications', label: '消息管理', icon: Bell, iconKey: 'notice' },
          { to: '/city/accounts', label: '我的账号', icon: User, iconKey: 'account' }
        ]
      }
    ]
  }
]

const isPublicPage = computed(() => Boolean(route.meta.public))
const filteredNavSections = computed(() => isCityUser(currentUser.value) ? cityNavSections : navSections)
const brandLogo = computed(() => {
  const url = systemSettings.value.brand.logoUrl || ''
  return url === '/logo.png' ? '/logo2.png' : url
})
const brandName = computed(() => systemSettings.value.brand.name || '遇见运营中台')
const brandSubtitle = computed(() => systemSettings.value.brand.subtitle || 'Media Operations')
const avatarUrl = computed(() => systemSettings.value.profile.avatarUrl || currentUser.value.avatarUrl || '')
const userName = computed(() => systemSettings.value.profile.displayName || currentUser.value.name || currentUser.value.username || '用户')
const roleLabel = computed(() => {
  if (systemSettings.value.profile.roleLabel) return systemSettings.value.profile.roleLabel
  const role = currentUser.value.role
  if (role === 'admin') return '超级管理员'
  if (isCityUser(currentUser.value)) return '城市账号'
  if (role === 'viewer') return '只读账号'
  return '运营账号'
})
const monthProgress = computed(() => Math.min(100, Math.max(0, Number(taskProgress.value?.progress?.percentage || 0))))
const monthProgressStatus = computed(() => taskProgress.value?.progress?.status || (monthProgress.value >= 100 ? '目标达成' : '进行中'))
const mobileNavItems = computed(() => {
  if (isCityUser(currentUser.value)) {
    return [
      { to: '/city/workbench', label: '工作台', icon: HomeFilled, iconKey: 'dashboard' },
      { to: '/city/tasks', label: '任务', icon: Monitor, iconKey: 'cityBoard' },
      { to: '/city/publish-submit', label: '填报', icon: EditPen, iconKey: 'publishPlan' },
      { to: '/city/notifications', label: '通知', icon: Bell, iconKey: 'notice' },
      { to: '/city/data-entry', label: '数据', icon: DataAnalysis, iconKey: 'data' }
    ]
  }
  return [
    { to: '/dashboard', label: '工作台', icon: HomeFilled, iconKey: 'dashboard' },
    { to: '/material/entry', label: '素材', icon: EditPen, iconKey: 'materialEntry' },
    { to: '/publish/list', label: '发布', icon: List, iconKey: 'publishPlan' },
    { to: '/city/board', label: '城市', icon: Monitor, iconKey: 'cityBoard' },
    { to: '/data/overview', label: '数据', icon: DataAnalysis, iconKey: 'data' }
  ]
})
const breadcrumbs = computed(() => {
  const metaBreadcrumb = route.meta.breadcrumb
  if (Array.isArray(metaBreadcrumb) && metaBreadcrumb.length) {
    return metaBreadcrumb.map((item) => typeof item === 'string' ? { title: item } : item)
  }
  for (const section of filteredNavSections.value) {
    for (const item of section.items) {
      if (item.to === route.path) {
        return [{ title: '首页', path: homeTag.value.path }, { title: item.label, path: item.to }]
      }
      const child = item.children?.find((candidate) => candidate.to === route.path)
      if (child) {
        return [{ title: item.label }, { title: child.label, path: child.to }]
      }
    }
  }
  return [{ title: route.meta.title || '工作台', path: route.path }]
})

const runSearch = () => {
  if (!searchText.value) return
  ElMessage.info('全局搜索功能待接入，已先跳转到素材列表')
  router.push({ path: '/material/list', query: { keyword: searchText.value } })
}

const logout = () => {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  router.push('/login')
}

const toggleSidebar = () => {
  appStore.toggleSidebar()
}

const handleFullscreen = async () => {
  try {
    await appStore.toggleFullscreen()
  } catch {
    ElMessage.warning('当前浏览器暂不支持全屏切换')
  }
}

const toggleMenuExpand = (menuKey) => {
  if (expandedMenus.value.has(menuKey)) {
    expandedMenus.value.delete(menuKey)
  } else {
    expandedMenus.value.clear()
    expandedMenus.value.add(menuKey)
  }
  expandedMenus.value = new Set(expandedMenus.value)
}

const refreshSystemSettings = (event) => {
  systemSettings.value = event?.detail || loadSystemSettings()
  currentUser.value = readCurrentUser()
  loadTaskProgress()
}

const syncSystemSettings = async () => {
  if (isPublicPage.value || !localStorage.getItem('auth_token')) return
  try {
    systemSettings.value = await syncSystemSettingsFromRemote()
  } catch (error) {
    ElMessage.warning(`后台系统设置加载失败，已使用本地缓存：${error?.message || '未知错误'}`)
  }
}

const loadTaskProgress = async () => {
  if (isPublicPage.value || !localStorage.getItem('auth_token')) return
  try {
    taskProgress.value = await getTaskProgress()
  } catch {
    taskProgress.value = { progress: { percentage: 0, status: '进行中' } }
  }
}
const loadNotifications = async () => {
  if (isPublicPage.value || !localStorage.getItem('auth_token')) return
  try {
    const data = await getNotifications({ pageSize: 5 })
    topNotifications.value = data.list || []
    unreadCount.value = data.unread || 0
  } catch {
    topNotifications.value = []
    unreadCount.value = 0
  }
}

// 加载完整通知列表
const loadAllNotifications = async () => {
  if (isPublicPage.value || !localStorage.getItem('auth_token')) return
  notificationsLoading.value = true
  try {
    const data = await getNotifications({ pageSize: 50 })
    allNotifications.value = data.list || []
    unreadCount.value = data.unread || 0
  } catch {
    allNotifications.value = []
    unreadCount.value = 0
  } finally {
    notificationsLoading.value = false
  }
}

// 处理通知已读
const handleNotificationRead = async (id) => {
  try {
    await markNotificationRead(id)
    const notification = allNotifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
      notification.is_read = 1
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  } catch (error) {
    ElMessage.error(`标记通知已读失败：${error?.message || '未知错误'}`)
  }
}

// 处理通知更新
const handleNotificationUpdate = async ({ action }) => {
  if (action === 'markAllRead') {
    try {
      await markAllNotificationsRead()
      allNotifications.value.forEach(n => { n.read = true; n.is_read = 1 })
      unreadCount.value = 0
    } catch (error) {
      ElMessage.error(`标记全部已读失败：${error?.message || '未知错误'}`)
    }
  }
}

// 处理通知操作
const handleNotificationAction = ({ message, action }) => {
  if (action.url) {
    router.push(action.url)
  }
}

const clearRouteError = () => {
  routeError.value = ''
}

const reloadCurrentPage = () => {
  window.location.reload()
}

const closeTagMenu = () => {
  tagMenu.visible = false
}

const openTag = (tag) => {
  closeTagMenu()
  if (!tag || tag.path === route.path) return
  router.push(tag.fullPath || tag.path)
}

const getFallbackTag = () => {
  const tags = multiTags.value
  const currentIndex = tags.findIndex((tag) => tag.path === route.path)
  return tags[currentIndex - 1] || tags[currentIndex + 1] || homeTag.value
}

const closeTag = (tag) => {
  if (!tag || tag.path === homeTag.value.path) {
    closeTagMenu()
    return
  }
  const shouldRedirect = tag.path === route.path
  const fallbackTag = getFallbackTag()
  multiTagsStore.removeTag(tag.path)
  closeTagMenu()
  if (shouldRedirect) router.push(fallbackTag?.fullPath || fallbackTag?.path || homeTag.value.path)
}

const refreshTag = (tag) => {
  closeTagMenu()
  if (!tag) return
  if (tag.path === route.path) {
    window.location.reload()
    return
  }
  router.push(tag.fullPath || tag.path)
}

const closeOtherTags = (tag) => {
  if (!tag) return
  multiTagsStore.removeOtherTags(tag.path)
  closeTagMenu()
  if (tag.path !== route.path) router.push(tag.fullPath || tag.path)
}

const closeLeftTags = (tag) => {
  if (!tag) return
  multiTagsStore.removeLeftTags(tag.path)
  closeTagMenu()
  if (!multiTags.value.some((item) => item.path === route.path)) router.push(tag.fullPath || tag.path)
}

const closeRightTags = (tag) => {
  if (!tag) return
  multiTagsStore.removeRightTags(tag.path)
  closeTagMenu()
  if (!multiTags.value.some((item) => item.path === route.path)) router.push(tag.fullPath || tag.path)
}

const closeAllTags = () => {
  multiTagsStore.removeAllTags()
  closeTagMenu()
  router.push(homeTag.value.fullPath || homeTag.value.path)
}

const openTagMenu = (event, tag, index) => {
  tagMenu.visible = true
  tagMenu.x = Math.min(event.clientX, window.innerWidth - 156)
  tagMenu.y = Math.min(event.clientY, window.innerHeight - 236)
  tagMenu.tag = tag
  tagMenu.index = index
}

const handleFullscreenChange = () => {
  appStore.setFullscreen(Boolean(document.fullscreenElement))
}

const syncHomeTag = () => {
  const homePath = isCityUser(currentUser.value) ? '/city/workbench' : '/dashboard'
  const matched = router.resolve(homePath)
  multiTagsStore.setHomeTag({
    path: homePath,
    fullPath: homePath,
    name: matched.name || homePath,
    meta: matched.meta || { title: homePath === '/dashboard' ? '工作台' : '城市工作台' }
  })
}

onErrorCaptured((error) => {
  routeError.value = error?.message || '当前页面出现异常，请刷新后重试'
  return false
})

const rememberNavScroll = () => {
  navScrollTop.value = navRef.value?.scrollTop || 0
  sessionStorage.setItem('app_nav_scroll_top', String(navScrollTop.value))
}

const restoreNavScroll = () => {
  nextTick(() => {
    if (navRef.value) navRef.value.scrollTop = navScrollTop.value
  })
}

const rememberViewScroll = () => {
  if (!viewRef.value) return
  viewScrollPositions.set(route.fullPath, viewRef.value.scrollTop || 0)
}

const restoreViewScroll = (path) => {
  nextTick(() => {
    if (!viewRef.value) return
    viewRef.value.scrollTop = viewScrollPositions.get(path) || 0
  })
}

onMounted(() => {
  window.addEventListener('system-settings-updated', refreshSystemSettings)
  window.addEventListener('task-progress-updated', loadTaskProgress)
  window.addEventListener('storage', refreshSystemSettings)
  document.addEventListener('click', closeTagMenu)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  syncHomeTag()
  multiTagsStore.addTag(route)
  syncSystemSettings()
  loadTaskProgress()
  loadNotifications()
  loadAllNotifications()
  restoreNavScroll()
  restoreViewScroll(route.fullPath)
})

onBeforeUnmount(() => {
  window.removeEventListener('system-settings-updated', refreshSystemSettings)
  window.removeEventListener('task-progress-updated', loadTaskProgress)
  window.removeEventListener('storage', refreshSystemSettings)
  document.removeEventListener('click', closeTagMenu)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

watch(() => route.fullPath, (path, oldPath) => {
  routeError.value = ''
  multiTagsStore.addTag(route)
  if (oldPath && viewRef.value) {
    viewScrollPositions.set(oldPath, viewRef.value.scrollTop || 0)
  }
  currentUser.value = readCurrentUser()
  syncSystemSettings()
  loadTaskProgress()
  loadNotifications()
  restoreNavScroll()
  restoreViewScroll(path)
})

watch(currentUser, syncHomeTag, { deep: true })
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC',
    'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  transition: background-color 0.24s ease, color 0.24s ease;
}
:root,
.theme-light {
  --bg-primary: #f5f6fa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f5f6fa;
  --bg-hover: #f5f3ff;
  --bg-active: #eef2ff;
  --bg-card: #ffffff;
  --border-primary: #ececf1;
  --border-secondary: #e5e7eb;
  --border-accent: #c7d2fe;
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted: #6b7280;
  --text-subtle: #9ca3af;
  --accent-primary: #4f46e5;
  --accent-secondary: #6366f1;
  --accent-gradient: linear-gradient(135deg, #6366f1, #8b5cf6);
  --accent-gradient-light: linear-gradient(135deg, #eef2ff, #f5f3ff);
  --shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 4px 16px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 18px 40px rgba(15, 23, 42, 0.1);
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;
  --ep-text-color: #111827;
  --ep-text-color-regular: #4b5563;
  --ep-text-color-secondary: #6b7280;
  --ep-text-color-placeholder: #9ca3af;
  --ep-border-color: #dcdfe6;
  --ep-border-color-light: #ebeef5;
  --ep-fill-color: #ffffff;
  --ep-fill-color-light: #f5f7fa;
  --ep-bg-color: #ffffff;
  --ep-bg-color-page: #f5f6fa;
  --ep-color-primary: #4f46e5;
}
.theme-dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #273449;
  --bg-hover: #334155;
  --bg-active: #1e293b;
  --bg-card: #1e293b;
  --border-primary: #334155;
  --border-secondary: #475569;
  --border-accent: #4f46e5;
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  --text-subtle: #64748b;
  --accent-primary: #6366f1;
  --accent-secondary: #8b5cf6;
  --accent-gradient: linear-gradient(135deg, #6366f1, #8b5cf6);
  --accent-gradient-light: linear-gradient(135deg, #1e293b, #334155);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 18px 40px rgba(0, 0, 0, 0.4);
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;
  --ep-text-color: #f1f5f9;
  --ep-text-color-regular: #cbd5e1;
  --ep-text-color-secondary: #94a3b8;
  --ep-text-color-placeholder: #64748b;
  --ep-border-color: #475569;
  --ep-border-color-light: #334155;
  --ep-fill-color: #1e293b;
  --ep-fill-color-light: #273449;
  --ep-bg-color: #1e293b;
  --ep-bg-color-page: #0f172a;
  --ep-color-primary: #6366f1;
}
body {
  background: var(--bg-primary);
  color: var(--text-primary);
}
button { font-family: inherit; }

@media (max-width: 900px) {
  html,
  body,
  #app {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
}
html, body, #app {
  height: 100%;
  overflow: hidden;
}

.theme-dark :deep(.el-card),
.theme-dark :deep(.el-dialog),
.theme-dark :deep(.el-drawer),
.theme-dark :deep(.el-message-box),
.theme-dark :deep(.el-popover),
.theme-dark :deep(.el-popper) {
  background-color: var(--ep-bg-color);
  border-color: var(--ep-border-color);
}
.theme-dark :deep(.el-card__body) {
  background-color: var(--ep-bg-color);
}
.theme-dark :deep(.el-table) {
  background-color: var(--ep-bg-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-table th.el-table__cell) {
  background-color: var(--ep-fill-color-light);
  color: var(--ep-text-color);
  border-bottom-color: var(--ep-border-color);
}
.theme-dark :deep(.el-table td.el-table__cell),
.theme-dark :deep(.el-table tr.el-table__row) {
  background-color: var(--ep-bg-color);
  border-bottom-color: var(--ep-border-color);
}
.theme-dark :deep(.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell) {
  background-color: var(--ep-fill-color-light);
}
.theme-dark :deep(.el-input__wrapper),
.theme-dark :deep(.el-textarea__inner) {
  background-color: var(--ep-fill-color-light);
  box-shadow: 0 0 0 1px var(--ep-border-color) inset;
}
.theme-dark :deep(.el-input__inner),
.theme-dark :deep(.el-textarea__inner) {
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-input__placeholder) {
  color: var(--ep-text-color-placeholder);
}
.theme-dark :deep(.el-button) {
  background-color: var(--ep-fill-color);
  border-color: var(--ep-border-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-button:hover) {
  background-color: var(--ep-fill-color-light);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
.theme-dark :deep(.el-button--primary) {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #ffffff;
}
.theme-dark :deep(.el-button--primary:hover) {
  background-color: var(--accent-secondary);
  border-color: var(--accent-secondary);
}
.theme-dark :deep(.el-picker-panel),
.theme-dark :deep(.el-date-picker),
.theme-dark :deep(.el-select-dropdown),
.theme-dark :deep(.el-dropdown-menu) {
  background-color: var(--ep-bg-color);
  border-color: var(--ep-border-color);
}
.theme-dark :deep(.el-select-dropdown__item),
.theme-dark :deep(.el-dropdown-menu__item),
.theme-dark :deep(.el-picker-panel__content),
.theme-dark :deep(.el-picker-panel__sidebar) {
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-select-dropdown__item:hover),
.theme-dark :deep(.el-select-dropdown__item.hover),
.theme-dark :deep(.el-select-dropdown__item.selected),
.theme-dark :deep(.el-dropdown-menu__item:hover),
.theme-dark :deep(.el-date-picker__header-label:hover),
.theme-dark :deep(.el-picker-panel__icon-btn:hover),
.theme-dark :deep(.el-picker-panel__content .is-selected),
.theme-dark :deep(.el-picker-panel__sidebar .is-selected) {
  background-color: var(--ep-fill-color-light);
  color: var(--accent-primary);
}
.theme-dark :deep(.el-menu),
.theme-dark :deep(.el-sub-menu),
.theme-dark :deep(.el-menu-item),
.theme-dark :deep(.el-sub-menu__title) {
  background-color: var(--ep-bg-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-menu-item:hover),
.theme-dark :deep(.el-sub-menu__title:hover),
.theme-dark :deep(.el-menu-item.is-active) {
  background-color: var(--ep-fill-color-light);
  color: var(--accent-primary);
}
.theme-dark :deep(.el-dialog__header),
.theme-dark :deep(.el-dialog__body),
.theme-dark :deep(.el-dialog__footer) {
  background-color: var(--ep-bg-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-dialog__title),
.theme-dark :deep(.el-dialog__headerbtn .el-dialog__close) {
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-badge__content) {
  background-color: var(--color-danger);
  border-color: var(--ep-bg-color);
}
.theme-dark :deep(.el-tag) {
  background-color: var(--ep-fill-color-light);
  border-color: var(--ep-border-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-tag--info) {
  background-color: var(--ep-fill-color-light);
  border-color: var(--ep-border-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-checkbox__inner),
.theme-dark :deep(.el-radio__inner) {
  background-color: var(--ep-fill-color-light);
  border-color: var(--ep-border-color);
}
.theme-dark :deep(.el-checkbox__label),
.theme-dark :deep(.el-radio__label) {
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-pagination button),
.theme-dark :deep(.el-pager li) {
  background-color: var(--ep-fill-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-pager li:not(.disabled):hover) {
  color: var(--accent-primary);
}
.theme-dark :deep(.el-pager li.is-active) {
  background-color: var(--accent-primary);
  color: #ffffff;
}
.theme-dark :deep(.el-loading-mask) {
  background-color: rgba(15, 23, 42, 0.8);
}
.theme-dark :deep(.el-drawer__header),
.theme-dark :deep(.el-drawer__body) {
  background-color: var(--ep-bg-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-message),
.theme-dark :deep(.el-notification) {
  background-color: var(--ep-bg-color);
  border-color: var(--ep-border-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-message__content),
.theme-dark :deep(.el-notification__content) {
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-divider),
.theme-dark :deep(.el-divider__text) {
  background-color: var(--ep-border-color);
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-divider__text) {
  background-color: var(--ep-bg-color);
}
.theme-dark :deep(.el-progress-bar__outer) {
  background-color: var(--ep-fill-color-light);
}
.theme-dark :deep(.el-switch__core) {
  background-color: var(--ep-border-color);
}
.theme-dark :deep(.el-switch.is-checked .el-switch__core) {
  background-color: var(--accent-primary);
}
.theme-dark :deep(.el-tooltip__popper.is-dark) {
  background-color: #334155;
}
.theme-dark :deep(.el-scrollbar) {
  background-color: transparent;
}
.theme-dark :deep(.el-scrollbar__thumb) {
  background-color: var(--ep-border-color);
}
.theme-dark :deep(.el-empty__description),
.theme-dark :deep(.el-empty-description) {
  color: var(--ep-text-color-secondary);
}
.theme-dark :deep(.el-form-item__label) {
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-table .el-table__cell .cell) {
  color: var(--ep-text-color);
}
.theme-dark :deep(.el-table::before) {
  background-color: var(--ep-border-color);
}
</style>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 232px 1fr;
  height: 100vh;
  background: var(--bg-primary);
  overflow: hidden;
  transition: grid-template-columns 0.24s ease;
}

.mobile-topbar,
.mobile-tabbar {
  display: none;
}

.sidebar {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  padding: 18px 14px 16px;
  height: 100%;
  border-radius: 0 16px 16px 0;
  overflow: visible;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 18px;
  border-bottom: 1px solid var(--border-primary);
  margin-bottom: 14px;
}
.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: contain;
  flex-shrink: 0;
}
.brand-logo-text {
  display: grid;
  place-items: center;
  background: var(--accent-gradient);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
}
.brand-text { display: flex; flex-direction: column; line-height: 1.25; }
.brand-text strong { font-size: 14px; color: var(--text-primary); letter-spacing: 0; }
.brand-text span { font-size: 11px; color: var(--text-subtle); }

.nav { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; flex: 1; }
.nav-item, .nav-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13.5px;
  text-decoration: none;
  font-weight: 500;
  transition: background 0.18s ease, color 0.18s ease;
}
.nav-icon { font-size: 16px; color: inherit; }
.nav-item:hover, .nav-group:hover { background: var(--bg-hover); color: var(--accent-secondary); }
.nav-item.active, .nav-group.active {
  background: var(--accent-gradient-light);
  color: var(--accent-secondary);
  font-weight: 600;
}
.nav-group { margin: 4px 0; font-weight: 600; }

.nav-group-with-children {
  margin: 4px 0;
}
.nav-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  color: var(--text-primary);
  transition: all 0.2s ease;
}
.nav-group-header:hover {
  background: var(--bg-hover);
}
.nav-group-header .nav-icon {
  font-size: 16px;
  opacity: 0.7;
}
.nav-group-header .expand-arrow {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-subtle);
  transition: transform 0.2s ease;
}
.nav-group-with-children.expanded .nav-group-header {
  background: var(--accent-gradient-light);
  color: var(--accent-secondary);
}
.nav-group-with-children.expanded .nav-group-header .expand-arrow {
  transform: rotate(180deg);
}
.nav-group-children {
  padding-left: 16px;
  margin-top: 4px;
}
.nav-child {
  padding-left: 24px;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateX(-8px);
}
.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 200px;
}

.sidebar-foot { padding-top: 10px; border-top: 1px solid var(--border-primary); margin-top: 10px; }
.foot-card {
  background: var(--accent-gradient-light);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 10px;
}
.foot-title { font-size: 12.5px; color: var(--accent-secondary); font-weight: 600; }
.foot-sub { font-size: 11.5px; color: var(--accent-primary); margin: 4px 0 10px; }
.foot-bar {
  height: 4px;
  border-radius: 4px;
  background: var(--bg-hover);
  overflow: hidden;
}
.foot-bar i {
  display: block;
  height: 100%;
  background: var(--accent-gradient);
}

.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
  gap: 18px;
}

.topbar-left { display: flex; align-items: center; gap: 18px; flex: 1; min-width: 0; }

.sidebar-toggle {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.sidebar-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.sidebar-toggle.collapsed {
  color: var(--accent-primary);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--text-subtle);
}
.breadcrumb-item {
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.breadcrumb-item:hover:not(:disabled) {
  color: var(--accent-primary);
}
.breadcrumb-item.current {
  color: var(--text-primary);
  cursor: default;
}
.breadcrumb-separator {
  color: var(--border-accent);
  font-size: 12px;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(340px, 44vw);
  height: 36px;
  padding: 0 12px;
  border-radius: 9px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-size: 13px;
  transition: background 0.18s ease, box-shadow 0.18s ease;
}
.search .app-icon { font-size: 15px; }
.search:focus-within {
  background: var(--bg-secondary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}
.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
  color: var(--text-primary);
}
.search kbd {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--bg-secondary);
  color: var(--text-muted);
  border: 1px solid var(--border-primary);
}

.topbar-right { display: flex; align-items: center; gap: 12px; }
.icon-btn {
  width: 36px; height: 36px;
  display: grid; place-items: center;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.18s ease;
}
.icon-btn:hover { background: var(--bg-tertiary); }
.tags-view {
  display: flex;
  align-items: center;
  min-height: 42px;
  padding: 6px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}
.tags-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.tags-scroll::-webkit-scrollbar {
  display: none;
}
.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  max-width: 160px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
.tag-item span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag-item:hover {
  background: var(--bg-active);
  color: var(--accent-primary);
}
.tag-item.active {
  background: var(--accent-gradient-light);
  border-color: var(--border-accent);
  color: var(--accent-primary);
}
.tag-close {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  color: var(--text-subtle);
  flex-shrink: 0;
}
.tag-close:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
}
.tag-context-menu {
  position: fixed;
  z-index: 3000;
  width: 148px;
  padding: 6px;
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-lg);
}
.tag-context-menu button {
  width: 100%;
  height: 32px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12.5px;
  text-align: left;
  padding: 0 10px;
}
.tag-context-menu button:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--accent-primary);
}
.tag-context-menu button:disabled {
  color: var(--text-subtle);
  cursor: not-allowed;
}
.notice-pop { display: flex; flex-direction: column; gap: 10px; }
.notice-pop-head { display: flex; align-items: center; justify-content: space-between; }
.notice-pop-head strong { color: var(--text-primary); font-size: 14px; }
.notice-pop-head a { color: var(--accent-primary); font-size: 12px; text-decoration: none; }
.notice-pop-list { display: flex; flex-direction: column; gap: 8px; }
.notice-pop-item { padding: 10px; border-radius: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-primary); }
.notice-pop-item strong { display: block; color: var(--text-primary); font-size: 13px; margin-bottom: 4px; }
.notice-pop-item span { display: block; color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.notice-pop-empty { padding: 18px; text-align: center; color: var(--text-muted); font-size: 13px; }

.route-error {
  min-height: calc(100vh - 120px);
  display: grid;
  place-items: center;
}
.route-error-card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-md);
}
.route-error-card strong { color: var(--text-primary); font-size: 18px; }
.route-error-card span { color: var(--text-secondary); line-height: 1.7; word-break: break-word; }
.route-error-actions { display: flex; gap: 10px; margin-top: 8px; }
.primary-mini,
.ghost-mini {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  font-weight: 700;
  cursor: pointer;
}
.primary-mini { border: 0; background: var(--accent-primary); color: #fff; }
.ghost-mini { border: 1px solid var(--border-primary); background: var(--bg-secondary); color: var(--text-secondary); }

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 4px 4px;
  border: 0;
  border-radius: 999px;
  background: var(--bg-tertiary);
  cursor: pointer;
  color: inherit;
}
.avatar {
  width: 30px; height: 30px;
  display: grid; place-items: center;
  border-radius: 999px;
  background: var(--accent-gradient);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.avatar-img {
  display: block;
  object-fit: cover;
  background: var(--bg-active);
}
.user-meta { display: flex; flex-direction: column; line-height: 1.2; text-align: left; }
.user-meta strong { font-size: 13px; color: var(--text-primary); }
.user-meta span { font-size: 11px; color: var(--text-muted); }

.view {
  padding: 24px 28px 32px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.is-compact .sidebar { padding: 12px 10px; }
.is-compact .brand { padding-bottom: 12px; margin-bottom: 10px; }
.is-compact .nav-item,
.is-compact .nav-group { padding: 7px 10px; }
.is-compact .topbar { padding: 10px 22px; }
.is-compact .view { padding: 18px 22px 26px; }

/* 侧边栏收缩态 */
.is-collapsed {
  grid-template-columns: 64px 1fr;
}
.is-collapsed .sidebar {
  padding: 14px 4px;
  width: 64px;
  flex-shrink: 0;
}
.is-collapsed .brand {
  padding: 4px 0 14px;
  justify-content: center;
}
.is-collapsed .brand-text {
  display: none;
}
.is-collapsed .nav {
  overflow-y: auto;
  flex: 1;
}
.is-collapsed .nav-item,
.is-collapsed .nav-group {
  justify-content: center;
  padding: 8px 4px;
  gap: 0;
  min-height: 36px;
  min-width: 48px;
  width: 100%;
}
.is-collapsed .nav-item span,
.is-collapsed .nav-group span {
  display: none;
}
.is-collapsed .nav-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.is-collapsed .nav-icon :deep(.app-icon) {
  width: 18px;
  height: 18px;
}
.is-collapsed .nav-icon :deep(.app-icon__font) {
  display: none;
}
.is-collapsed .nav-icon :deep(.app-icon__fallback) {
  font-size: 18px;
}
.is-collapsed .nav-icon :deep(.el-icon) {
  font-size: 18px;
}
.is-collapsed .nav-group-with-children {
  margin: 4px 0;
}
.is-collapsed .nav-group-header {
  justify-content: center;
  padding: 8px 4px;
  gap: 0;
  min-height: 36px;
  min-width: 48px;
  width: 100%;
}
.is-collapsed .nav-group-header span {
  display: none;
}
.is-collapsed .nav-group-header .expand-arrow {
  display: none;
}
.is-collapsed .nav-group-children {
  display: none;
}
.is-collapsed .sidebar-foot {
  display: none;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from { opacity: 0; transform: translateY(4px); }
.fade-leave-to { opacity: 0; transform: translateY(-4px); }

@media (max-width: 900px) {
  .app-shell {
    display: block;
    width: 100%;
    max-width: 100vw;
    height: auto;
    min-height: 100vh;
    padding-top: calc(58px + env(safe-area-inset-top));
    padding-bottom: calc(74px + env(safe-area-inset-bottom));
    overflow-x: hidden;
    overflow-y: auto;
  }
  .sidebar,
  .topbar,
  .tags-view {
    display: none;
  }
  .sidebar-toggle {
    display: none;
  }
  .mobile-topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: calc(58px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 14px 0;
    background: rgba(255,255,255,0.96);
    border-bottom: 1px solid #ececf1;
    backdrop-filter: blur(14px);
    overflow: hidden;
  }
  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    max-width: calc(100vw - 112px);
    overflow: hidden;
  }
  .mobile-logo {
    width: 34px;
    height: 34px;
    min-width: 34px;
    max-width: 34px;
    border-radius: 9px;
    padding: 2px;
    border: 1px solid #e0e7ff;
    background: #fff;
    object-fit: contain;
    object-position: center;
    display: block;
    flex-shrink: 0;
    overflow: hidden;
  }
  .mobile-logo-text {
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #6366f1, #14b8a6);
    color: #fff;
    font-weight: 800;
  }
  .mobile-title {
    display: flex;
    flex-direction: column;
    line-height: 1.18;
    min-width: 0;
  }
  .mobile-title strong {
    max-width: calc(100vw - 170px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    color: #0f172a;
  }
  .mobile-title span {
    margin-top: 3px;
    font-size: 11px;
    color: #64748b;
  }
  .mobile-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .mobile-avatar {
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 999px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    display: grid;
    place-items: center;
    overflow: hidden;
    font-weight: 800;
  }
  .mobile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .main {
    width: 100%;
    max-width: 100%;
    min-height: calc(100vh - 132px);
    overflow-x: hidden;
  }
  .view {
    width: 100%;
    max-width: 100vw;
    padding: 14px 12px 18px;
    overflow-x: hidden;
    overflow-y: visible;
  }
  .mobile-tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    height: calc(64px + env(safe-area-inset-bottom));
    padding: 7px 8px calc(7px + env(safe-area-inset-bottom));
    background: rgba(255,255,255,0.98);
    border-top: 1px solid #ececf1;
    box-shadow: 0 -10px 24px rgba(15,23,42,0.08);
    backdrop-filter: blur(14px);
  }
  .mobile-tab {
    min-width: 0;
    height: 50px;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #64748b;
    text-decoration: none;
    font-size: 11px;
    font-weight: 800;
  }
  .mobile-tab-icon {
    font-size: 18px;
    color: inherit;
  }
  .mobile-tab.active {
    color: #4f46e5;
    background: #eef2ff;
  }
  :deep(.page-head),
  :deep(.hero),
  :deep(.hero-bar),
  :deep(.panel-head),
  :deep(.head-actions),
  :deep(.toolbar) {
    max-width: 100%;
  }
  :deep(.dashboard),
  :deep(.data-overview),
  :deep(.plan-page),
  :deep(.ledger-page),
  :deep(.page-wrap) {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden;
  }
  :deep(.panel),
  :deep(.card),
  :deep(.hero),
  :deep(.hero-bar),
  :deep(.page-head),
  :deep(.summary-row),
  :deep(.kpi-grid),
  :deep(.table-panel) {
    max-width: 100%;
  }
  :deep(.table-scroll),
  :deep(.table-wrap),
  :deep(.ledger-table),
  :deep(.plan-panel),
  :deep(.table-panel) {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  :deep(.dialog-overlay) {
    align-items: flex-end;
    padding: 0;
  }
  :deep(.dialog-card) {
    width: 100vw;
    max-width: 100vw;
    max-height: calc(100vh - 58px);
    border-radius: 18px 18px 0 0;
  }
}

@media (max-width: 640px) {
  :deep(.page-head),
  :deep(.hero),
  :deep(.panel-head) {
    flex-direction: column;
    align-items: stretch;
  }
  :deep(.summary-row),
  :deep(.kpi-grid),
  :deep(.stat-row) {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
  :deep(.body-grid),
  :deep(.main-grid),
  :deep(.form-grid.two),
  :deep(.form-grid.three) {
    grid-template-columns: 1fr !important;
  }
}
</style>
