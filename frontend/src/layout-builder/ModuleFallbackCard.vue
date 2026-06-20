<template>
  <BuilderComponentPreview v-if="isBuilderComponent" :module="module" :page-key="pageKey" />
  <div v-else class="fallback-card" :class="cardClass">
    <header>
      <div>
        <h3>{{ module.title }}</h3>
        <p>{{ description }}</p>
      </div>
      <span v-if="badge">{{ badge }}</span>
    </header>

    <div v-if="loading" class="loading-state">
      <div class="skeleton" v-for="n in 3" :key="n"></div>
    </div>

    <div v-else-if="kind === 'metric'" class="metric-body">
      <strong>{{ metricValue }}</strong>
      <small>{{ metricText }}</small>
      <div v-if="metricPills.length" class="pills">
        <span v-for="pill in metricPills" :key="pill">{{ pill }}</span>
      </div>
    </div>

    <div v-else-if="kind === 'summary'" class="summary-grid">
      <div v-for="item in summaryItems" :key="item.label">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </div>

    <div v-else-if="kind === 'chart'" class="chart-body">
      <div v-for="(item, i) in chartBars" :key="i" :style="{ height: `${item.height}%` }">
        <em>{{ item.label }}</em>
      </div>
    </div>

    <div v-else-if="kind === 'list'" class="list-body">
      <div v-for="(row, i) in listRows" :key="i">
        <span class="row-icon" :style="{ background: row.iconBg, color: row.iconColor }">
          <span v-if="row.iconEmoji" class="icon-emoji">{{ row.iconEmoji }}</span>
          <span v-else-if="row.iconText" class="icon-text">{{ row.iconText }}</span>
          <span v-else class="icon-default">●</span>
        </span>
        <div class="row-text">
          <strong>{{ row.title }}</strong>
          <small v-if="row.subtitle">{{ row.subtitle }}</small>
        </div>
        <em :class="row.statusColor || ''">{{ row.meta }}</em>
      </div>
      <el-empty v-if="!listRows.length" description="暂无数据" />
    </div>

    <div v-else class="placeholder-body">
      <el-empty :description="`${module.title} 模块 · 自动配置中`" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElEmpty } from 'element-plus'
import BuilderComponentPreview from './BuilderComponentPreview.vue'
import {
  getDashboard,
  getTaskProgress,
  getCityDistributions,
  getAccounts,
  getCities,
  getDataStats,
  getSchedules,
  getMaterials,
  getAIReports,
  getSystemUsers,
  getCityBoard,
  getVideoTypes
} from '@/api'

const props = defineProps({
  module: { type: Object, required: true },
  pageKey: { type: String, default: '' }
})

const key = computed(() => props.module.componentKey || props.module.key || '')
const isBuilderComponent = computed(() => key.value.startsWith('control-') || key.value.startsWith('layout-'))

const loading = ref(false)
const rawData = ref({
  dashboard: null,
  progress: null,
  distributions: [],
  accounts: [],
  cities: [],
  schedules: [],
  materials: [],
  aiReports: [],
  systemUsers: [],
  cityBoard: null,
  videoTypes: []
})

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const loadAll = async () => {
  loading.value = true
  try {
    const tasks = [
      getDashboard().then(r => { rawData.value.dashboard = r || null }).catch(() => {}),
      getTaskProgress().then(r => { rawData.value.progress = r || null }).catch(() => {}),
      getCityDistributions({ pageSize: 100 }).then(r => {
        const items = r?.list || (Array.isArray(r) ? r : [])
        rawData.value.distributions = items
      }).catch(() => { rawData.value.distributions = [] }),
      getAccounts().then(r => {
        const items = r?.list || (Array.isArray(r) ? r : [])
        rawData.value.accounts = items
      }).catch(() => { rawData.value.accounts = [] }),
      getCities().then(r => {
        const items = Array.isArray(r) ? r : (r?.data || [])
        rawData.value.cities = items
      }).catch(() => { rawData.value.cities = [] }),
      getDataStats().then(r => { rawData.value.dataStats = r || null }).catch(() => {}),
      getSchedules({ date: today() }).then(r => {
        const items = r?.list || (Array.isArray(r) ? r : [])
        rawData.value.schedules = items
      }).catch(() => { rawData.value.schedules = [] }),
      getMaterials({ pageSize: 20 }).then(r => {
        const items = r?.list || (Array.isArray(r) ? r : [])
        rawData.value.materials = items
      }).catch(() => { rawData.value.materials = [] }),
      getAIReports({ pageSize: 5 }).then(r => {
        const items = r?.list || (Array.isArray(r) ? r : [])
        rawData.value.aiReports = items
      }).catch(() => { rawData.value.aiReports = [] }),
      getSystemUsers({ pageSize: 20 }).then(r => {
        const items = r?.list || (Array.isArray(r) ? r : [])
        rawData.value.systemUsers = items
      }).catch(() => { rawData.value.systemUsers = [] })
    ]
    tasks.push(
      getCityBoard().then(r => {
        rawData.value.cityBoard = r || null
      }).catch(() => { rawData.value.cityBoard = null }),
      getVideoTypes().then(r => {
        const items = Array.isArray(r) ? r : (r?.list || [])
        rawData.value.videoTypes = items.map(item => ({ ...item, count: item.count ?? 0 }))
      }).catch(() => { rawData.value.videoTypes = [] })
    )
    await Promise.all(tasks)
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
watch(() => props.pageKey, loadAll)

// ============ 类型判断 ============
const kind = computed(() => {
  const k = key.value
  if (['month-progress', 'today-published', 'today-pending', 'month-published', 'production-summary'].includes(k)) return 'metric'
  if (k.includes('summary') || k.includes('overview') || k.includes('city-summary')) return 'summary'
  if (k.includes('chart') || k.includes('rank') || k.includes('distribution') || k.includes('city-distribution')) return 'chart'
  return 'list'
})

const cardClass = computed(() => ({
  primary: key.value === 'month-progress',
  ai: key.value.includes('ai') || key.value === 'ai-overview'
}))

const badge = computed(() => {
  if (key.value.includes('ai') || key.value === 'ai-overview') return 'AI'
  if (key.value === 'month-published') return '本月'
  if (key.value === 'today-published') return '今日'
  if (key.value === 'today-pending') return '待处理'
  return ''
})

const description = computed(() => {
  const k = key.value
  if (k === 'city-summary') return '当前城市任务完成进度与发布统计'
  if (k === 'city-tasks') return '最近分配的任务列表与状态'
  if (k === 'city-notices') return '运营提醒与待办事项'
  if (k === 'city-list' || k === 'city-table') return '各城市/账号状态一览'
  if (k === 'publish-schedule' || k === 'legend-strip') return '今日发布排期与平台分布'
  if (k === 'city-distribution') return '各城市发布量对比'
  if (k === 'type-list' || k === 'type-form') return '视频类型与分类管理'
  if (kind.value === 'metric') return '实时统计 · 自动更新'
  if (kind.value === 'summary') return '关键指标速览'
  if (kind.value === 'chart') return '数据分布与趋势'
  return '列表展示'
})

// ============ 指标卡片 ============
const dashboardStats = computed(() => {
  const d = rawData.value.dashboard || rawData.value.progress || {}
  return {
    total: d.total_published || d.total || d.total_tasks || 0,
    pending: d.pending || 0,
    published: d.published || d.today_published || 0,
    completion: d.completion_rate !== undefined ? d.completion_rate : (d.total ? Math.round((d.published || 0) / d.total * 100) : 0)
  }
})

const metricValue = computed(() => {
  const k = key.value
  const s = dashboardStats.value
  if (k === 'month-progress') return `${s.completion}%`
  if (k === 'today-published') return `${s.published} 条`
  if (k === 'today-pending') return `${s.pending} 条`
  if (k === 'month-published') return `${s.total} 条`
  if (k === 'production-summary') return `${rawData.value.materials.length} 个`
  return '0 条'
})

const metricText = computed(() => {
  const k = key.value
  if (k === 'month-progress') return '本月任务完成进度'
  if (k === 'today-published') return '今日已发布内容'
  if (k === 'today-pending') return '待发布内容'
  if (k === 'month-published') return '本月累计发布'
  if (k === 'production-summary') return '素材库累计资源'
  return '实时统计'
})

const metricPills = computed(() => {
  const s = dashboardStats.value
  const k = key.value
  if (k === 'month-progress') {
    return [
      `已发布 ${s.published}`,
      `待发布 ${s.pending}`,
      `总任务 ${s.total}`
    ]
  }
  return []
})

// ============ 汇总网格 ============
const summaryItems = computed(() => {
  const k = key.value
  if (k === 'city-summary') {
    const s = dashboardStats.value
    return [
      { value: `${s.completion}%`, label: '完成度' },
      { value: s.pending, label: '待处理' },
      { value: s.total, label: '本月合计' }
    ]
  }
  if (k === 'data-summary') {
    return [
      { value: rawData.value.distributions.filter(d => d.status === 'published').length, label: '已记录' },
      { value: rawData.value.accounts.length, label: '账号数' },
      { value: rawData.value.materials.length, label: '素材数' }
    ]
  }
  // 默认通用 summary
  const s = dashboardStats.value
  return [
    { value: `${s.completion}%`, label: '完成度' },
    { value: s.pending, label: '待处理' },
    { value: s.total, label: '本月合计' }
  ]
})

// ============ 图表 ============
const chartBars = computed(() => {
  const k = key.value
  if (k === 'city-distribution') {
    // 按城市分组统计发布数
    const map = {}
    for (const d of rawData.value.distributions) {
      const cityName = d.city_name || d.city || '未知'
      map[cityName] = (map[cityName] || 0) + 1
    }
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
    if (!entries.length) return [{ height: 20, label: '暂无数据' }]
    const max = Math.max(...entries.map(e => e[1]), 1)
    return entries.map(([name, count]) => ({
      label: `${name}·${count}`,
      height: Math.max(20, Math.round((count / max) * 90))
    }))
  }
  // 默认：按平台分布
  const platMap = {}
  const platformMap = { douyin: '抖音', kuaishou: '快手', weixin: '视频号', xiaohongshu: '小红书' }
  for (const d of rawData.value.distributions) {
    const p = d.platform || d.publish_platform || 'other'
    platMap[p] = (platMap[p] || 0) + 1
  }
  const entries = Object.entries(platMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (!entries.length) return [{ height: 20, label: '暂无数据' }]
  const max = Math.max(...entries.map(e => e[1]), 1)
  return entries.map(([p, count]) => ({
    label: `${platformMap[p] || p}·${count}`,
    height: Math.max(20, Math.round((count / max) * 90))
  }))
})

// ============ 列表 ============
const listRows = computed(() => {
  const k = key.value
  if (k === 'city-tasks') {
    return rawData.value.distributions.slice(0, 5).map(d => ({
      iconEmoji: '📋',
      iconBg: d.status === 'published' ? '#e0f2fe' : '#fef3c7',
      iconColor: d.status === 'published' ? '#0284c7' : '#d97706',
      title: d.title || d.content_title || `${d.platform || '任务'} · ${d.account_name || ''}`,
      subtitle: `${d.date || ''} ${d.publish_time || ''}`,
      meta: d.status === 'published' ? '已发布' : (d.status === 'distributed' ? '待发布' : d.status || '待处理'),
      statusColor: d.status === 'published' ? 'ok' : ''
    }))
  }
  if (k === 'city-notices') {
    const notices = []
    if (dashboardStats.value.pending > 0) notices.push({
      iconEmoji: '🔔',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      title: '待发布任务',
      subtitle: `当前还有 ${dashboardStats.value.pending} 条任务未发布`,
      meta: '待处理',
      statusColor: ''
    })
    notices.push({ iconEmoji: '📊', iconBg: '#e0f2fe', iconColor: '#0284c7', title: '数据补充', subtitle: '已发布内容请补充播放、点赞等数据', meta: '持续中', statusColor: '' })
    const pendingData = rawData.value.distributions.filter(d => d.status === 'published' && !d.play_count)
    if (pendingData.length) notices.push({
      iconEmoji: '📝',
      iconBg: '#fef2f2',
      iconColor: '#dc2626',
      title: '待补数据记录',
      subtitle: `${pendingData.length} 条已发布但未填写数据`,
      meta: '待补充',
      statusColor: ''
    })
    return notices
  }
  if (k === 'city-list' || k === 'city-table') {
    // 从 distributions 按城市聚合真实统计
    const cityStats = {}
    for (const d of rawData.value.distributions) {
      const cityName = d.city_name || '未知城市'
      if (!cityStats[cityName]) {
        cityStats[cityName] = { name: cityName, published: 0, pending: 0, total: 0 }
      }
      if (d.status === 'published') cityStats[cityName].published++
      else cityStats[cityName].pending++
      cityStats[cityName].total++
    }
    const entries = Object.values(cityStats).sort((a, b) => b.total - a.total)
    if (entries.length) {
      return entries.slice(0, 5).map(c => ({
        iconEmoji: '🏙️',
        iconBg: '#dbeafe',
        iconColor: '#2563eb',
        title: `${c.name} · ${c.total} 条任务`,
        subtitle: `${c.published} 已发布 / ${c.pending} 待处理`,
        meta: c.pending > 0 ? `${c.pending} 待处理` : '全部完成',
        statusColor: c.pending > 0 ? '' : 'ok'
      }))
    }
    // 回退：从 cities 表展示（可能无统计字段）
    if (rawData.value.cities.length) {
      return rawData.value.cities.slice(0, 5).map(c => ({
        iconEmoji: '📍',
        iconBg: '#dbeafe',
        iconColor: '#2563eb',
        title: `${c.name || c.city_name || '城市'}`,
        subtitle: `账号: ${(c.accounts || []).length || 0} 个`,
        meta: c.status === 'active' ? '活跃' : (c.status || '正常'),
        statusColor: 'ok'
      }))
    }
    // 最终回退：按账号聚合
    return rawData.value.accounts.slice(0, 5).map(a => ({
      iconEmoji: '👤',
      iconBg: '#e0e7ff',
      iconColor: '#4f46e5',
      title: `${a.name || a.account_name || '账号'} · ${a.platform ? (a.platform === 'douyin' ? '抖音' : a.platform === 'kuaishou' ? '快手' : a.platform === 'weixin' ? '视频号' : '小红书') : '未绑定'}`,
      subtitle: `负责人 ${a.staff_name || '未分配'}`,
      meta: a.status === 'active' ? '正常' : (a.status || '已停用'),
      statusColor: a.status === 'inactive' ? '' : 'ok'
    }))
  }
  if (k === 'publish-schedule' || k === 'legend-strip') {
    const platformIcons = { douyin: '🎵', kuaishou: '⚡', weixin: '📺', xiaohongshu: '📕' }
    const platformColors = {
      douyin: { bg: '#fee2e2', color: '#dc2626' },
      kuaishou: { bg: '#fffbeb', color: '#d97706' },
      weixin: { bg: '#d1fae5', color: '#059669' },
      xiaohongshu: { bg: '#fce7f3', color: '#db2777' }
    }
    return rawData.value.schedules.slice(0, 5).map(s => {
      const p = s.platform || 'other'
      const colors = platformColors[p] || { bg: '#eef2ff', color: '#4f46e5' }
      return {
        iconEmoji: platformIcons[p] || '📅',
        iconBg: colors.bg,
        iconColor: colors.color,
        title: `${s.publish_time || ''} ${s.account_name || '账号'}`,
        subtitle: `${s.platform === 'douyin' ? '抖音' : s.platform === 'kuaishou' ? '快手' : s.platform === 'weixin' ? '视频号' : '小红书'} · ${s.title || '内容'}`,
        meta: s.status === 'published' ? '已发布' : (s.status || '待发布'),
        statusColor: s.status === 'published' ? 'ok' : ''
      }
    })
  }
  if (k === 'type-list' || k === 'type-form') {
    // 根据视频类型名称生成专属图标/颜色
    const typeIconMap = {
      '招商': { emoji: '🎯', bg: '#dbeafe', color: '#2563eb' },
      '加盟': { emoji: '🎯', bg: '#dbeafe', color: '#2563eb' },
      '技师': { emoji: '💃', bg: '#fce7f3', color: '#db2777' },
      '美女': { emoji: '👩', bg: '#fce7f3', color: '#db2777' },
      '跳舞': { emoji: '💃', bg: '#fecdd3', color: '#e11d48' },
      '剧情': { emoji: '🎬', bg: '#e0e7ff', color: '#4f46e5' },
      '服务': { emoji: '✨', bg: '#d1fae5', color: '#059669' },
      '养生': { emoji: '🌸', bg: '#dcfce7', color: '#16a34a' },
      '展示': { emoji: '📸', bg: '#e0f2fe', color: '#0284c7' },
      '剧情类': { emoji: '🎬', bg: '#e0e7ff', color: '#4f46e5' },
      '官方': { emoji: '🏢', bg: '#f1f5f9', color: '#475569' },
      '蓝V': { emoji: '✅', bg: '#e0f2fe', color: '#0369a1' }
    }
    return rawData.value.videoTypes.map(t => {
      let matched = null
      for (const key of Object.keys(typeIconMap)) {
        if (t.name && t.name.includes(key)) { matched = typeIconMap[key]; break }
      }
      const iconInfo = matched || { emoji: t.icon || '📁', bg: '#eef2ff', color: '#4f46e5' }
      return {
        iconEmoji: iconInfo.emoji,
        iconBg: iconInfo.bg,
        iconColor: iconInfo.color,
        title: t.name || '类型',
        subtitle: `${t.count || 0} 个素材${t.parent_name ? ' · 归属：' + t.parent_name : ''}`,
        meta: t.status === 'active' ? '启用' : '停用',
        statusColor: t.status === 'active' ? 'ok' : ''
      }
    })
  }
  if (k === 'account-table') {
    const platformColors = {
      douyin: { emoji: '🎵', bg: '#fee2e2', color: '#dc2626' },
      kuaishou: { emoji: '⚡', bg: '#fffbeb', color: '#d97706' },
      weixin: { emoji: '📺', bg: '#d1fae5', color: '#059669' },
      xiaohongshu: { emoji: '📕', bg: '#fce7f3', color: '#db2777' }
    }
    return rawData.value.accounts.slice(0, 5).map(a => {
      const colors = platformColors[a.platform] || { emoji: '👤', bg: '#e0e7ff', color: '#4f46e5' }
      return {
        iconEmoji: colors.emoji,
        iconBg: colors.bg,
        iconColor: colors.color,
        title: a.name || a.account_name || '账号',
        subtitle: `${a.platform === 'douyin' ? '抖音' : a.platform === 'kuaishou' ? '快手' : a.platform === 'weixin' ? '视频号' : '小红书'} · ${a.staff_name || '未分配'}`,
        meta: a.status === 'active' ? '活跃' : (a.status || '正常'),
        statusColor: a.status === 'inactive' ? '' : 'ok'
      }
    })
  }
  if (k === 'user-table') {
    return rawData.value.systemUsers.slice(0, 5).map(u => ({
      iconEmoji: u.role === 'admin' ? '🛡️' : (u.role === 'city' ? '🏢' : '👤'),
      iconBg: u.role === 'admin' ? '#fef3c7' : (u.role === 'city' ? '#dbeafe' : '#e0e7ff'),
      iconColor: u.role === 'admin' ? '#d97706' : (u.role === 'city' ? '#2563eb' : '#4f46e5'),
      title: u.username || u.name || u.email || '用户',
      subtitle: `${u.role || '未分配角色'} · ${u.city_name || '总部'}`,
      meta: u.status === 'active' ? '活跃' : (u.status || '正常'),
      statusColor: u.status === 'active' ? 'ok' : ''
    }))
  }
  if (k === 'overdue-tasks') {
    const now = today()
    return rawData.value.distributions
      .filter(d => d.status !== 'published' && d.date && d.date < now)
      .slice(0, 5)
      .map(d => ({
        iconEmoji: '⚠️',
        iconBg: '#fef2f2',
        iconColor: '#dc2626',
        title: d.title || `${d.platform || '任务'} · ${d.account_name || ''}`,
        subtitle: `原计划 ${d.date}`,
        meta: '已超期',
        statusColor: ''
      }))
  }
  if (k === 'ai-overview') {
    return rawData.value.aiReports.slice(0, 3).map(r => ({
      iconEmoji: '🤖',
      iconBg: '#faf5ff',
      iconColor: '#9333ea',
      title: r.title || `AI 报告 #${r.id}`,
      subtitle: `${r.date || ''} · ${r.content_type || ''}`,
      meta: r.generated_at ? '已生成' : '生成中',
      statusColor: r.generated_at ? 'ok' : ''
    }))
  }
  if (k === 'quick-links') {
    return [
      { iconEmoji: '🚀', iconBg: '#e0f2fe', iconColor: '#0284c7', title: '发布管理', subtitle: '发布排期与记录', meta: '进入', statusColor: 'ok' },
      { iconEmoji: '📁', iconBg: '#dcfce7', iconColor: '#16a34a', title: '素材库', subtitle: '上传与管理素材文件', meta: '进入', statusColor: 'ok' },
      { iconEmoji: '📊', iconBg: '#fef3c7', iconColor: '#d97706', title: '数据总览', subtitle: '查看平台与账号数据', meta: '进入', statusColor: 'ok' }
    ]
  }
  // 默认：显示城市分发的最新几条
  return rawData.value.distributions.slice(0, 5).map(d => {
    const p = d.platform || 'other'
    const pColors = {
      douyin: { emoji: '🎵', bg: '#fee2e2', color: '#dc2626' },
      kuaishou: { emoji: '⚡', bg: '#fffbeb', color: '#d97706' },
      weixin: { emoji: '📺', bg: '#d1fae5', color: '#059669' },
      xiaohongshu: { emoji: '📕', bg: '#fce7f3', color: '#db2777' }
    }
    const colors = pColors[p] || { emoji: '📄', bg: '#eef2ff', color: '#4f46e5' }
    return {
      iconEmoji: colors.emoji,
      iconBg: colors.bg,
      iconColor: colors.color,
      title: d.title || `${d.platform || ''} · ${d.account_name || ''}`,
      subtitle: d.date || '',
      meta: d.status === 'published' ? '已发布' : (d.status || '处理中'),
      statusColor: d.status === 'published' ? 'ok' : ''
    }
  })
})
</script>

<style scoped>
.fallback-card {
  min-height: 200px;
  height: 100%;
  width: 100%;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #ffffff;
  color: #0f172a;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.fallback-card.primary {
  border: 0;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
}
.fallback-card.ai {
  border-color: #e9d5ff;
  background: linear-gradient(135deg, #faf5ff, #eef2ff);
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}
h3, p { margin: 0; }
h3 { font-size: 16px; line-height: 1.4; font-weight: 700; }
p { margin-top: 4px; color: #6b7280; font-size: 13px; }
.primary p { color: rgba(255, 255, 255, 0.72); }
header > span {
  padding: 4px 10px;
  border-radius: 8px;
  background: #ecfdf5;
  color: #059669;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.primary header > span {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.loading-state { display: grid; gap: 10px; flex: 1; }
.skeleton {
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  animation: shimmer 1.5s infinite;
  background-size: 200% 100%;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.metric-body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.metric-body strong { display: block; margin-bottom: 8px; font-size: 42px; line-height: 1; font-weight: 800; }
.metric-body small { color: #6b7280; font-size: 13px; }
.primary .metric-body small { color: rgba(255, 255, 255, 0.76); }
.pills { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
.pills span { padding: 6px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.15); color: inherit; font-size: 12px; font-weight: 600; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; flex: 1; }
.summary-grid div { padding: 18px 14px; border-radius: 12px; background: #f9fafb; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.summary-grid strong, .summary-grid span { display: block; text-align: center; }
.summary-grid strong { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1; }
.summary-grid span { margin-top: 6px; color: #6b7280; font-size: 12px; }
.chart-body { height: 140px; display: flex; align-items: flex-end; gap: 10px; padding: 16px; border-radius: 12px; background: #f9fafb; flex-shrink: 0; }
.chart-body div {
  flex: 1;
  min-height: 24px;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(180deg, #6366f1, #8b5cf6);
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
}
.chart-body em { font-size: 10px; color: #fff; font-style: normal; font-weight: 700; text-align: center; line-height: 1.2; }
.placeholder-body { flex: 1; display: flex; align-items: center; justify-content: center; }
.list-body { display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; }
.list-body > div {
  min-height: 56px;
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.15s ease;
}
.list-body > div:hover {
  background: #fff;
  border-color: #d1d5db;
}
.row-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #eef2ff;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-emoji {
  font-size: 18px;
  line-height: 1;
}
.icon-text {
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.icon-default {
  font-size: 12px;
}
.row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.row-text strong { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-text small { color: #6b7280; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list-body em { color: #6b7280; font-size: 12px; font-style: normal; font-weight: 600; flex-shrink: 0; }
.list-body em.ok { color: #059669; background: #d1fae5; padding: 3px 10px; border-radius: 6px; }
</style>
