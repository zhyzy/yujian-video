<template>
  <div class="dashboard">
    <div class="page-head">
      <div class="head-left">
        <div class="eyebrow"><span class="dot"></span>实时数据 · {{ todayLabel }}</div>
        <h1 class="head-title">
          {{ greeting }}
          <span class="head-sub">以下是今天运营工作的进展快照。</span>
        </h1>
      </div>
      <div class="head-right">
        <button class="ghost-btn" @click="togglePeriod('today')" :class="{ active: period === 'today' }">今日</button>
        <button class="ghost-btn" @click="togglePeriod('week')" :class="{ active: period === 'week' }">本周</button>
        <button class="ghost-btn" @click="togglePeriod('month')" :class="{ active: period === 'month' }">本月</button>
        <button class="primary-btn" @click="goAIReport"><el-icon><MagicStick /></el-icon>生成 AI 日报</button>
      </div>
    </div>

    <ConfigurablePageRenderer page-key="dashboard" :modules="dashboardLayoutModules">
      <template #month-progress="{ module }">
        <div class="kpi-card primary" :class="{ 'light-bg': !isDarkBg }" :style="kpiPrimaryBgStyle" @click="goRoute('/data/overview')">
          <div class="kpi-head"><span class="kpi-label">{{ module.title }}</span><span class="kpi-chip good">+{{ shootIncrease }} 环比</span></div>
          <div class="kpi-value"><strong>{{ monthProgress }}<em>%</em></strong><span class="kpi-target">已完成 {{ monthCompleted }}/{{ monthTarget }} 条 · 剩余 {{ daysRemaining }} 天</span></div>
          <div class="kpi-bar"><i :style="{ width: monthProgress + '%' }"></i></div>
          <svg class="kpi-spark" viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M0,32 L15,28 L30,30 L45,22 L60,26 L75,18 L90,20 L105,12 L120,16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </div>
      </template>

      <template #today-published="{ module }">
        <div class="kpi-card" @click="goRoute({ path: '/publish/ledger' })">
          <div class="kpi-head"><span class="kpi-label">{{ module.title }}</span></div>
          <div class="kpi-value"><strong>{{ todayPublishedTotal }}<em>条</em></strong><span class="kpi-target">今日发布合计</span></div>
          <div class="kpi-meta kpi-breakdown"><span>总部 {{ todayPublishedHq }} 条</span><span>城市 {{ todayPublishedCity }} 条</span></div>
        </div>
      </template>

      <template #today-pending="{ module }">
        <div class="kpi-card" @click="goPublishList">
          <div class="kpi-head"><span class="kpi-label">{{ module.title }}</span></div>
          <div class="kpi-value"><strong>{{ todayPending }}<em>条</em></strong><span class="kpi-target">涉及 {{ pendingAccounts }} 个账号</span></div>
          <div class="kpi-meta kpi-breakdown"><span>总部 {{ pendingHq }} 条</span><span>城市 {{ pendingCity }} 条</span></div>
        </div>
      </template>

      <template #month-published="{ module }">
        <div class="kpi-card alert" @click="goRoute({ path: '/publish/ledger' })">
          <div class="kpi-head"><span class="kpi-label">{{ module.title }}</span><span class="kpi-chip good">本月</span></div>
          <div class="kpi-value"><strong>{{ monthPublishedTotal }}<em>条</em></strong><span class="kpi-target">发布计划 + 城市填报</span></div>
          <div class="kpi-meta kpi-breakdown"><span>总部 {{ monthPublishedHq }} 条</span><span>城市 {{ monthPublishedCity }} 条</span></div>
        </div>
      </template>

      <template #production-summary="{ module }">
        <section class="panel">
          <header class="panel-head">
            <div><h3>{{ module.title }}</h3><p>按类型管理同步统计拍摄 / 剪辑 / 上传 / 发布。</p></div>
            <router-link to="/material/list" class="link">查看详情→</router-link>
          </header>
          <table class="data-table">
            <thead><tr><th>类型</th><th class="num">拍摄</th><th class="num">剪辑</th><th class="num">上传</th><th class="num">发布</th><th class="num-right">完成度</th></tr></thead>
            <tbody>
              <tr v-for="item in production" :key="item.name">
                <td><span class="type-chip" :style="{ background: item.bg, color: item.color }"><IconFont :typeName="item.name" :color="item.color" /></span><span class="type-name">{{ item.name }}</span></td>
                <td class="num">{{ item.shoot }}</td><td class="num">{{ item.edit }}</td><td class="num">{{ item.upload }}</td><td class="num">{{ item.publish }}</td>
                <td class="num-right"><span class="mini-bar"><i :style="{ width: item.ratio + '%', background: item.color }"></i></span><span class="ratio">{{ item.ratio }}%</span></td>
              </tr>
              <tr class="total"><td>合计</td><td class="num">{{ sum('shoot') }}</td><td class="num">{{ sum('edit') }}</td><td class="num">{{ sum('upload') }}</td><td class="num">{{ sum('publish') }}</td><td class="num-right"><strong>{{ totalRatio }}%</strong></td></tr>
            </tbody>
          </table>
        </section>
      </template>

      <template #publish-schedule="{ module }">
        <section class="panel">
          <header class="panel-head">
            <div><h3>{{ module.title }} · {{ scheduleDateLabel }}</h3><p>按排期时间自动推送至各平台账号。</p></div>
            <div class="tabs">
              <button class="tab" :class="{ active: platformFilter === 'all' }" @click="platformFilter = 'all'">全部 {{ schedule.length }}</button>
              <button class="tab" :class="{ active: platformFilter === 'douyin' }" @click="platformFilter = 'douyin'"><IconFont platform="douyin" />抖音 {{ byPlatform('douyin') }}</button>
              <button class="tab" :class="{ active: platformFilter === 'kuaishou' }" @click="platformFilter = 'kuaishou'"><IconFont platform="kuaishou" />快手 {{ byPlatform('kuaishou') }}</button>
              <button class="tab" :class="{ active: platformFilter === 'weixin' }" @click="platformFilter = 'weixin'"><IconFont platform="weixin" />视频号 {{ byPlatform('weixin') }}</button>
            </div>
          </header>
          <div class="schedule-list">
            <div v-for="s in filteredSchedule" :key="s.id || s.time" class="sched-row" @click="openSchedule(s)">
              <div class="sched-time">{{ s.time || '--:--' }}</div><div class="sched-rail"><i></i></div>
              <div class="sched-card"><div class="sched-platform" :class="'p-' + s.platform"><IconFont :platform="s.platform" :color="platformPillColor(s.platform)" />{{ getPlatformName(s.platform) }}</div><div class="sched-body"><strong>{{ s.account_name }}</strong><span>{{ s.video_title }}</span></div><span class="sched-status pending">{{ statusText(s.status) }}</span></div>
            </div>
          </div>
        </section>
      </template>

      <template #ai-overview="{ module }">
        <section class="panel ai-panel">
          <header class="panel-head"><div><h3>{{ module.title }}</h3><p>自动洞察 · 刚刚更新</p></div><span class="badge-ai"><el-icon><MagicStick /></el-icon>AI</span></header>
          <div class="ai-content"><p>{{ aiText }}</p></div>
          <div class="ai-actions"><button class="primary-btn wide" @click="goAIReport">生成完整日报</button><button class="ghost-btn wide" @click="goRoute('/data/overview')">查看数据</button></div>
        </section>
      </template>

      <template #city-distribution="{ module }">
        <section class="panel">
          <header class="panel-head"><div><h3>{{ module.title }}</h3><p>{{ cityBoard.total }} 个城市 · 实时状态</p></div><router-link to="/city/board" class="link">城市看板 →</router-link></header>
          <div class="city-ring"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="48" class="ring-bg" /><circle v-if="cityBoard.published > 0" cx="60" cy="60" r="48" class="ring-green" :stroke-dasharray="(cityBoard.published / cityBoard.total * 302) + ' 302'" stroke-dashoffset="0" /><circle v-if="cityBoard.pending > 0" cx="60" cy="60" r="48" class="ring-orange" :stroke-dasharray="(cityBoard.pending / cityBoard.total * 302) + ' 302'" :stroke-dashoffset="-cityBoard.published / cityBoard.total * 302" /></svg><div class="ring-center"><strong>{{ cityBoard.published }}/{{ cityBoard.total }}</strong><span>已发布</span></div></div>
          <div class="city-legend"><div><span class="lg green"></span>已发布 <b>{{ cityBoard.published }}</b></div><div><span class="lg orange"></span>待发布 <b>{{ cityBoard.pending }}</b></div><div><span class="lg gray"></span>未开始 <b>{{ cityBoard.not_started }}</b></div></div>
        </section>
      </template>

      <template #overdue-tasks="{ module }">
        <section class="panel">
          <header class="panel-head"><div><h3>{{ module.title }}</h3><p>超过排期时间的待处理任务。</p></div><router-link to="/city/board" class="link danger-link">全部 {{ overdue.length }} 项 →</router-link></header>
          <div class="overdue-list"><div v-for="o in overdue" :key="o.id || o.video_title" class="overdue-row"><span class="overdue-tag" :class="o.days_overdue > 1 ? 'danger' : 'warn'">{{ o.days_overdue > 1 ? '紧急' : '提醒' }}</span><div class="overdue-meta"><strong>{{ o.city_name }} · {{ o.account_name }}</strong><span>{{ o.video_title }}</span></div><div class="overdue-right"><span class="overdue-days">已超期 {{ Math.round(o.days_overdue || 0) }} 天</span><button class="mini-btn" @click="goCityBoard">处理</button></div></div></div>
        </section>
      </template>

      <template #quick-links="{ module }">
        <section class="panel">
          <header class="panel-head"><div><h3>{{ module.title }}</h3><p>常用功能一键直达。</p></div></header>
          <div class="quick-grid"><router-link v-for="q in quickLinks" :key="q.text" :to="q.to" class="quick-item"><span class="quick-icon" :style="{ background: q.bg, color: q.color }"><IconFont v-if="q.isIconFont" :name="q.icon" /><el-icon v-else><component :is="q.icon" /></el-icon></span><span class="quick-text">{{ q.text }}</span></router-link></div>
        </section>
      </template>
    </ConfigurablePageRenderer>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { DataAnalysis, Download, MagicStick, Promotion, UserFilled } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getPlatformName, getVideoTypeIcon } from '@/utils/iconMapping'
import { getDashboard, getMaterialFiles, getSchedules, getVideoTypes } from '@/api'
import { applySystemSettings, loadSystemSettings } from '@/utils/systemSettings'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const router = useRouter()
const dashboardLayoutModules = layoutModuleCatalog.dashboard
const { bindings: layoutBindings } = useLayoutBindings('dashboard')
const currentUser = computed(() => {
  try { return JSON.parse(localStorage.getItem('auth_user') || '{}') } catch { return {} }
})

const settings = reactive(loadSystemSettings())
const refreshSystemSettings = (event) => {
  applySystemSettings(settings, event?.detail || loadSystemSettings())
}
const bgPresets = {
  gradient1: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  gradient2: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 30%, #ddd6fe 60%, #e0e7ff 100%)',
  gradient3: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
}
const kpiPrimaryBgStyle = computed(() => {
  const appearance = settings.appearance || {}
  const preset = appearance.dashboardBgPreset || 'gradient1'
  if (preset === 'custom' && appearance.dashboardBgUrl) {
    return {
      backgroundImage: `url(${appearance.dashboardBgUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  return {
    background: bgPresets[preset] || bgPresets.gradient1
  }
})
const isDarkBg = computed(() => {
  const preset = (settings.appearance || {}).dashboardBgPreset || 'gradient1'
  return preset === 'gradient1'
})
const greeting = computed(() => {
  const hour = new Date().getHours()
  const name = currentUser.value.name || currentUser.value.username || '张林'
  if (hour < 12) return `上午好，${name}`
  if (hour < 18) return `下午好，${name}`
  return `晚上好，${name}`
})

const dashboardDate = ref(dayjs().format('YYYY-MM-DD'))
const period = ref('today')
const platformFilter = ref('all')
const uploadCounts = ref({})
const publishCounts = ref({})
const typeRows = ref([])
const data = ref({ monthProgress: 0, daysRemaining: 0, todayShoot: 0, yesterdayShoot: 0, shootIncrease: 0, todayPending: 0, pendingAccounts: 0, overdueCount: 0, urgentCount: 0, production: [], pendingQueue: [], overdue: [], cityBoard: { total: 0, published: 0, pending: 0, not_started: 0 }, week: { shoot: 0, edit: 0, publish: 0, target: 0 }, aiText: '暂无足够数据生成速览。', schedule: [] })

const todayLabel = computed(() => dayjs(dashboardDate.value).format('YYYY年M月D日'))
const scheduleDateLabel = computed(() => dayjs(dashboardDate.value).format('M月D日'))
const monthProgress = computed(() => typeof data.value.monthProgress === 'object' ? data.value.monthProgress.percentage || 0 : data.value.monthProgress || 0)
const daysRemaining = computed(() => typeof data.value.monthProgress === 'object' ? data.value.monthProgress.daysLeft || 0 : data.value.daysRemaining || 0)
const monthCompleted = computed(() => data.value.taskProgress?.progress?.completed ?? data.value.monthProgress?.completed ?? 0)
const monthTarget = computed(() => data.value.taskProgress?.progress?.target ?? data.value.monthProgress?.target ?? 0)
const publishOverview = computed(() => data.value.publishOverview || {})
const todayPublished = computed(() => publishOverview.value.todayPublished || {})
const todayPublishedTotal = computed(() => todayPublished.value.total || 0)
const todayPublishedHq = computed(() => todayPublished.value.hq || 0)
const todayPublishedCity = computed(() => todayPublished.value.city || 0)
const todayShoot = computed(() => data.value.todayStats?.shoot ?? data.value.todayShoot ?? 0)
const yesterdayShoot = computed(() => data.value.yesterdayShoot ?? 0)
const shootIncrease = computed(() => data.value.todayStats?.shootGrowth ?? data.value.shootIncrease ?? 0)
const pendingInfo = computed(() => publishOverview.value.todayPending || data.value.todayPending || {})
const todayPending = computed(() => typeof pendingInfo.value === 'object' ? pendingInfo.value.total ?? pendingInfo.value.count ?? 0 : pendingInfo.value || 0)
const pendingHq = computed(() => pendingInfo.value.hq || 0)
const pendingCity = computed(() => pendingInfo.value.city || 0)
const pendingAccounts = computed(() => typeof pendingInfo.value === 'object'
  ? (pendingInfo.value.hqAccounts || 0) + (pendingInfo.value.cityAccounts || 0) || pendingInfo.value.accounts || 0
  : data.value.pendingAccounts || 0)
const monthPublished = computed(() => publishOverview.value.monthPublished || {})
const monthPublishedTotal = computed(() => monthPublished.value.total || 0)
const monthPublishedHq = computed(() => monthPublished.value.hq || 0)
const monthPublishedCity = computed(() => monthPublished.value.city || 0)
const overdueInfo = computed(() => data.value.overdue || {})
const overdueCount = computed(() => typeof overdueInfo.value === 'object' ? overdueInfo.value.count || 0 : data.value.overdueCount || 0)
const urgentCount = computed(() => typeof overdueInfo.value === 'object' ? overdueInfo.value.urgent || 0 : data.value.urgentCount || 0)
const productionSource = computed(() => {
  const remote = data.value.todayProduction || data.value.production || []
  const base = remote.length ? remote : typeRows.value.map(type => ({ id: type.id, name: type.name, icon: type.icon, color: type.color, shoot: 0, edit: 0, upload: uploadCounts.value[type.id] ?? uploadCounts.value[type.name] ?? 0, publish: 0 }))
  return base.map(item => ({ ...item, publish: publishCounts.value[item.id] ?? publishCounts.value[item.name] ?? item.publish ?? 0 }))
})
const production = computed(() => productionSource.value.map(p => ({ ...p, bg: p.bg || `${p.color || '#6366f1'}18`, color: p.color || '#6366f1', upload: uploadCounts.value[p.id] ?? uploadCounts.value[p.name] ?? p.upload ?? 0, ratio: p.shoot ? Math.round((p.publish / p.shoot) * 100) : 0 })))
const cityBoard = computed(() => ({ total: data.value.cityBoard?.total || 0, published: data.value.cityBoard?.published || 0, pending: data.value.cityBoard?.pending || 0, not_started: data.value.cityBoard?.not_started ?? data.value.cityBoard?.notStarted ?? 0 }))
const aiText = computed(() => data.value.aiSummary?.text || data.value.aiText || '暂无足够数据生成速览。')
const schedule = computed(() => data.value.todaySchedule || data.value.schedule || [])
const overdue = computed(() => Array.isArray(data.value.overdue) ? data.value.overdue : (data.value.overdue?.list || []))
const overdueCities = computed(() => {
  const cities = [...new Set(overdue.value.map(item => item.city_name).filter(Boolean))].slice(0, 3)
  return cities.length ? cities : ['暂无']
})
const sum = (key) => production.value.reduce((n, p) => n + (p[key] || 0), 0)
const totalRatio = computed(() => {
  const totalShoots = sum('shoot')
  return totalShoots ? Math.round((sum('publish') / totalShoots) * 100) : 0
})
const byPlatform = (p) => schedule.value.filter(s => s.platform === p).length
const filteredSchedule = computed(() => platformFilter.value === 'all' ? schedule.value : schedule.value.filter(s => s.platform === platformFilter.value))
const platformName = (p) => ({ douyin: '抖音', kuaishou: '快手', weixin: '视频号', xiaohongshu: '小红书' }[p] || p)
const platformPillColor = (p) => ({ douyin: '#dc2626', kuaishou: '#ea580c', weixin: '#059669', xiaohongshu: '#b45309' }[p] || '#6b7280')
const statusText = (s) => ({ pending: '待发布', publishing: '发布中', published: '已发布', failed: '失败' }[s] || '待发布')
const quickLinks = [
  { text: '素材录入', to: '/material/entry', icon: 'upload', isIconFont: true, color: '#7c3aed', bg: '#f5f3ff' },
  { text: '发布排期', to: '/publish/calendar', icon: Promotion, color: '#f97316', bg: '#fff7ed' },
  { text: '下发视频', to: '/city/board', icon: Download, color: '#10b981', bg: '#ecfdf5' },
  { text: '数据看板', to: '/data/overview', icon: DataAnalysis, color: '#2563eb', bg: '#eff6ff' },
  { text: 'AI 日报', to: '/ai/reports', icon: MagicStick, color: '#9333ea', bg: '#faf5ff' },
  { text: '账号管理', to: '/system/accounts', icon: UserFilled, color: '#0891b2', bg: '#ecfeff' }
]
const goRoute = (to) => router.push(typeof to === 'string' ? { path: to } : to)
const goPublishList = () => router.push({ path: '/publish/list', query: { status: 'pending' } })
const goCityBoard = () => router.push('/city/board')
const goAIReport = () => router.push({ path: '/ai/reports', query: { type: 'daily' } })
const openSchedule = (s) => router.push({ path: '/publish/list', query: { focus: s.id } })
const togglePeriod = (p) => { period.value = p }
const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}
const applyLayoutBindings = (bindings = {}) => {
  const nextDate = normalizeBoundDate(bindings.date)
  if (nextDate && nextDate !== dashboardDate.value) dashboardDate.value = nextDate
  if (['today', 'week', 'month'].includes(bindings.range)) period.value = bindings.range
  if ('platform' in bindings) platformFilter.value = bindings.platform === '全部' ? 'all' : (bindings.platform || 'all')
}
const loadDashboard = async () => {
  try {
    const date = dashboardDate.value || dayjs().format('YYYY-MM-DD')
    const [dashboardResult, filesResult, typesResult, schedulesResult] = await Promise.allSettled([getDashboard({ date }), getMaterialFiles({ date, pageSize: 1000 }), getVideoTypes(), getSchedules({ dateFrom: date, dateTo: date, status: 'published', pageSize: 1000 })])
    if (dashboardResult.status === 'fulfilled' && dashboardResult.value) {
      data.value = { ...data.value, ...dashboardResult.value }
    }
    if (filesResult.status === 'fulfilled') {
      const counts = {}
      ;(filesResult.value?.list || []).forEach(file => {
        if (file.video_type_id) counts[file.video_type_id] = (counts[file.video_type_id] || 0) + 1
        if (file.type_name) counts[file.type_name] = (counts[file.type_name] || 0) + 1
      })
      uploadCounts.value = counts
    }
    if (typesResult.status === 'fulfilled') typeRows.value = typesResult.value || []
    if (schedulesResult.status === 'fulfilled') {
      publishCounts.value = (schedulesResult.value?.list || []).reduce((acc, row) => {
        if (row.video_type_id) acc[row.video_type_id] = (acc[row.video_type_id] || 0) + 1
        if (row.type_name) acc[row.type_name] = (acc[row.type_name] || 0) + 1
        return acc
      }, {})
    }
  } catch (_) {}
}
onMounted(() => {
  window.addEventListener('system-settings-updated', refreshSystemSettings)
  loadDashboard()
})
onBeforeUnmount(() => {
  window.removeEventListener('system-settings-updated', refreshSystemSettings)
})
watch(dashboardDate, loadDashboard)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>
<style scoped>
/* ================== Base ================== */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: fadeInUp 0.4s ease;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ================== Page Head ================== */
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.head-left { display: flex; flex-direction: column; gap: 8px; }

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.eyebrow .dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.head-title {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.015em;
  line-height: 1.2;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.head-sub {
  font-size: 13.5px;
  color: #6b7280;
  font-weight: 400;
  letter-spacing: 0;
}

.head-right { display: flex; gap: 8px; align-items: center; }

/* ================== Buttons ================== */
.ghost-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.ghost-btn:hover { background: #f9fafb; border-color: #d1d5db; color: #111827; }
.ghost-btn.active {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #4338ca;
}
.ghost-btn.wide { flex: 1; }

.primary-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.28);
  transition: all 0.18s ease;
}
.primary-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35); }
.primary-btn .el-icon { font-size: 14px; }
.primary-btn.wide { width: 100%; justify-content: center; }

.mini-btn {
  height: 26px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.mini-btn:hover { background: #f9fafb; color: #111827; }

/* ================== KPI Grid ================== */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}

.kpi-card {
  position: relative;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 22px;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
  border-color: #e0e7ff;
}

.kpi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.kpi-label {
  font-size: 12.5px;
  color: #6b7280;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.kpi-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.kpi-chip.good { background: #ecfdf5; color: #059669; }
.kpi-chip.danger { background: #fef2f2; color: #dc2626; }

.kpi-value {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.kpi-value strong {
  font-size: 34px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1;
}
.kpi-value em {
  font-style: normal;
  font-size: 14px;
  color: #9ca3af;
  font-weight: 500;
  margin-left: 2px;
}
.kpi-target {
  font-size: 12.5px;
  color: #9ca3af;
}

/* primary 鍗＄墖 */
.kpi-card.primary {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: #ffffff;
  border: 0;
}
.kpi-card.primary .kpi-label { color: rgba(255,255,255,0.75); }
.kpi-card.primary .kpi-chip.good { background: rgba(255,255,255,0.18); color: #ffffff; }
.kpi-card.primary .kpi-value strong { color: #ffffff; }
.kpi-card.primary .kpi-value em { color: rgba(255,255,255,0.7); }
.kpi-card.primary .kpi-target { color: rgba(255,255,255,0.75); }
.kpi-card.primary .kpi-spark { color: rgba(255,255,255,0.55); }
.kpi-card.primary.light-bg {
  color: #0f172a;
  border: 1px solid #e2e8f0;
}
.kpi-card.primary.light-bg .kpi-label { color: #6b7280; }
.kpi-card.primary.light-bg .kpi-chip.good { background: #ecfdf5; color: #059669; }
.kpi-card.primary.light-bg .kpi-value strong { color: #0f172a; }
.kpi-card.primary.light-bg .kpi-value em { color: #9ca3af; }
.kpi-card.primary.light-bg .kpi-target { color: #6b7280; }
.kpi-card.primary.light-bg .kpi-spark { color: #9ca3af; }
.kpi-card.primary.light-bg .kpi-bar { background: #e5e7eb; }
.kpi-card.primary.light-bg .kpi-bar i { background: linear-gradient(90deg, #6366f1, #8b5cf6); }

.kpi-bar {
  height: 6px;
  border-radius: 6px;
  background: rgba(255,255,255,0.15);
  overflow: hidden;
  margin-top: 14px;
}
.kpi-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffffff, #c7d2fe);
}

.kpi-spark {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 150px;
  height: 50px;
  opacity: 0.9;
}

.kpi-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.kpi-breakdown {
  flex-wrap: wrap;
  gap: 6px;
}
.kpi-breakdown span {
  padding: 4px 9px;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
}
.delta { font-weight: 600; }
.delta.up { color: #059669; }
.delta.down { color: #dc2626; }
.muted { color: #9ca3af; }

.kpi-avatars {
  display: flex;
  align-items: center;
  gap: -8px;
}
.ava {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 600;
  border: 2px solid #ffffff;
  margin-left: -8px;
}
.ava-douyin { background: #111; }
.ava-kuaishou { background: #f97316; }
.ava-weixin { background: #10b981; }
.ava:first-child { margin-left: 0; }
.ava-more {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  border: 2px solid #ffffff;
  margin-left: -8px;
}

.kpi-card.alert .kpi-alert-bar {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.kpi-card.alert .kpi-alert-bar span {
  font-size: 11.5px;
  color: #dc2626;
  background: #fef2f2;
  padding: 3px 9px;
  border-radius: 6px;
  font-weight: 600;
}

/* ================== Body Grid ================== */
.body-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 16px;
}
.col-main { display: flex; flex-direction: column; gap: 16px; }
.col-side { display: flex; flex-direction: column; gap: 16px; }

/* ================== Panel ================== */
.panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
}
.panel-head h3 {
  font-size: 15.5px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}
.panel-head p {
  font-size: 12.5px;
  color: #6b7280;
}

.link {
  font-size: 12.5px;
  color: #6366f1;
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.15s ease;
}
.link:hover { color: #4338ca; }
.danger-link { color: #dc2626; }

.badge-ai {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #7c3aed;
  background: #faf5ff;
  padding: 4px 9px;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

/* ================== Data Table ================== */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.data-table thead th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  color: #9ca3af;
  font-weight: 600;
  border-bottom: 1px solid #f3f4f6;
  letter-spacing: 0.02em;
}
.data-table th.num, .data-table td.num { text-align: center; }
.data-table td.num-right { text-align: right; }
.data-table tbody td {
  padding: 14px 12px;
  border-bottom: 1px solid #f8fafc;
  color: #0f172a;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.data-table tbody tr { transition: background 0.12s ease; }
.data-table tbody tr:hover { background: #fafbff; }
.data-table tbody tr:last-child td { border-bottom: 0; }

.data-table tbody td:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
}
.type-chip {
  width: auto;
  height: auto;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  font-size: 18px;
  background: transparent !important;
}
.type-name { color: #111827; font-weight: 600; }

.num-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.mini-bar {
  display: inline-block;
  width: 80px;
  height: 6px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
}
.mini-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
}
.ratio {
  font-size: 12.5px;
  color: #6b7280;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: right;
}

.data-table tr.total td {
  padding-top: 16px;
  padding-bottom: 4px;
  font-weight: 700;
  color: #0f172a;
  background: transparent;
  border-bottom: 0;
}
.data-table tr.total td.num-right strong { color: #4338ca; }

/* ================== Tabs ================== */
.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tab {
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  font-size: 12.5px;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tab:hover { background: #f3f4f6; color: #111827; }
.tab.active { background: #eef2ff; color: #4338ca; font-weight: 600; }

/* ================== Schedule ================== */
.schedule-list {
  display: flex;
  flex-direction: column;
  position: relative;
  padding-left: 68px;
}

.sched-row {
  position: relative;
  margin-bottom: 14px;
  cursor: pointer;
}
.sched-row:last-child { margin-bottom: 0; }
.sched-row:hover .sched-card { border-color: #c7d2fe; background: #fafaff; }

.sched-time {
  position: absolute;
  left: -68px;
  top: 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.sched-rail {
  position: absolute;
  left: -16px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #f1f5f9;
}
.sched-rail i {
  position: absolute;
  left: 50%;
  top: 18px;
  transform: translateX(-50%);
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #6366f1;
  box-shadow: 0 0 0 3px #e0e7ff;
}

.sched-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid #ececf1;
  border-radius: 10px;
  background: #ffffff;
  transition: all 0.15s ease;
  margin-left: 14px;
}
.sched-platform {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.p-douyin { background: transparent; color: #dc2626; }
.p-kuaishou { background: transparent; color: #ea580c; }
.p-weixin { background: transparent; color: #059669; }
.p-xiaohongshu { background: transparent; color: #b45309; }

.sched-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sched-body strong { font-size: 13.5px; font-weight: 600; color: #0f172a; }
.sched-body span { font-size: 12.5px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sched-status {
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 600;
}
.sched-status.pending { background: #fef3c7; color: #b45309; }

/* ================== AI panel ================== */
.ai-panel {
  background: linear-gradient(135deg, #faf5ff 0%, #eef2ff 100%);
  border: 1px solid #e9d5ff;
}
.ai-content {
  background: #ffffff;
  border: 1px solid #ede9fe;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.ai-content p {
  font-size: 13.5px;
  line-height: 1.7;
  color: #1f2937;
}
.ai-actions { 
  display: flex; 
  gap: 8px; 
}
.ai-actions .primary-btn.wide { 
  flex: 1.3; 
  min-width: 0;
}
.ai-actions .ghost-btn.wide { 
  flex: 1; 
  min-width: 0;
}

/* ================== City Ring ================== */
.city-ring {
  position: relative;
  width: 150px;
  height: 150px;
  margin: 8px auto 18px;
}
.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-bg { fill: none; stroke: #f3f4f6; stroke-width: 10; }
.ring-green { fill: none; stroke: #10b981; stroke-width: 10; stroke-linecap: round; }
.ring-orange { fill: none; stroke: #f97316; stroke-width: 10; stroke-linecap: round; }
.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.ring-center strong {
  font-size: 26px;
  color: #0f172a;
  font-weight: 800;
  line-height: 1.2;
}
.ring-center span { font-size: 13px; color: #6b7280; margin-top: 4px; }

.city-legend {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed #e5e7eb;
  padding-top: 12px;
}
.city-legend > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}
.city-legend b {
  font-size: 15px;
  color: #0f172a;
  font-weight: 700;
}
.lg {
  width: 8px; height: 8px; border-radius: 999px; display: inline-block;
}
.lg.green { background: #10b981; }
.lg.orange { background: #f97316; }
.lg.gray { background: #d1d5db; }

/* ================== Overdue ================== */
.overdue-list { display: flex; flex-direction: column; gap: 10px; }
.overdue-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  background: #ffffff;
  transition: all 0.15s ease;
}
.overdue-row:hover { border-color: #fecaca; background: #fff7f7; }

.overdue-tag {
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 6px;
  font-weight: 700;
  white-space: nowrap;
}
.overdue-tag.danger { background: #fef2f2; color: #dc2626; }
.overdue-tag.warn { background: #fff7ed; color: #ea580c; }

.overdue-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.overdue-meta strong { font-size: 13px; font-weight: 600; color: #0f172a; }
.overdue-meta span { font-size: 12px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.overdue-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.overdue-days { font-size: 11.5px; color: #dc2626; font-weight: 600; }

/* ================== Quick Grid ================== */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border-radius: 10px;
  text-decoration: none;
  color: #111827;
  transition: all 0.15s ease;
}
.quick-item:hover { background: #f8fafc; transform: translateY(-1px); }

.quick-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 18px;
}
.quick-text {
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
  color: #374151;
}

/* ================== Responsive ================== */
@media (max-width: 1280px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1024px) {
  .body-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .dashboard {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  .page-head { flex-direction: column; align-items: flex-start; }
  .kpi-grid { grid-template-columns: 1fr; }
  .quick-grid { grid-template-columns: repeat(2, 1fr); }
  .schedule-list { padding-left: 60px; }
  .sched-time { left: -60px; }
  .panel {
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .data-table {
    min-width: 680px;
  }
  .data-table tbody td:first-child {
    min-width: 150px;
  }
  .type-name {
    white-space: nowrap;
  }
  .mini-bar {
    width: 96px;
  }
}
</style>
