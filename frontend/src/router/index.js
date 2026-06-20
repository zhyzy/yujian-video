import { createRouter, createWebHistory } from 'vue-router'
import { isCityUser } from '@/utils/authRole'

const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '工作台' }
  },
  {
    path: '/material/entry',
    name: 'MaterialEntry',
    component: () => import('@/views/material/MaterialEntry.vue'),
    meta: { title: '素材录入' }
  },
  {
    path: '/material/list',
    name: 'MaterialList',
    component: () => import('@/views/material/MaterialList.vue'),
    meta: { title: '素材列表' }
  },
  {
    path: '/material/types',
    name: 'VideoTypes',
    component: () => import('@/views/material/VideoTypes.vue'),
    meta: { title: '类型管理' }
  },
  {
    path: '/publish/calendar',
    name: 'PublishCalendar',
    component: () => import('@/views/publish/PublishCalendar.vue'),
    meta: { title: '发布日历', cityPortal: true }
  },
  {
    path: '/publish/list',
    name: 'PublishList',
    component: () => import('@/views/publish/PublishList.vue'),
    meta: { title: '发布计划' }
  },
  {
    path: '/publish/ledger',
    name: 'PublishLedger',
    component: () => import('@/views/publish/PublishLedger.vue'),
    meta: { title: '发布台账', cityPortal: true }
  },
  {
    path: '/city/board',
    name: 'CityBoard',
    component: () => import('@/views/city/CityBoard.vue'),
    meta: { title: '城市发布看板', cityPortal: true }
  },
  {
    path: '/city/list',
    name: 'CityList',
    component: () => import('@/views/city/CityList.vue'),
    meta: { title: '城市管理' }
  },
  {
    path: '/city/workbench',
    name: 'CityWorkbench',
    component: () => import('@/views/city/CityWorkbench.vue'),
    meta: { title: '城市工作台', cityPortal: true }
  },
  {
    path: '/city/tasks',
    name: 'CityTasks',
    component: () => import('@/views/city/CityTasks.vue'),
    meta: { title: '我的任务', cityPortal: true }
  },
  {
    path: '/city/publish-submit',
    name: 'CityPublishSubmit',
    component: () => import('@/views/city/CityPublishSubmit.vue'),
    meta: { title: '发布填报', cityPortal: true }
  },
  {
    path: '/city/data-entry',
    name: 'CityDataEntry',
    component: () => import('@/views/city/CityDataEntry.vue'),
    meta: { title: '数据录入', cityPortal: true }
  },
  {
    path: '/city/notifications',
    name: 'CityNotifications',
    component: () => import('@/views/city/CityNotifications.vue'),
    meta: { title: '通知中心', cityPortal: true }
  },
  {
    path: '/city/accounts',
    name: 'CityAccountManagement',
    component: () => import('@/views/city/CityAccountManagement.vue'),
    meta: { title: '我的账号', cityPortal: true }
  },
  {
    path: '/data/overview',
    name: 'DataOverview',
    component: () => import('@/views/data/DataOverview.vue'),
    meta: { title: '数据总览', cityPortal: true }
  },
  {
    path: '/ai/reports',
    name: 'AIReports',
    component: () => import('@/views/ai/AIReports.vue'),
    meta: { title: 'AI 日报' }
  },
  {
    path: '/system/component-library',
    name: 'ComponentLibrary',
    component: () => import('@/views/system/ComponentLibrary.vue'),
    meta: { title: '组件库' }
  },
  {
    path: '/system/accounts',
    name: 'AccountManagement',
    component: () => import('@/views/system/AccountManagement.vue'),
    meta: { title: '账号管理' }
  },
  {
    path: '/system/settings',
    name: 'SystemSettings',
    component: () => import('@/views/system/SystemSettings.vue'),
    meta: { title: '系统设置' }
  },
  {
    path: '/system/page-layout',
    name: 'PageLayout',
    component: () => import('@/views/system/PageLayout.vue'),
    meta: { title: '页面布局' }
  },
  {
    path: '/accounts/hq',
    name: 'HqAccounts',
    component: () => import('@/views/accounts/HqAccounts.vue'),
    meta: { title: '总部账号' }
  },
  {
    path: '/accounts/city',
    name: 'CityAccounts',
    component: () => import('@/views/accounts/CityAccounts.vue'),
    meta: { title: '城市账号' }
  },
  {
    path: '/accounts/other',
    name: 'OtherAccounts',
    component: () => import('@/views/accounts/OtherAccounts.vue'),
    meta: { title: '其他账号' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const token = localStorage.getItem('auth_token')
  if (!to.meta.public && !token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && token) {
    return { path: '/dashboard' }
  }
  try {
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
    if (isCityUser(user) && !to.meta.cityPortal) {
      return { path: '/city/workbench' }
    }
  } catch {}
  let systemName = '遇见运营中台'
  try {
    systemName = JSON.parse(localStorage.getItem('system_settings_v1') || '{}')?.brand?.name || systemName
  } catch {
    systemName = '遇见运营中台'
  }
  document.title = `${to.meta.title || '工作台'} - ${systemName}`
  return true
})

router.onError((error) => {
  const message = String(error?.message || error || '')
  const shouldReload = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported module/i.test(message)
  if (!shouldReload) return
  const reloadKey = 'router_chunk_reload_once'
  if (sessionStorage.getItem(reloadKey) === '1') return
  sessionStorage.setItem(reloadKey, '1')
  window.location.reload()
})

router.afterEach(() => {
  sessionStorage.removeItem('router_chunk_reload_once')
})

export default router
