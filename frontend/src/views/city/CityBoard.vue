<template>
  <div class="page-wrap">
    <ConfigurablePageRenderer page-key="cityBoard" :modules="cityBoardLayoutModules">

    <template #page-head>
    <!-- ================ HERO ================ -->
    <div class="hero">
      <div class="hero-left">
        <div class="eyebrow"><span class="dot"></span>城市分发 · 每日看板</div>
        <h1 class="title">城市发布看板</h1>
        <p class="subtitle">追踪每个城市账号的视频下发任务与执行状态</p>
      </div>
      <div class="hero-right">
        <div class="field-inline">
          <IconFont name="calendar" :fallback="Calendar" />
          <el-date-picker
            v-model="currentDate" type="date" value-format="YYYY-MM-DD"
            class="inline-picker" placeholder="选择日期"
          />
        </div>
        <button class="btn-primary" @click="openDistribute">
          <IconFont name="publishPlan" :fallback="Promotion" />下发视频
        </button>
      </div>
    </div>
    </template>

    <template #summary-row>
    <!-- ================ KPI ================ -->
    <div class="kpi-row">
      <div class="kpi-card primary" :class="{ 'light-bg': !isCityBoardDarkBg }" :style="cityBoardBgStyle">
        <div class="kpi-head"><span class="kpi-label">接入城市</span><span class="kpi-chip">运营中</span></div>
        <div class="kpi-value"><strong>{{ summary.total }}</strong><em>个</em></div>
        <div class="kpi-bar"><i :style="{ width: Math.min(100, summary.total * 3) + '%' }"></i></div>
        <div class="kpi-meta"><span class="muted">覆盖 {{ summary.totalAccounts }} 个城市账号</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-head"><span class="kpi-label">今日已发布</span><span class="kpi-icon ic-green"><el-icon><CircleCheckFilled /></el-icon></span></div>
        <div class="kpi-value"><strong>{{ summary.published }}</strong><em>条</em></div>
        <div class="kpi-meta"><span class="delta up">{{ pctPublished }}% 完成率</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-head"><span class="kpi-label">待确认发布</span><span class="kpi-icon ic-amber"><el-icon><Clock /></el-icon></span></div>
        <div class="kpi-value"><strong>{{ summary.pending }}</strong><em>条</em></div>
        <div class="kpi-meta"><span class="muted">{{ summary.pendingCities }} 个城市等待</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-head"><span class="kpi-label">超期未处理</span><span class="kpi-icon ic-pink"><el-icon><WarningFilled /></el-icon></span></div>
        <div class="kpi-value"><strong>{{ summary.overdue }}</strong><em>条</em></div>
        <div class="kpi-meta"><span class="delta danger">需优先催办</span></div>
      </div>
    </div>
    </template>

    <template #board-table>
      <!-- LEFT: CITIES -->
      <section class="panel city-panel">
        <header class="panel-head">
          <div>
            <h3>城市账号分发状态</h3>
            <p>按城市分组 · 点击卡片查看详情</p>
          </div>
          <div class="tab-row">
            <button class="tab" :class="{ active: cityFilter === 'all' }" @click="cityFilter = 'all'">全部 <span>{{ summary.total }}</span></button>
            <button class="tab" :class="{ active: cityFilter === 'ok' }" @click="cityFilter = 'ok'">已发 <span>{{ summary.publishedCities }}</span></button>
            <button class="tab" :class="{ active: cityFilter === 'pending' }" @click="cityFilter = 'pending'">待确认 <span>{{ summary.pendingCities }}</span></button>
            <button class="tab" :class="{ active: cityFilter === 'overdue' }" @click="cityFilter = 'overdue'">超期 <span>{{ summary.overdueCities }}</span></button>
          </div>
        </header>

        <div v-if="filteredCities.length" class="city-grid">
          <div v-for="(c, idx) in filteredCities" :key="c.id || c.name" class="city-card" :class="cityStatusClass(c)" @click="openCityDetail(c)">
            <div class="card-hero">
              <div class="city-avatar" :style="{ background: colorSet[idx % colorSet.length] + '1A', color: colorSet[idx % colorSet.length] }">{{ c.name.slice(0, 2) }}</div>
              <div class="city-main">
                <h4 class="city-name">{{ c.name }}</h4>
                <p class="city-account">{{ c.account_name || c.kuaishou_name || '官方账号' }}</p>
              </div>
              <span class="status-badge" :class="cityStatusClass(c)">{{ cityStatusLabel(c) }}</span>
            </div>

            <div class="card-stats">
              <div class="stat-item">
                <span class="stat-num success">{{ c.published_count || 0 }}</span>
                <span class="stat-label">已发布</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-num amber">{{ c.pending_count || 0 }}</span>
                <span class="stat-label">待确认</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-num pink">{{ c.overdue_count || 0 }}</span>
                <span class="stat-label">超期</span>
              </div>
            </div>

            <div class="card-progress">
              <div class="progress-track">
                <span class="progress-bar green" :style="{ width: progressOf(c, 'published') + '%' }"></span>
                <span class="progress-bar amber" :style="{ width: progressOf(c, 'pending') + '%', left: progressOf(c, 'published') + '%' }"></span>
                <span class="progress-bar pink" :style="{ width: progressOf(c, 'overdue') + '%', left: (progressOf(c, 'published') + progressOf(c, 'pending')) + '%' }"></span>
              </div>
              <span class="progress-text">{{ totalCount(c) }} 条任务</span>
            </div>

            <div class="card-actions" @click.stop>
              <button class="mini-btn" @click="openDistribute(c)"><IconFont name="publishPlan" :fallback="Promotion" />下发</button>
              <button v-if="cityStatusClass(c) !== 'st-ok'" class="mini-btn warn" @click="nudge(c)"><IconFont name="notice" :fallback="Bell" />催办</button>
              <button class="mini-btn" @click="openTaskDetail(c)"><IconFont name="data" :fallback="Document" />任务明细</button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state small">
          <div class="empty-ic"><el-icon><Location /></el-icon></div>
          <div class="empty-txt"><strong>暂无城市数据</strong><span>当前筛选条件下没有城市任务</span></div>
        </div>
      </section>
    </template>

    <template #side-panel>
      <!-- RIGHT: DISTRIBUTION TIMELINE -->
      <section class="panel dist-panel">
        <header class="panel-head">
          <div>
            <h3>最近下发记录</h3>
            <p>视频下发任务时间线 · 共 {{ distributions.length }} 条</p>
          </div>
          <div class="summary-pills">
            <span class="pill green">已确认 {{ summary.distConfirmed }}</span>
            <span class="pill amber">待处理 {{ summary.distPending }}</span>
            <span class="pill pink">超期 {{ summary.distOverdue }}</span>
          </div>
        </header>

        <div v-if="distributions.length" class="timeline-list">
          <div v-for="(d, idx) in distributions" :key="d.id || idx" class="timeline-item">
            <div class="timeline-meta">
              <strong>{{ formatDay(d.date) }}</strong>
              <span>{{ d.time || '09:00' }}</span>
            </div>
            <div class="timeline-rail">
              <i :style="{ background: distColor(d.status) }"></i>
            </div>
            <div class="timeline-card" :class="'st-' + d.status">
              <div class="timeline-head">
                <span class="pill city">{{ d.city_name }}</span>
                <span class="pill account">{{ d.account_name }}</span>
                <span class="status-pill" :class="distPillClass(d.status)">{{ distStatusLabel(d.status) }}</span>
              </div>
              <p class="timeline-title">{{ d.video_title }}</p>
              <div class="timeline-foot" v-if="d.video_url">
                <button class="link-btn" @click.stop="openLink(d.video_url)">
                  <IconFont name="download" :fallback="Link" />下载
                </button>
                <button class="link-btn ghost" @click.stop="copyText(d.video_url)">
                  <IconFont name="copy" :fallback="Document" />复制
                </button>
              </div>
              <div class="timeline-actions" @click.stop>
                <button v-if="d.status !== 'published'" class="mini-btn success" @click="confirmPublished(d)">
                  <el-icon><CircleCheckFilled /></el-icon>确认发布
                </button>
                <button v-else class="mini-btn" disabled style="opacity:.6">已发布 ✓</button>
                <button class="mini-btn" @click="editDistribution(d)">
                  <IconFont name="edit" :fallback="EditPen" />编辑
                </button>
                <button class="mini-btn danger" @click="removeDistribution(d)">
                  <IconFont name="delete" :fallback="Delete" />删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state small">
          <div class="empty-ic"><el-icon><Document /></el-icon></div>
          <div class="empty-txt"><strong>暂无下发记录</strong><span>点击右上角「下发视频」开始分配任务</span></div>
        </div>
      </section>
    </template>
    </ConfigurablePageRenderer>

    <!-- ================ DIALOG: TASK DETAIL ================ -->
    <div class="dialog-overlay" v-if="showTaskDetail" @click.self="showTaskDetail = false">
      <div class="dialog-card detail-card">
        <div class="dialog-head">
          <div>
            <h3>{{ activeCity?.name || '城市' }} · 本月任务明细</h3>
            <p>{{ taskDetail.month }} · 按下发任务、发布填报和账号完成情况统计</p>
          </div>
          <button class="icon-close" @click="showTaskDetail = false"><IconFont name="close" :fallback="Close" /></button>
        </div>
        <div class="detail-body">
          <div class="detail-summary">
            <div class="detail-summary-row">
              <div class="detail-main">
                <span>本月完成度</span>
                <strong>{{ taskDetail.progress?.percentage || 0 }}%</strong>
                <div class="detail-bar"><i :style="{ width: (taskDetail.progress?.percentage || 0) + '%' }"></i></div>
                <em>已完成 {{ taskDetail.progress?.completed || 0 }}/{{ taskDetail.progress?.target || 0 }} 条</em>
              </div>
            </div>
            <div class="detail-summary-row second">
              <div class="detail-stat"><strong>{{ taskDetail.totals?.pending || 0 }}</strong><span>待发布</span></div>
              <div class="detail-stat warn"><strong>{{ taskDetail.totals?.overdue || 0 }}</strong><span>超期</span></div>
              <div class="detail-stat green"><strong>{{ taskDetail.totals?.reportedVideos || 0 }}</strong><span>已填报数据</span></div>
            </div>
          </div>

          <div class="detail-table-wrap">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>平台</th>
                  <th class="num">任务</th>
                  <th class="num">已发布</th>
                  <th class="num">待发布</th>
                  <th class="num">超期</th>
                  <th style="width:160px">完成率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in taskDetail.accounts || []" :key="row.city_id + '-' + row.account_id">
                  <td><strong>{{ row.account_name || '未绑定账号' }}</strong><span>{{ row.city_name }}</span></td>
                  <td>{{ platformLabel(row.platform) }}</td>
                  <td class="num">{{ row.assigned || 0 }}</td>
                  <td class="num green">{{ row.published || 0 }}</td>
                  <td class="num amber">{{ row.pending || 0 }}</td>
                  <td class="num pink">{{ row.overdue || 0 }}</td>
                  <td><div class="mini-progress"><i :style="{ width: (row.percentage || 0) + '%' }"></i></div></td>
                </tr>
                <tr v-if="!(taskDetail.accounts || []).length">
                  <td colspan="7"><div class="empty-inline">本月暂无下发任务</div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ================ DIALOG: DISTRIBUTE ================ -->
    <div class="dialog-overlay" v-if="showDialog" @click.self="closeDialog">
      <div class="dialog-card large">
        <div class="dialog-head">
          <div>
            <h3>{{ editingDistribution ? '编辑下发任务' : '下发视频到城市' }}</h3>
            <p>{{ editingDistribution ? '调整城市、账号与视频信息' : '单条或批量分配城市账号的视频发布任务' }}</p>
          </div>
          <button class="icon-close" @click="closeDialog"><IconFont name="close" :fallback="Close" /></button>
        </div>

        <div class="dialog-body">
          <div v-if="!editingDistribution" class="mode-tabs">
            <button :class="{ active: distributeMode === 'single' }" @click="distributeMode = 'single'">单条下发</button>
            <button :class="{ active: distributeMode === 'batch' }" @click="distributeMode = 'batch'">批量下发</button>
          </div>

          <div class="form-row two">
            <div class="form-field">
              <label><em>*</em>下发日期</label>
              <el-date-picker v-model="distForm.date" value-format="YYYY-MM-DD" class="inline-select" />
            </div>
            <div class="form-field">
              <label><em>*</em>目标城市</label>
              <el-select v-model="distForm.city_id" placeholder="选择城市" class="inline-select" @change="onCityChange">
                <el-option v-for="c in cities" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </div>
          </div>

          <template v-if="distributeMode === 'single' || editingDistribution">
            <div class="form-row two">
              <div class="form-field">
                <label><em>*</em>城市账号</label>
                <el-select v-model="distForm.account_id" placeholder="选择该城市账号" class="inline-select" :disabled="!distForm.city_id || !selectedCityAccounts.length">
                  <el-option
                    v-for="a in selectedCityAccounts"
                    :key="a.id"
                    :label="accountOptionLabel(a)"
                    :value="a.id"
                  />
                </el-select>
                <span v-if="distForm.city_id && !selectedCityAccounts.length" class="field-tip">该城市暂无账号，请先到城市账号页添加</span>
              </div>
              <div class="form-field">
                <label>发布时间</label>
                <el-time-picker v-model="distForm.time" value-format="HH:mm" format="HH:mm" class="inline-select" />
              </div>
            </div>

            <div class="form-field">
              <label>网盘链接 / 素材地址</label>
              <input v-model="distForm.video_url" class="text-input" placeholder="https://pan.example.com/xxx" />
            </div>

            <div class="form-field">
              <label>发布要求 / 备注</label>
              <textarea v-model="distForm.requirement" class="text-input" style="height: 86px; resize: vertical;" placeholder="发布时间建议、话题标签、特殊要求等"></textarea>
            </div>
          </template>

          <template v-else>
            <div v-if="distForm.city_id && !selectedCityAccounts.length" class="batch-empty">
              该城市暂无账号，请先到城市账号页添加账号后再批量下发
            </div>
            <div v-else class="batch-panel">
              <div class="batch-tools">
                <div class="form-field">
                  <label>批量粘贴</label>
                  <textarea v-model="batchPasteText" class="text-input paste-input" placeholder="每行一个账号和链接，如：&#10;遇见你真好 https://xxx.com/video1&#10;佳佳 https://xxx.com/video2"></textarea>
                </div>
                <div class="batch-actions">
                  <button class="btn-ghost" @click="applyBatchPaste">自动匹配链接</button>
                  <button class="btn-ghost" @click="fillEmptyTimes">统一时间 {{ distForm.time || '09:00' }}</button>
                </div>
              </div>

              <div class="batch-table-wrap">
                <table class="batch-table">
                  <thead>
                    <tr>
                      <th style="width:70px">启用</th>
                      <th>账号</th>
                      <th style="width:120px">时间</th>
                      <th>视频链接 / 素材地址</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in batchRows" :key="row.account_id" :class="{ filled: row.video_url }">
                      <td><input v-model="row.enabled" type="checkbox" /></td>
                      <td>
                        <strong>{{ row.account_name }}</strong>
                        <span>{{ platformLabel(row.platform) }}</span>
                      </td>
                      <td><input v-model="row.time" class="mini-input" placeholder="09:00" /></td>
                      <td><input v-model.trim="row.video_url" class="mini-input link" placeholder="粘贴该账号今天要发布的视频链接" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="batch-tip">批量下发会生成 {{ batchSubmitRows.length }} 条独立任务，最近下发记录和城市端会按账号逐条显示。</div>
            </div>
          </template>
        </div>

        <div class="dialog-foot">
          <button class="btn-ghost" @click="closeDialog">取消</button>
          <button class="btn-primary" :disabled="submitting || !canSubmitDistribute" @click="submitDist">
            <el-icon v-if="submitting"><Loading /></el-icon>
            <span>{{ submitting ? '提交中...' : distributeMode === 'batch' && !editingDistribution ? `确认批量下发 ${batchSubmitRows.length} 条` : '确认下发' }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import IconFont from '@/components/IconFont.vue'
import {
  Calendar, Promotion, CircleCheckFilled, Clock, WarningFilled,
  Close, Link, Location, Bell, Loading, Document, EditPen, Delete
} from '@element-plus/icons-vue'
import { batchCreateCityDistributions, createCityDistribution, deleteCityDistribution, getAccounts, getCities, getCityBoard, getCityDistributions, getTaskProgress, updateCityDistribution } from '@/api'
import { applySystemSettings, loadSystemSettings } from '@/utils/systemSettings'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const cityBoardLayoutModules = layoutModuleCatalog.cityBoard
const { bindings: layoutBindings } = useLayoutBindings('cityBoard')
const settings = reactive(loadSystemSettings())
const refreshSystemSettings = (event) => {
  applySystemSettings(settings, event?.detail || loadSystemSettings())
}

const bgPresets = {
  gradient1: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  gradient2: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 30%, #ddd6fe 60%, #e0e7ff 100%)',
  gradient3: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
}

const cityBoardBgStyle = computed(() => {
  const appearance = settings.appearance || {}
  const preset = appearance.cityBoardBgPreset || 'gradient1'
  if (preset === 'custom' && appearance.cityBoardBgUrl) {
    return {
      backgroundImage: `url(${appearance.cityBoardBgUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  return {
    background: bgPresets[preset] || bgPresets.gradient1
  }
})

const isCityBoardDarkBg = computed(() => {
  const preset = (settings.appearance || {}).cityBoardBgPreset || 'gradient1'
  return preset === 'gradient1'
})

const currentDate = ref(dayjs().format('YYYY-MM-DD'))
const cityFilter = ref('all')
const showDialog = ref(false)
const showTaskDetail = ref(false)
const submitting = ref(false)
const distributeMode = ref('single')
const editingDistribution = ref(null)
const activeCity = ref(null)
const taskDetail = ref({ month: dayjs().format('YYYY-MM'), progress: {}, totals: {}, accounts: [] })
const cities = ref([])
const distributions = ref([])
const cityAccounts = ref([])
const batchPasteText = ref('')
const batchRows = ref([])

const colorSet = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b', '#0ea5e9', '#84cc16', '#ef4444', '#14b8a6']

const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}

const normalizeCityStatus = (value) => {
  const map = { published: 'ok', not_started: 'all' }
  return map[value] || value || 'all'
}

const applyLayoutBindings = (bindings = {}) => {
  const nextDate = normalizeBoundDate(bindings.date)
  if (nextDate && nextDate !== currentDate.value) currentDate.value = nextDate
  if ('cityStatus' in bindings) cityFilter.value = normalizeCityStatus(bindings.cityStatus)
}

const distForm = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  city_id: '',
  account_id: '',
  time: '09:00',
  video_title: '',
  video_url: '',
  requirement: ''
})

// --- computed ---
const summary = computed(() => {
  const list = cities.value
  const total = list.length
  let published = 0, pending = 0, overdue = 0, totalAccounts = 0
  let publishedCities = 0, pendingCities = 0, overdueCities = 0
  list.forEach(c => {
    published += c.published_count || 0
    pending += c.pending_count || 0
    overdue += c.overdue_count || 0
    if (c.account_name || c.kuaishou_name) totalAccounts++
    if ((c.published_count || 0) > 0) publishedCities++
    if ((c.pending_count || 0) > 0) pendingCities++
    if ((c.overdue_count || 0) > 0) overdueCities++
  })
  const dist = distributions.value
  return {
    total, published, pending, overdue, totalAccounts,
    publishedCities, pendingCities, overdueCities,
    distConfirmed: dist.filter(d => d.status === 'published' || d.status === 'confirmed').length,
    distPending: dist.filter(d => d.status === 'pending' || d.status === 'distributed').length,
    distOverdue: dist.filter(d => d.status === 'overdue' || d.status === 'failed').length
  }
})

const pctPublished = computed(() => {
  const t = summary.value.published + summary.value.pending + summary.value.overdue
  return t ? Math.round((summary.value.published / t) * 100) : 0
})

const filteredCities = computed(() => {
  if (cityFilter.value === 'ok') return cities.value.filter(c => (c.published_count || 0) > 0 && (c.pending_count || 0) === 0 && (c.overdue_count || 0) === 0)
  if (cityFilter.value === 'pending') return cities.value.filter(c => (c.pending_count || 0) > 0)
  if (cityFilter.value === 'overdue') return cities.value.filter(c => (c.overdue_count || 0) > 0)
  return cities.value
})

const selectedCity = computed(() => cities.value.find(c => c.id === distForm.city_id) || null)
const selectedCityAccounts = computed(() => {
  const city = selectedCity.value
  if (!city) return []
  const nested = Array.isArray(city.accounts) ? city.accounts : []
  if (nested.length) return nested
  return cityAccounts.value.filter(account => account.city_id === city.id)
})
const batchSubmitRows = computed(() => batchRows.value.filter(row => row.enabled && row.video_url))
const canSubmitDistribute = computed(() => {
  if (editingDistribution.value || distributeMode.value === 'single') {
    return distForm.city_id && distForm.account_id
  }
  return distForm.city_id && batchSubmitRows.value.length > 0
})

const cityStatusClass = (c) => {
  if ((c.overdue_count || 0) > 0) return 'st-overdue'
  if ((c.pending_count || 0) > 0) return 'st-pending'
  if ((c.published_count || 0) > 0) return 'st-ok'
  return 'st-empty'
}
const cityStatusLabel = (c) => ({
  'st-overdue': '超期未发', 'st-pending': '待确认', 'st-ok': '已发布', 'st-empty': '空'
}[cityStatusClass(c)])

const totalCount = (c) => (c.published_count || 0) + (c.pending_count || 0) + (c.overdue_count || 0)
const progressOf = (c, k) => {
  const t = totalCount(c)
  if (!t) return 0
  const v = k === 'published' ? c.published_count || 0 : k === 'pending' ? c.pending_count || 0 : c.overdue_count || 0
  return Math.round((v / t) * 100)
}

const distStatusLabel = (s) => ({
  published: '已发布', confirmed: '已确认', distributed: '待确认', pending: '待发布',
  failed: '失败', overdue: '超期'
}[s] || s)
const distColor = (s) => ({ published: '#10b981', confirmed: '#10b981', distributed: '#f97316', pending: '#f59e0b', failed: '#ef4444', overdue: '#ef4444' }[s] || '#6366f1')
const distPillClass = (s) => ({
  published: 'green', confirmed: 'green', distributed: 'amber', pending: 'amber', failed: 'pink', overdue: 'pink'
}[s] || '')

const formatDay = (d) => dayjs(d).format('MM/DD')
const platformLabel = (p) => ({ douyin: '抖音', kuaishou: '快手', weixin: '视频号', xiaohongshu: '小红书', other: '其他' }[p] || (p || '-'))
const accountOptionLabel = (account) => {
  const platform = account.platform_label || account.platform || '账号'
  return `${account.name} · ${platform}`
}
const openLink = (url) => {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
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
const normalizeText = (value = '') => String(value).toLowerCase().replace(/\s+/g, '').replace(/[（）()【】\[\]·,，.。_-]/g, '')
const extractUrl = (line = '') => line.match(/https?:\/\/\S+/i)?.[0] || ''
const buildBatchRows = () => {
  const defaultTime = distForm.time || loadSystemSettings().preferences.defaultPublishTime || '09:00'
  batchRows.value = selectedCityAccounts.value.map(account => ({
    enabled: true,
    account_id: account.id,
    account_name: account.name,
    platform: account.platform_label || account.platform || '',
    time: account.default_publish_time || defaultTime,
    video_url: ''
  }))
}

// --- actions ---
const loadBoard = async () => {
  try {
    cities.value = await getCityBoard({ date: currentDate.value })
  } catch {
    const mock = ['西安', '成都', '武汉', '重庆', '郑州', '杭州', '南京', '长沙', '上海', '北京', '深圳', '广州']
    cities.value = mock.map((name, i) => ({
      id: 'city_' + i,
      name,
      account_name: '遇见' + name + '快手号',
      kuaishou_name: '遇见' + name + '快手号',
      published_count: i % 5 === 0 ? 0 : (i % 2) + 1,
      pending_count: i % 4 === 0 ? 1 : (i % 3 === 0 ? 1 : 0),
      overdue_count: i === 0 || i === 3 ? 1 : 0
    }))
  }
}

const loadDistributions = async () => {
  try {
    const data = await getCityDistributions({ page: 1, pageSize: 20, dateFrom: dayjs().subtract(14, 'day').format('YYYY-MM-DD'), dateTo: dayjs().format('YYYY-MM-DD') })
    distributions.value = data.list || []
  } catch {
    const arr = []
    const cityNames = ['西安', '成都', '武汉', '重庆', '郑州', '杭州', '南京', '长沙']
    const titles = ['城市宣传片 · 遇见城市美好', '技师风采展示', '同城探店', '服务场景展示', '用户故事']
    const statuses = ['published', 'distributed', 'pending', 'overdue']
    for (let i = 0; i < 10; i++) {
      arr.push({
        id: 'd_' + i,
        date: dayjs().subtract(i, 'day').format('YYYY-MM-DD'),
        time: ['09:00', '11:30', '14:00', '18:00'][i % 4],
        city_name: cityNames[i % cityNames.length],
        account_name: '遇见' + cityNames[i % cityNames.length] + '快手号',
        video_title: titles[i % titles.length],
        video_url: 'https://pan.example.com/video-' + i,
        status: statuses[i % 4]
      })
    }
    distributions.value = arr
  }
}

const loadAccounts = async () => {
  try {
    cityAccounts.value = await getAccounts({ type: 'city' })
  } catch {
    cityAccounts.value = cities.value.flatMap(c => (c.accounts || []).map(a => ({ ...a, city_id: c.id })))
  }
}

const openDistribute = (city) => {
  editingDistribution.value = null
  distributeMode.value = 'single'
  resetDistForm()
  showDialog.value = true
  if (city && city.id) {
    distForm.city_id = city.id
    pickDefaultAccount()
  } else {
    const defaultCity = loadSystemSettings().preferences.defaultCity
    const matchedCity = cities.value.find(item => String(item.id) === String(defaultCity))
    if (matchedCity) {
      distForm.city_id = matchedCity.id
      pickDefaultAccount()
    }
  }
  buildBatchRows()
}
const resetDistForm = () => {
  const preferences = loadSystemSettings().preferences
  distForm.date = currentDate.value
  distForm.city_id = ''
  distForm.account_id = ''
  distForm.time = preferences.defaultPublishTime || '09:00'
  distForm.video_title = ''
  distForm.video_url = ''
  distForm.requirement = ''
  batchPasteText.value = ''
  batchRows.value = []
}
const pickDefaultAccount = () => {
  const accounts = selectedCityAccounts.value
  distForm.account_id = accounts[0]?.id || ''
  buildBatchRows()
}
const onCityChange = () => {
  distForm.account_id = ''
  pickDefaultAccount()
}
const closeDialog = () => {
  showDialog.value = false
  editingDistribution.value = null
  distributeMode.value = 'single'
}
const fillEmptyTimes = () => {
  batchRows.value.forEach(row => {
    if (!row.time) row.time = distForm.time || '09:00'
    else row.time = distForm.time || row.time
  })
}
const applyBatchPaste = () => {
  const lines = batchPasteText.value.split(/\n+/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) return ElMessage.warning('请先粘贴账号和链接')
  let matched = 0
  const used = new Set()
  for (const row of batchRows.value) {
    const key = normalizeText(row.account_name)
    const matchIndex = lines.findIndex((item, idx) => !used.has(idx) && normalizeText(item).includes(key) && extractUrl(item))
    const line = matchIndex >= 0 ? lines[matchIndex] : ''
    if (line) {
      row.video_url = extractUrl(line)
      row.enabled = true
      used.add(matchIndex)
      matched++
    }
  }
  const unmatched = lines.length - matched
  ElMessage[matched ? 'success' : 'warning'](`已匹配 ${matched} 条${unmatched > 0 ? `，${unmatched} 条未匹配` : ''}`)
}

const submitDist = async () => {
  submitting.value = true
  try {
    if (editingDistribution.value) {
      await updateCityDistribution(editingDistribution.value.id, distForm)
      ElMessage.success('已更新')
    } else if (distributeMode.value === 'batch') {
      const city = cities.value.find(c => c.id === distForm.city_id)
      const batchId = `batch_${Date.now()}`
      const items = batchSubmitRows.value.map(row => ({
        date: distForm.date,
        city_id: distForm.city_id,
        account_id: row.account_id,
        video_title: `${city?.name || '城市'} · ${row.account_name}`,
        video_url: row.video_url,
        material_url: row.video_url,
        time: row.time || distForm.time || '09:00',
        publish_time: row.time || distForm.time || '09:00',
        publish_requirement: distForm.requirement || '',
        requirement: distForm.requirement || '',
        batch_id: batchId
      }))
      await batchCreateCityDistributions(items)
      ElMessage.success(`已批量下发 ${items.length} 条任务`)
    } else {
      await createCityDistribution(distForm)
      ElMessage.success('下发成功')
    }
    closeDialog()
    loadDistributions()
    loadBoard()
  } catch {
    if (editingDistribution.value) {
      const city = cities.value.find(c => c.id === distForm.city_id)
      const account = selectedCityAccounts.value.find(a => a.id === distForm.account_id)
      Object.assign(editingDistribution.value, {
        ...distForm,
        city_name: city?.name || editingDistribution.value.city_name,
        account_name: account?.name || editingDistribution.value.account_name
      })
      ElMessage.success('已更新')
      closeDialog()
      loadBoard()
      submitting.value = false
      return
    }
    // mock fallback
    const city = cities.value.find(c => c.id === distForm.city_id)
    const account = selectedCityAccounts.value.find(a => a.id === distForm.account_id)
    distributions.value.unshift({
      id: 'd_new_' + Date.now(),
      date: distForm.date, time: distForm.time,
      city_name: city?.name || '未选择',
      account_name: account?.name || city?.account_name || '城市账号',
      video_title: distForm.video_title,
      video_url: distForm.video_url,
      status: 'pending'
    })
    ElMessage.success('下发成功')
    closeDialog()
    loadBoard()
  } finally {
    submitting.value = false
  }
}

const confirmPublished = async (d) => {
  try { await updateCityDistribution(d.id, { status: 'published' }) } catch {}
  d.status = 'published'
  ElMessage.success('已确认发布')
  loadBoard()
}

const editDistribution = (d) => {
  editingDistribution.value = d
  distForm.date = d.date || currentDate.value
  distForm.city_id = d.city_id || ''
  distForm.account_id = d.account_id || ''
  distForm.time = d.time || '09:00'
  distForm.video_title = d.video_title || '城市下发任务'
  distForm.video_url = d.video_url || ''
  distForm.requirement = d.publish_requirement || d.requirement || ''
  showDialog.value = true
}

const removeDistribution = async (d) => {
  try {
    await ElMessageBox.confirm(`确认删除「${d.city_name || ''} · ${d.video_title}」这条下发记录？`, '删除下发记录', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try { await deleteCityDistribution(d.id) } catch {}
  distributions.value = distributions.value.filter(item => item.id !== d.id)
  ElMessage.success('已删除')
  loadBoard()
}

const openCityDetail = (c) => { ElMessage.info('查看 ' + c.name + ' 详情') }
const nudge = (c) => { ElMessage.success('已向「' + c.name + '」发送催办通知') }
const openTaskDetail = async (c) => {
  activeCity.value = c
  showTaskDetail.value = true
  taskDetail.value = { month: dayjs(currentDate.value).format('YYYY-MM'), progress: {}, totals: {}, accounts: [] }
  try {
    taskDetail.value = await getTaskProgress({
      month: dayjs(currentDate.value).format('YYYY-MM'),
      cityId: c.id
    })
  } catch {
    taskDetail.value = {
      month: dayjs(currentDate.value).format('YYYY-MM'),
      progress: { completed: c.published_count || 0, target: totalCount(c), percentage: progressOf(c, 'published') },
      totals: { pending: c.pending_count || 0, overdue: c.overdue_count || 0, reportedVideos: c.published_count || 0 },
      accounts: c.accounts || []
    }
  }
}

onMounted(() => {
  window.addEventListener('system-settings-updated', refreshSystemSettings)
  Promise.all([loadBoard(), loadDistributions(), loadAccounts()])
})
onBeforeUnmount(() => {
  window.removeEventListener('system-settings-updated', refreshSystemSettings)
})

watch(currentDate, () => {
  distForm.date = currentDate.value
  loadBoard()
})
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
/* ===== BASE ===== */
.page-wrap { padding: 20px 24px 40px; background: linear-gradient(180deg, #fafbff 0%, #f1f5f9 100%); min-height: calc(100vh - 60px); animation: fadeInUp 0.4s ease; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; letter-spacing: 0.02em; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }

/* ===== HERO ===== */
.hero {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding: 22px 24px; background: #fff; border-radius: 16px;
  border: 1px solid #eceff5; margin-bottom: 16px;
}
.hero-left { display: flex; flex-direction: column; gap: 6px; }
.title { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.015em; }
.subtitle { font-size: 13.5px; color: #6b7280; margin: 0; }
.hero-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.field-inline {
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px; height: 40px; border-radius: 10px;
  background: #fff; border: 1.5px solid #e5e7eb; color: #6b7280;
}
.field-inline:hover { border-color: #c7d2fe; }
.field-inline .el-icon { font-size: 15px; }
:deep(.inline-picker .el-input__wrapper) { box-shadow: none !important; padding: 0; background: transparent; }
:deep(.inline-picker .el-input__inner) { font-size: 13px; color: #111827; }

.btn-primary {
  height: 40px; padding: 0 16px; border-radius: 10px; border: 0; cursor: pointer;
  font-size: 13.5px; font-weight: 600; color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 4px 14px rgba(99,102,241,0.3);
  display: inline-flex; align-items: center; gap: 6px; transition: all 0.18s;
  font-family: inherit;
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.4); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  height: 40px; padding: 0 14px; border-radius: 10px; cursor: pointer;
  border: 1.5px solid #e5e7eb; background: #fff; color: #374151;
  font-size: 13.5px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s;
  font-family: inherit;
}
.btn-ghost:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }

/* ===== KPI ===== */
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.kpi-card {
  background: #fff; border: 1px solid #eceff5; border-radius: 16px;
  padding: 18px 20px; transition: all 0.2s;
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15,23,42,0.06); }
.kpi-card.primary {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #8b5cf6 100%);
  color: #fff; border: 0; box-shadow: 0 8px 24px rgba(99,102,241,0.25);
}
.kpi-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.kpi-label { font-size: 12.5px; color: #6b7280; font-weight: 500; }
.kpi-card.primary .kpi-label { color: rgba(255,255,255,0.8); }
.kpi-chip { font-size: 11px; padding: 3px 10px; border-radius: 99px; font-weight: 600; background: #f3f4f6; color: #374151; }
.kpi-card.primary .kpi-chip { background: rgba(255,255,255,0.18); color: #fff; }

.kpi-icon {
  width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center;
  font-size: 15px; background: #eef2ff; color: #6366f1;
}
.kpi-icon.ic-green { background: #ecfdf5; color: #10b981; }
.kpi-icon.ic-amber { background: #fff7ed; color: #f97316; }
.kpi-icon.ic-pink { background: #fef2f2; color: #ef4444; }

.kpi-value { display: flex; align-items: baseline; gap: 4px; margin-bottom: 10px; }
.kpi-value strong { font-size: 32px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; line-height: 1; }
.kpi-value em { font-style: normal; font-size: 13px; color: #9ca3af; font-weight: 500; }
.kpi-card.primary .kpi-value strong { color: #fff; }
.kpi-card.primary .kpi-value em { color: rgba(255,255,255,0.7); }

.kpi-bar { height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; margin-bottom: 8px; }
.kpi-bar i { display: block; height: 100%; background: linear-gradient(90deg, #6366f1, #a78bfa); border-radius: 99px; }
.kpi-card.primary .kpi-bar { background: rgba(255,255,255,0.18); }
.kpi-card.primary .kpi-bar i { background: linear-gradient(90deg, #fff, #ede9fe); }
.kpi-card.primary.light-bg {
  color: #0f172a;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(15,23,42,0.06);
}
.kpi-card.primary.light-bg .kpi-label { color: #6b7280; }
.kpi-card.primary.light-bg .kpi-chip { background: #f3f4f6; color: #374151; }
.kpi-card.primary.light-bg .kpi-value strong { color: #0f172a; }
.kpi-card.primary.light-bg .kpi-value em { color: #9ca3af; }
.kpi-card.primary.light-bg .kpi-bar { background: #e5e7eb; }
.kpi-card.primary.light-bg .kpi-bar i { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.kpi-card.primary.light-bg .kpi-meta, .kpi-card.primary.light-bg .kpi-meta .muted { color: #6b7280; }

.kpi-meta { font-size: 12.5px; color: #6b7280; }
.kpi-card.primary .kpi-meta, .kpi-card.primary .kpi-meta .muted { color: rgba(255,255,255,0.8); }
.delta.up { color: #10b981; font-weight: 600; }
.delta.danger { color: #ef4444; font-weight: 600; }
.muted { color: #9ca3af; }

/* ===== MAIN GRID ===== */
.main-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; }

.panel {
  background: #fff; border: 1px solid #eceff5; border-radius: 16px;
  padding: 22px 24px;
}
.panel-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 18px; gap: 12px;
}
.panel-head h3 { font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; margin: 0 0 4px; }
.panel-head p { font-size: 12.5px; color: #6b7280; margin: 0; }

.tab-row { display: flex; gap: 4px; background: #f8fafc; padding: 4px; border-radius: 10px; }
.tab {
  height: 30px; padding: 0 12px; border: 0; background: transparent;
  border-radius: 8px; font-size: 12px; color: #6b7280; font-weight: 500;
  cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 4px;
  font-family: inherit;
}
.tab span { font-size: 10.5px; background: #e5e7eb; color: #4b5563; padding: 1px 6px; border-radius: 99px; font-weight: 600; }
.tab:hover { color: #111827; }
.tab.active { background: #fff; color: #4338ca; box-shadow: 0 1px 3px rgba(15,23,42,0.08); }
.tab.active span { background: #6366f1; color: #fff; }

/* ===== CITY GRID ===== */
.city-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;
  max-height: 720px; overflow-y: auto; padding-right: 4px;
}
.city-grid::-webkit-scrollbar { width: 6px; }
.city-grid::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }

.city-card {
  background: #fff; border: 1.5px solid #eceff5; border-radius: 14px;
  padding: 16px; transition: all 0.2s; cursor: pointer;
}
.city-card:hover {
  transform: translateY(-2px); border-color: #c7d2fe;
  box-shadow: 0 10px 24px rgba(99,102,241,0.12);
}
.city-card.st-overdue { border-color: #fecaca; background: linear-gradient(180deg, #fef2f2 0%, #fff 30%); }
.city-card.st-pending { border-color: #fcd34d; background: linear-gradient(180deg, #fef3c7 0%, #fff 30%); }
.city-card.st-ok { border-color: #a7f3d0; background: linear-gradient(180deg, #ecfdf5 0%, #fff 30%); }

.card-hero { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.city-avatar {
  width: 44px; height: 44px; border-radius: 11px; display: grid; place-items: center;
  font-size: 14px; font-weight: 700; flex-shrink: 0;
}
.city-main { flex: 1; min-width: 0; }
.city-name { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 2px; letter-spacing: -0.01em; }
.city-account { font-size: 11.5px; color: #6b7280; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.status-badge {
  font-size: 11px; padding: 4px 10px; border-radius: 6px; font-weight: 600;
  background: #f3f4f6; color: #4b5563;
}
.status-badge.st-ok { background: #d1fae5; color: #047857; }
.status-badge.st-pending { background: #fef3c7; color: #b45309; }
.status-badge.st-overdue { background: #fee2e2; color: #b91c1c; }

.card-stats {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-top: 1px dashed #e5e7eb; border-bottom: 1px dashed #e5e7eb;
  margin-bottom: 12px;
}
.stat-item { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 3px; }
.stat-num { font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.stat-num.success { color: #059669; }
.stat-num.amber { color: #ea580c; }
.stat-num.pink { color: #dc2626; }
.stat-label { font-size: 10.5px; color: #6b7280; font-weight: 500; }
.stat-divider { width: 1px; height: 24px; background: #e5e7eb; }

.card-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.progress-track { position: relative; flex: 1; height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
.progress-bar { position: absolute; top: 0; height: 100%; }
.progress-bar.green { background: #10b981; left: 0; }
.progress-bar.amber { background: #f59e0b; }
.progress-bar.pink { background: #ef4444; }
.progress-text { font-size: 11px; color: #6b7280; font-weight: 500; white-space: nowrap; }

.card-actions { display: flex; gap: 8px; }
.mini-btn {
  height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid #e5e7eb;
  background: #fff; color: #374151; font-size: 12px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;
  font-family: inherit;
}
.mini-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.mini-btn.warn:hover { border-color: #f97316; color: #f97316; background: #fff7ed; }
.mini-btn.success:hover { border-color: #10b981; color: #10b981; background: #ecfdf5; }
.mini-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* ===== TASK DETAIL ===== */
.dialog-card.detail-card { 
  width: min(720px, calc(100vw - 40px)) !important; 
  max-width: min(720px, calc(100vw - 40px)) !important;
  max-height: 85vh; 
  overflow-y: auto; 
}
.detail-card::-webkit-scrollbar { width: 6px; }
.detail-card::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }
.detail-body { display: flex; flex-direction: column; gap: 16px; }
.detail-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.detail-summary-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.detail-summary-row.second {
  grid-template-columns: repeat(3, 1fr);
}
.detail-main, .detail-stat {
  border: 1px solid #eef0f6;
  border-radius: 14px;
  background: #fafbff;
  padding: 16px 18px;
}
.detail-main span, .detail-stat span { display: block; color: #64748b; font-size: 12px; font-weight: 600; }
.detail-main strong {
  display: block;
  margin: 8px 0;
  color: #4f46e5;
  font-size: 36px;
  line-height: 1;
  font-weight: 800;
}
.detail-main em { display: block; margin-top: 8px; color: #64748b; font-size: 12px; font-style: normal; }
.detail-bar { height: 8px; border-radius: 999px; overflow: hidden; background: #e5e7eb; margin-top: 6px; }
.detail-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.detail-stat { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.detail-stat strong { color: #4f46e5; font-size: 28px; line-height: 1; margin-bottom: 6px; }
.detail-stat.warn strong { color: #f97316; }
.detail-stat.green strong { color: #10b981; }
.detail-table-wrap { border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background: #fff; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
.detail-table th {
  text-align: left;
  padding: 13px 14px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.detail-table th:first-child { width: 180px; }
.detail-table th:nth-child(2) { width: 80px; }
.detail-table th:nth-child(3) { width: 60px; }
.detail-table th:nth-child(4) { width: 70px; }
.detail-table th:nth-child(5) { width: 70px; }
.detail-table th:nth-child(6) { width: 60px; }
.detail-table th:last-child { width: 120px; }
.detail-table td { padding: 13px 14px; border-bottom: 1px solid #f1f5f9; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-table tr:last-child td { border-bottom: 0; }
.detail-table tr:hover td { background: #fafbff; }
.detail-table td:first-child {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}
.detail-table td:first-child strong { display: block; font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 3px; }
.detail-table td:first-child span { color: #94a3b8; font-size: 11px; }
.detail-table td:nth-child(3), .detail-table td:nth-child(4), .detail-table td:nth-child(5), .detail-table td:nth-child(6) { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.detail-table .green { color: #059669; }
.detail-table .amber { color: #d97706; }
.detail-table .pink { color: #dc2626; }
.mini-progress { height: 7px; border-radius: 999px; background: #eef2ff; overflow: hidden; }
.mini-progress i { display: block; height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: inherit; }
.empty-inline { padding: 24px; text-align: center; color: #94a3b8; }

/* ===== DISTRIBUTION TIMELINE ===== */
.summary-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { font-size: 11px; padding: 4px 10px; border-radius: 6px; font-weight: 600; background: #f3f4f6; color: #4b5563; white-space: nowrap; }
.pill.green { background: #d1fae5; color: #047857; }
.pill.amber { background: #fef3c7; color: #b45309; }
.pill.pink { background: #fee2e2; color: #b91c1c; }
.pill.city { background: #eef2ff; color: #4338ca; }
.pill.account { background: #f1f5f9; color: #475569; }

.status-pill { font-size: 11px; padding: 4px 10px; border-radius: 6px; font-weight: 600; }
.status-pill.green { background: #d1fae5; color: #047857; }
.status-pill.amber { background: #fef3c7; color: #b45309; }
.status-pill.pink { background: #fee2e2; color: #b91c1c; }

.timeline-list { display: flex; flex-direction: column; gap: 12px; max-height: 720px; overflow-y: auto; padding-right: 4px; }
.timeline-list::-webkit-scrollbar { width: 6px; }
.timeline-list::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }

.timeline-item { display: grid; grid-template-columns: 60px 20px 1fr; gap: 10px; }

.timeline-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; padding-top: 12px; }
.timeline-meta strong { font-size: 13px; font-weight: 600; color: #0f172a; }
.timeline-meta span { font-size: 11px; color: #9ca3af; font-weight: 500; }

.timeline-rail { position: relative; display: flex; justify-content: center; }
.timeline-rail::before { content: ''; position: absolute; left: 50%; top: 0; bottom: -12px; width: 2px; background: #e5e7eb; transform: translateX(-50%); }
.timeline-rail i {
  position: relative; width: 10px; height: 10px; border-radius: 99px;
  margin-top: 16px; box-shadow: 0 0 0 3px #fff; z-index: 1;
}

.timeline-card {
  background: #fff; border: 1.5px solid #eceff5; border-radius: 12px;
  padding: 12px 14px; transition: all 0.2s;
}
.timeline-card:hover { border-color: #c7d2fe; box-shadow: 0 6px 18px rgba(99,102,241,0.1); transform: translateX(2px); }
.timeline-card.st-published { border-color: #a7f3d0; background: linear-gradient(180deg, #ecfdf5 0%, #fff 40%); }
.timeline-card.st-confirmed { border-color: #a7f3d0; background: linear-gradient(180deg, #ecfdf5 0%, #fff 40%); }
.timeline-card.st-overdue, .timeline-card.st-failed { border-color: #fecaca; background: linear-gradient(180deg, #fef2f2 0%, #fff 40%); }
.timeline-card.st-pending, .timeline-card.st-distributed { border-color: #fcd34d; background: linear-gradient(180deg, #fef3c7 0%, #fff 40%); }

.timeline-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.timeline-title { font-size: 13.5px; font-weight: 600; color: #0f172a; margin: 0 0 8px; line-height: 1.4; }
.timeline-foot { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.timeline-foot .el-icon { font-size: 11px; flex-shrink: 0; }
.link-btn {
  height: 28px;
  padding: 0 11px;
  border-radius: 8px;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.link-btn.ghost { background: #fff; color: #64748b; border-color: #e5e7eb; }
.timeline-actions { padding-top: 8px; border-top: 1px dashed #e5e7eb; }

/* ===== EMPTY ===== */
.empty-state {
  padding: 40px 20px; display: flex; flex-direction: column;
  align-items: center; gap: 10px; background: #fafbfc;
  border-radius: 12px; border: 1px dashed #e5e7eb;
}
.empty-state.small { padding: 30px 20px; }
.empty-ic {
  width: 48px; height: 48px; border-radius: 12px;
  background: #eef2ff; color: #6366f1;
  display: grid; place-items: center; font-size: 22px;
}
.empty-txt { text-align: center; }
.empty-txt strong { font-size: 13.5px; color: #0f172a; font-weight: 600; display: block; margin-bottom: 4px; }
.empty-txt span { font-size: 12px; color: #9ca3af; }

/* ===== DIALOG ===== */
.dialog-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);
  display: grid; place-items: center; animation: fadeIn 0.2s;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.dialog-card {
  width: 620px; max-width: calc(100vw - 32px); max-height: 90vh; overflow: hidden;
  background: #fff; border-radius: 18px; box-shadow: 0 30px 80px rgba(15,23,42,0.25);
  animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1);
  display: flex; flex-direction: column;
}
.dialog-card.large { width: min(980px, calc(100vw - 32px)); }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }

.dialog-head {
  padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 1px solid #f1f5f9;
}
.dialog-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
.dialog-head p { margin: 4px 0 0; font-size: 12.5px; color: #6b7280; }
.icon-close {
  width: 34px; height: 34px; border-radius: 9px; border: 0; cursor: pointer;
  background: #f3f4f6; color: #6b7280; display: grid; place-items: center; transition: all 0.15s;
}
.icon-close:hover { background: #eef2ff; color: #6366f1; }

.dialog-body { padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.mode-tabs {
  display: inline-flex;
  width: fit-content;
  padding: 4px;
  border-radius: 12px;
  background: #f1f5f9;
}
.mode-tabs button {
  height: 34px;
  padding: 0 18px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.mode-tabs button.active {
  color: #4f46e5;
  background: #fff;
  box-shadow: 0 4px 12px rgba(15,23,42,.08);
}
.form-row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field label { font-size: 12.5px; color: #374151; font-weight: 500; display: flex; align-items: center; gap: 3px; }
.form-field label em { color: #ef4444; font-style: normal; font-size: 13px; }
.field-tip { font-size: 12px; color: #ef4444; line-height: 1.4; }

.text-input {
  height: 42px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #e5e7eb;
  background: #fafbfc; color: #0f172a; font-size: 13.5px; font-family: inherit;
  outline: 0; transition: all 0.15s;
}
.text-input:focus { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }
.paste-input { min-height: 96px; padding-top: 12px; resize: vertical; line-height: 1.5; }
.batch-empty {
  padding: 18px;
  border: 1px dashed #fecaca;
  border-radius: 12px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
}
.batch-panel { display: flex; flex-direction: column; gap: 14px; }
.batch-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}
.batch-actions { display: flex; flex-direction: column; gap: 8px; padding-bottom: 1px; }
.batch-table-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: auto;
  max-height: 360px;
  background: #fff;
}
.batch-table { width: 100%; min-width: 760px; border-collapse: collapse; font-size: 13px; }
.batch-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 12px 14px;
  text-align: left;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  border-bottom: 1px solid #e5e7eb;
}
.batch-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.batch-table tr.filled td { background: #f0fdf4; }
.batch-table td strong { display: block; color: #0f172a; font-size: 13px; margin-bottom: 3px; }
.batch-table td span { color: #94a3b8; font-size: 11px; }
.mini-input {
  width: 100%;
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  padding: 0 10px;
  outline: 0;
  background: #fff;
  color: #0f172a;
  font-family: inherit;
  font-size: 13px;
}
.mini-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
.mini-input.link { min-width: 280px; }
.batch-tip {
  padding: 10px 12px;
  border-radius: 10px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12.5px;
  font-weight: 600;
}

:deep(.inline-select .el-input__wrapper) {
  height: 42px; background: #fafbfc; border-radius: 10px;
  box-shadow: 0 0 0 1.5px #e5e7eb inset !important; padding: 0 14px;
}
:deep(.inline-select .el-input__wrapper.is-focus) { box-shadow: 0 0 0 1.5px #6366f1 inset !important; }
:deep(.inline-select .el-input__inner) { font-size: 13.5px; }

.dialog-foot {
  padding: 16px 24px; display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid #f1f5f9; background: #fafbfc;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1280px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .main-grid { grid-template-columns: 1fr; }
}
@media (max-width: 880px) {
  .page-wrap { padding: 16px; }
  .hero { flex-direction: column; align-items: flex-start; gap: 14px; }
  .hero-right { width: 100%; flex-wrap: wrap; }
  .kpi-row { grid-template-columns: 1fr 1fr; }
  .dialog-card.large { width: calc(100vw - 32px); }
  .form-row.two { grid-template-columns: 1fr; }
  .city-grid { grid-template-columns: 1fr; }
}
</style>
