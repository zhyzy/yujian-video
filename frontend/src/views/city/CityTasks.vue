<template>
  <div class="task-page">
    <ConfigurablePageRenderer page-key="cityTasks" :modules="cityTasksLayoutModules">
    <template #page-head>
    <header class="hero">
      <div>
        <div class="eyebrow"><IconFont name="cityBoard" :fallback="Monitor" /> 城市端 · 总部下发</div>
        <h1>任务列表</h1>
        <p>管理总部下发的发布任务，查看任务状态和进度</p>
      </div>
      <el-button @click="loadData"><IconFont name="reset" :fallback="Refresh" />刷新</el-button>
    </header>
    </template>

    <template #toolbar>
    <section class="panel">
      <div class="toolbar">
        <div class="filter-left">
          <div class="platform-shortcuts">
            <button v-for="item in platformShortcuts" :key="item.name" @click="openPlatform(item.url)">
              <IconFont :platform="item.platform" />
              <span>{{ item.name }}</span>
            </button>
          </div>
        </div>
        <div class="filter-right">
          <div class="date-filter">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始"
              end-placeholder="结束"
              value-format="YYYY-MM-DD"
              style="width: 220px"
              @change="applyFilter"
            />
          </div>
        </div>
      </div>

      <div class="filter-tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeFilter === tab.value }"
          @click="setFilter(tab.value)"
        >
          <span class="tab-label">{{ tab.label }}</span>
          <span class="tab-count">{{ tabCount(tab.value) }}</span>
        </button>
      </div>
    </section>
    </template>

    <template #task-list>
    <section class="panel">
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-num">{{ stats.pending }}</span>
          <span class="stat-label">待发布</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num success">{{ stats.published }}</span>
          <span class="stat-label">已填报</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num warning">{{ stats.today }}</span>
          <span class="stat-label">今日任务</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num">{{ stats.total }}</span>
          <span class="stat-label">总任务</span>
        </div>
      </div>

      <div v-loading="loading" class="task-list">
        <article v-for="task in filteredTasks" :key="task.id" class="task-card" :class="{ done: task.status === 'published' }">
          <div class="task-header">
            <div class="task-time">
              <span class="task-date">{{ task.date }}</span>
              <span class="task-sep">·</span>
              <span class="task-hour">{{ timeText(task) }}</span>
            </div>
            <el-tag :type="task.status === 'published' ? 'success' : 'warning'" size="small">
              {{ task.status === 'published' ? '已填报' : '待发布' }}
            </el-tag>
          </div>

          <div class="task-account">
            <div class="platform-badge" :style="{ background: platformBg(task.publish_platform || task.platform) }">
              <IconFont :platform="task.publish_platform || task.platform" />
              <span>{{ platformLabel(task.publish_platform || task.platform) }}</span>
            </div>
            <span class="account-text">{{ task.city_name || '本城市' }} · {{ task.account_name || '城市账号' }}</span>
          </div>


          <div class="task-requirement">
            <div class="req-icon">
              <el-icon><Promotion /></el-icon>
            </div>
            <div class="req-content">
              <span class="req-label">发布要求</span>
              <span class="req-text">{{ task.publish_requirement || '暂无发布要求' }}</span>
            </div>
          </div>

          <div class="task-actions-row">
            <el-button v-if="task.video_url || task.material_url" class="btn-download" size="small" @click="openMaterial(task)">
              <el-icon><Download /></el-icon>
              <span>下载素材</span>
            </el-button>
            <el-button v-if="task.video_url || task.material_url" class="btn-copy" size="small" @click="copyText(task.video_url || task.material_url)">
              <el-icon><Link /></el-icon>
              <span>复制链接</span>
            </el-button>
            <el-button v-if="currentCityNetdisk" class="btn-video" size="small" @click="openNetdisk">
              <el-icon><VideoPlay /></el-icon>
              <span>全部视频</span>
            </el-button>
            <span v-if="!task.video_url && !task.material_url && !currentCityNetdisk" class="no-material">暂无素材地址</span>
            <span class="action-spacer"></span>
            <el-button class="btn-publish" size="small" type="primary" @click="goPublish(task)">
              <el-icon><Promotion /></el-icon>
              <span>{{ task.status === 'published' ? '查看填报' : '去发布' }}</span>
            </el-button>
          </div>
        </article>
        <el-empty v-if="!loading && !filteredTasks.length" :description="activeFilter === 'today' ? '今日没有任务' : '暂无任务'" />
      </div>
    </section>
    </template>
    </ConfigurablePageRenderer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { Download, Link, Monitor, Promotion, Refresh, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import IconFont from '@/components/IconFont.vue'
import { getCityDistributions, getCityById } from '@/api'
import { getPlatformName, platformBgColors } from '@/utils/iconMapping'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'

const router = useRouter()
const cityTasksLayoutModules = layoutModuleCatalog.cityTasks
const { bindings: layoutBindings } = useLayoutBindings('cityTasks')
const loading = ref(false)
const dateRange = ref(null)
const tasks = ref([])
const activeFilter = ref('distributed')
const currentCityNetdisk = ref('')

const platformLabel = (p) => getPlatformName(p)
const platformBg = (p) => ({
  douyin: 'linear-gradient(135deg, #0f172a, #334155)',
  kuaishou: 'linear-gradient(135deg, #ff6633, #ff9500)',
  weixin: 'linear-gradient(135deg, #07c160, #10b981)',
  xiaohongshu: 'linear-gradient(135deg, #ff2442, #ef4444)'
}[p] || 'linear-gradient(135deg, #6366f1, #8b5cf6)')

const filterTabs = [
  { label: '全部', value: 'all' },
  { label: '待发布', value: 'distributed' },
  { label: '已填报', value: 'published' },
  { label: '今日任务', value: 'today' }
]

const platformShortcuts = [
  { name: '视频号助手', platform: 'weixin', url: 'https://channels.weixin.qq.com/login.html' },
  { name: '快手创作者中心', platform: 'kuaishou', url: 'https://cp.kuaishou.com/' },
  { name: '小红书创作者中心', platform: 'xiaohongshu', url: 'https://creator.xiaohongshu.com/' },
  { name: '抖音创作者中心', platform: 'douyin', url: 'https://creator.douyin.com/' }
]

const normalizeDate = (value) => {
  if (!value) return ''
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const applyLayoutBindings = (bindings = {}) => {
  if ('status' in bindings) activeFilter.value = bindings.status || 'all'
  const from = normalizeDate(bindings.dateFrom)
  const to = normalizeDate(bindings.dateTo)
  if (from || to) dateRange.value = [from || to, to || from]
}

const stats = computed(() => ({
  pending: tasks.value.filter(item => item.status !== 'published').length,
  published: tasks.value.filter(item => item.status === 'published').length,
  today: tasks.value.filter(item => item.date === dayjs().format('YYYY-MM-DD')).length,
  total: tasks.value.length
}))

const filteredTasks = computed(() => {
  let list = tasks.value
  if (activeFilter.value === 'distributed') {
    list = list.filter(item => item.status !== 'published')
  } else if (activeFilter.value === 'published') {
    list = list.filter(item => item.status === 'published')
  } else if (activeFilter.value === 'today') {
    list = list.filter(item => item.date === dayjs().format('YYYY-MM-DD'))
  }
  if (dateRange.value && dateRange.value.length === 2) {
    list = list.filter(item => item.date >= dateRange.value[0] && item.date <= dateRange.value[1])
  }
  return list
})

const tabCount = (value) => {
  if (value === 'all') return tasks.value.length
  if (value === 'distributed') return stats.value.pending
  if (value === 'published') return stats.value.published
  if (value === 'today') return stats.value.today
  return 0
}

const setFilter = (value) => {
  activeFilter.value = value
}

const applyFilter = () => {
  // dateRange change
}

const loadData = async () => {
  loading.value = true
  try {
    const data = await getCityDistributions({ pageSize: 100 })
    tasks.value = data.list || []
    if (tasks.value.length > 0) {
      const firstTask = tasks.value[0]
      if (firstTask.city_id) {
        try {
          const cityData = await getCityById(firstTask.city_id)
          currentCityNetdisk.value = cityData?.netdisk_folder || ''
        } catch {}
      }
    }
  } finally {
    loading.value = false
  }
}

const goPublish = (task) => {
  router.push({ path: '/city/publish-submit', query: { taskId: task.id } })
}

const openMaterial = (task) => {
  const url = task.video_url || task.material_url
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
const openNetdisk = () => {
  if (currentCityNetdisk.value) {
    const url = currentCityNetdisk.value.startsWith('http') 
      ? currentCityNetdisk.value 
      : `https://pan.baidu.com${currentCityNetdisk.value}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
const openPlatform = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer')
}
const copyText = async (text) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制链接')
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

const timeText = (task) => task.publish_time || task.time || '09:00'
const dayText = (date) => {
  const day = dayjs(date)
  return day.isValid() ? day.format('MM/DD') : '--/--'
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(loadData)
</script>

<style scoped>
.task-page { display: flex; flex-direction: column; gap: 16px; color: #0f172a; }
.hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 22px 24px; background: #fff; border: 1px solid #eceff5; border-radius: 16px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #0f766e; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.hero h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
.hero p { margin: 0; color: #7b8497; font-size: 13px; }

.panel { background: #fff; border: 1px solid #eceff5; border-radius: 16px; padding: 20px; }

/* 工具栏 */
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-left { flex: 1; }
.filter-right { display: flex; align-items: center; gap: 12px; }

.platform-shortcuts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.platform-shortcuts button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .16s;
}
.platform-shortcuts button:hover { border-color: #c7d2fe; color: #4f46e5; background: #f8fafc; transform: translateY(-1px); }

.date-filter { display: flex; align-items: center; gap: 8px; }

/* 筛选Tab按钮 */
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-tab:hover {
  background: #fff;
  border-color: #c7d2fe;
  color: #4f46e5;
}
.filter-tab.active {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}
.filter-tab .tab-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  min-width: 26px;
  text-align: center;
}
.filter-tab:not(.active) .tab-count {
  background: #e2e8f0;
  color: #475569;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 12px;
  margin-bottom: 20px;
}

.stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-num { font-size: 22px; font-weight: 700; color: #4f46e5; }
.stat-num.success { color: #059669; }
.stat-num.warning { color: #d97706; }
.stat-label { font-size: 12px; color: #64748b; }
.stat-divider { width: 1px; height: 32px; background: #e5e7eb; }

/* 任务列表 */
.task-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; min-height: 180px; }

.task-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid #eceff5;
  border-radius: 16px;
  background: #fff;
  transition: all .2s ease;
}

.task-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
  transform: translateY(-2px);
}

.task-card.done {
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  border-color: #bbf7d0;
}

/* 任务头部 */
.task-header { display: flex; justify-content: space-between; align-items: center; }

.task-time {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background: linear-gradient(135deg, #eef2ff, #f0fdf4);
}

.task-date { font-size: 16px; font-weight: 700; color: #4f46e5; }
.task-sep { color: #a5b4fc; font-weight: 700; }
.task-hour { font-size: 18px; font-weight: 700; color: #0f172a; }

/* 账号信息 */
.task-account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #e5e7eb;
}
.platform-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  width: fit-content;
  flex-shrink: 0;
}
.platform-badge .iconfont,
.platform-badge .app-icon .iconfont,
.platform-badge .app-icon {
  font-size: 13px !important;
  color: #ffffff !important;
}
.platform-badge span {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
}
.account-text {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

/* 发布要求 */
.task-requirement {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
  border-radius: 12px;
  border: 1px solid #a7f3d0;
}
.req-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #fff;
  color: #059669;
  flex-shrink: 0;
  font-size: 16px;
}
.req-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.req-label {
  font-size: 12px;
  color: #059669;
  font-weight: 600;
}
.req-text {
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
  line-height: 1.5;
}

/* 按钮行 */
.task-actions-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 4px;
  white-space: nowrap;
  overflow: hidden;
}
.action-spacer {
  flex: 1;
  min-width: 4px;
}

/* 按钮美化 */
.btn-download,
.btn-copy,
.btn-video,
.btn-publish {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  height: 28px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-download {
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1d4ed8;
}
.btn-download:hover {
  background: linear-gradient(135deg, #bfdbfe, #93c5fd);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
}

.btn-copy {
  background: linear-gradient(135deg, #ede9fe, #ddd6fe);
  color: #6d28d9;
}
.btn-copy:hover {
  background: linear-gradient(135deg, #ddd6fe, #c4b5fd);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(139, 92, 246, 0.25);
}

.btn-video {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  color: #15803d;
}
.btn-video:hover {
  background: linear-gradient(135deg, #bbf7d0, #86efac);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(34, 197, 94, 0.25);
}

.btn-publish {
  background: linear-gradient(135deg, #4f46e5, #6366f1) !important;
  color: #ffffff !important;
  padding: 5px 12px;
}
.btn-publish:hover {
  background: linear-gradient(135deg, #4338ca, #4f46e5) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35) !important;
}

.no-material {
  font-size: 11px;
  color: #94a3b8;
  padding: 6px 10px;
  background: #f8fafc;
  border-radius: 6px;
}

@media (max-width: 1024px) {
  .task-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 800px) {
  .hero { flex-direction: column; align-items: stretch; }
  .toolbar { flex-direction: column; align-items: stretch; }
  .filter-right { justify-content: space-between; }
  .stats-bar { flex-wrap: wrap; gap: 16px; }
  .stat-divider { display: none; }
  .task-list { grid-template-columns: 1fr; }
  .task-footer { flex-direction: column; align-items: stretch; gap: 10px; }
}
</style>
