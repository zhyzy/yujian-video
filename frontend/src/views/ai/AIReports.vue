<template>
  <div class="ai-report-workbench">
    <ConfigurablePageRenderer page-key="aiReports" :modules="aiReportsLayoutModules">
      <template #page-head>
        <section class="ai-hero">
          <div class="hero-brand">
            <div class="brand-mark">
              <el-icon><MagicStick /></el-icon>
            </div>
            <div>
              <p>AI 智能报表助手</p>
              <h1>把每日运营数据变成可直接汇报的日报</h1>
            </div>
          </div>
          <div class="hero-actions">
            <button class="ghost-btn" @click="loadReports">
              <el-icon><Refresh /></el-icon>
              刷新
            </button>
            <button class="ghost-btn" :disabled="!activeContent" @click="copyReport">
              <el-icon><CopyDocument /></el-icon>
              复制
            </button>
            <button class="primary-btn" :disabled="generating" @click="generateReport">
              <el-icon v-if="generating"><Loading /></el-icon>
              <el-icon v-else><MagicStick /></el-icon>
              {{ generating ? '生成中...' : '开始生成' }}
            </button>
          </div>
        </section>
      </template>

      <template #config-panel>
        <section class="work-panel config-panel">
          <header class="panel-title">
            <div>
              <h2>报告配置</h2>
              <p>选择周期、模型和输出风格</p>
            </div>
            <span>01</span>
          </header>

          <div class="config-section">
            <label>时间范围</label>
            <div class="quick-grid">
              <button
                v-for="item in quickRanges"
                :key="item.label"
                class="quick-btn"
                :class="{ active: item.isActive() }"
                @click="item.apply()"
              >
                {{ item.label }}
              </button>
            </div>
            <el-date-picker
              v-model="range"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              class="full-picker"
            />
          </div>

          <div class="config-section">
            <label>报告类型</label>
            <div class="type-grid">
              <button
                v-for="item in typeOptions"
                :key="item.value"
                class="type-card"
                :class="{ active: form.type === item.value }"
                @click="changeType(item.value)"
              >
                <el-icon><component :is="item.icon" /></el-icon>
                {{ item.label }}
              </button>
            </div>
          </div>

          <div class="config-section">
            <label>AI 模型设置</label>
            <el-select v-model="form.model" class="full-control">
              <el-option label="DeepSeek / 火山方舟" value="deepseek-v4-flash" />
              <el-option label="本地数据报告" value="local-fallback" />
            </el-select>
            <div class="slider-row">
              <span>创造性</span>
              <el-slider v-model="form.temperature" :min="0" :max="1" :step="0.1" />
              <b>{{ form.temperature }}</b>
            </div>
            <div class="split-row">
              <el-select v-model="form.tone">
                <el-option label="专业严谨" value="专业严谨" />
                <el-option label="简洁直接" value="简洁直接" />
                <el-option label="管理层汇报" value="管理层汇报" />
              </el-select>
              <el-select v-model="form.length">
                <el-option label="精简" value="精简" />
                <el-option label="中等" value="中等" />
                <el-option label="详细" value="详细" />
              </el-select>
            </div>
          </div>

          <div class="config-section">
            <label>业务配置</label>
            <div class="split-row">
              <el-select v-model="form.department">
                <el-option label="运营部" value="运营部" />
                <el-option label="产品部" value="产品部" />
                <el-option label="城市运营" value="城市运营" />
              </el-select>
              <el-input v-model="form.project" placeholder="关联项目" />
            </div>
            <el-select v-model="form.keywords" multiple filterable allow-create default-first-option class="full-control" placeholder="关注重点关键词">
              <el-option label="用户反馈" value="用户反馈" />
              <el-option label="发布效率" value="发布效率" />
              <el-option label="城市填报" value="城市填报" />
              <el-option label="播放增长" value="播放增长" />
              <el-option label="成交转化" value="成交转化" />
            </el-select>
          </div>

          <div class="config-section">
            <label>参考资料</label>
            <button class="upload-box" type="button">
              <el-icon><Upload /></el-icon>
              <span>上传资料</span>
              <small>后续支持 PDF、Word、Excel</small>
            </button>
          </div>
        </section>
      </template>

      <template #chat-panel>
        <section class="work-panel chat-panel">
          <header class="panel-title chat-head">
            <div>
              <h2>AI 对话</h2>
              <p>补充人工信息，AI 会和系统数据一起整理</p>
            </div>
            <span>已使用 {{ dailyUsed }}/50 次</span>
          </header>

          <div class="chat-body">
            <article
              v-for="message in messages"
              :key="message.id"
              class="chat-message"
              :class="message.role"
            >
              <div class="avatar">
                <el-icon v-if="message.role === 'assistant'"><MagicStick /></el-icon>
                <el-icon v-else><User /></el-icon>
              </div>
              <div class="bubble">
                <p>{{ message.content }}</p>
                <time>{{ message.time }}</time>
              </div>
            </article>

            <article v-if="generating" class="chat-message assistant">
              <div class="avatar"><el-icon><Loading /></el-icon></div>
              <div class="bubble progress-bubble">
                <p>{{ generationTitle }}</p>
                <div class="steps">
                  <span
                    v-for="(step, index) in generationSteps"
                    :key="step"
                    :class="{ done: index < generationStepIndex, active: index === generationStepIndex }"
                  >
                    {{ step }}
                  </span>
                </div>
              </div>
            </article>
          </div>

          <div class="check-card">
            <strong>建议补充的信息</strong>
            <label v-for="item in checklist" :key="item.key">
              <input v-model="item.checked" type="checkbox" />
              {{ item.label }}
            </label>
          </div>

          <div class="quick-actions">
            <button v-for="item in promptChips" :key="item" @click="insertPrompt(item)">{{ item }}</button>
          </div>

          <div class="chat-input">
            <textarea
              v-model="inputMessage"
              rows="3"
              placeholder="请输入今天完成的工作、遇到的问题、明日计划，或让 AI 调整日报表达..."
              @keydown.meta.enter.prevent="sendMessage"
              @keydown.ctrl.enter.prevent="sendMessage"
            ></textarea>
            <button class="send-btn" type="button" :disabled="!inputMessage.trim()" @click="sendMessage">
              <el-icon><Promotion /></el-icon>
            </button>
          </div>
        </section>
      </template>

      <template #insight-panel>
        <section class="work-panel insight-panel">
          <header class="panel-title">
            <div>
              <h2>报告洞察</h2>
              <p>{{ latestGeneratedText }}</p>
            </div>
            <span>03</span>
          </header>

          <div class="metric-grid">
            <div v-for="card in insightCards" :key="card.label" class="metric-card">
              <el-icon :style="{ color: card.color }"><component :is="card.icon" /></el-icon>
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
              <small>{{ card.hint }}</small>
            </div>
          </div>

          <div class="insight-block">
            <div class="block-head">
              <h3>工作亮点</h3>
              <button @click="focusReportSection('亮点')">查看更多</button>
            </div>
            <ul class="star-list">
              <li v-for="item in workHighlights" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="insight-grid">
            <div class="donut-card">
              <h3>事项分布</h3>
              <div class="donut">
                <span>{{ completionRate }}%</span>
              </div>
              <p v-for="item in distributionItems" :key="item.label">
                <i :style="{ background: item.color }"></i>
                {{ item.label }}
                <b>{{ item.value }}</b>
              </p>
            </div>
            <div class="trend-card">
              <h3>进度趋势</h3>
              <div class="mini-chart">
                <i v-for="point in progressPoints" :key="point.date" :style="{ height: `${point.height}%` }"></i>
              </div>
              <div class="axis-row">
                <span v-for="point in progressPoints" :key="point.date">{{ point.label }}</span>
              </div>
            </div>
          </div>

          <div class="insight-block pending">
            <h3>待办事项</h3>
            <label v-for="item in pendingItems" :key="item">
              <input type="checkbox" />
              {{ item }}
            </label>
          </div>
        </section>
      </template>

      <template #preview-panel>
        <section class="work-panel preview-panel">
          <header class="panel-title preview-head">
            <div>
              <h2>日报内容预览</h2>
              <p>{{ activeMeta || '生成后可复制或导出 Word' }}</p>
            </div>
            <div class="panel-actions">
              <span v-if="activeContent" class="status-pill">已生成</span>
              <button class="ghost-btn small" :disabled="!activeContent" @click="copyReport">
                <el-icon><CopyDocument /></el-icon>复制
              </button>
              <button class="ghost-btn small" :disabled="!activeContent" @click="exportWord">
                <el-icon><Download /></el-icon>导出 Word
              </button>
            </div>
          </header>

          <div v-if="!activeContent" class="empty-state">
            <el-icon><Document /></el-icon>
            <h3>还没有生成日报</h3>
            <p>先在左侧选择周期，再在中间补充今日工作，点击“开始生成”。</p>
            <button class="primary-btn" :disabled="generating" @click="generateReport">
              <el-icon><MagicStick /></el-icon>
              生成第一份日报
            </button>
          </div>

          <div v-else class="report-preview">
            <div class="report-top">
              <div>
                <h3>{{ parsedTitle }}</h3>
                <p>{{ activeMeta }}</p>
              </div>
              <span>{{ reportTypeLabel(form.type) }}</span>
            </div>

            <div class="snapshot-row" v-if="snapshotCards.length">
              <div v-for="card in snapshotCards" :key="card.label">
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
                <small v-if="card.sub">{{ card.sub }}</small>
              </div>
            </div>

            <div class="report-body" v-html="renderedContent"></div>
          </div>
        </section>
      </template>

      <template #history-panel>
        <section class="work-panel history-panel">
          <header class="panel-title">
            <div>
              <h2>历史记录</h2>
              <p>共 {{ reports.length }} 份</p>
            </div>
            <button class="icon-btn" @click="loadReports">
              <el-icon><Refresh /></el-icon>
            </button>
          </header>

          <div v-if="!reports.length" class="history-empty">
            暂无历史报告
          </div>

          <div v-else class="history-list">
            <button
              v-for="item in reports"
              :key="item.id"
              class="history-item"
              :class="{ active: activeId === item.id }"
              @click="selectReport(item)"
            >
              <span :class="typeClass(item.type)">
                <el-icon><component :is="typeIcon(item.type)" /></el-icon>
              </span>
              <div>
                <strong>{{ reportTypeLabel(item.type) }}</strong>
                <small>{{ item.period_start }} 至 {{ item.period_end }}</small>
              </div>
              <el-icon><ArrowRight /></el-icon>
            </button>
          </div>
        </section>
      </template>
    </ConfigurablePageRenderer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import {
  Aim,
  ArrowRight,
  Calendar,
  CircleCheckFilled,
  Clock,
  Coin,
  CopyDocument,
  DataAnalysis,
  Document,
  Download,
  Histogram,
  Loading,
  MagicStick,
  Promotion,
  Refresh,
  ShoppingCart,
  TrendCharts,
  Upload,
  User,
  WarningFilled
} from '@element-plus/icons-vue'
import { generateAIReport, getAIReports } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const route = useRoute()
const aiReportsLayoutModules = layoutModuleCatalog.aiReports
const { bindings: layoutBindings } = useLayoutBindings('aiReports')

const today = dayjs().format('YYYY-MM-DD')
const routeDate = typeof route.query.date === 'string' ? route.query.date : ''
const routeType = typeof route.query.type === 'string' ? route.query.type : 'daily'

const defaultRangeByType = (type) => {
  if (routeDate) return [routeDate, routeDate]
  if (type === 'weekly') return [dayjs().subtract(6, 'day').format('YYYY-MM-DD'), today]
  if (type === 'monthly') return [dayjs().startOf('month').format('YYYY-MM-DD'), today]
  return [today, today]
}

const reports = ref([])
const activeId = ref('')
const activeContent = ref('')
const activeRawData = ref(null)
const generating = ref(false)
const generationStepIndex = ref(0)
const dailyUsed = ref(12)
const inputMessage = ref('')
let generationTimer = null

const range = ref(defaultRangeByType(routeType))
const form = reactive({
  type: ['daily', 'weekly', 'monthly'].includes(routeType) ? routeType : 'daily',
  periodStart: range.value[0],
  periodEnd: range.value[1],
  model: 'deepseek-v4-flash',
  temperature: 0.4,
  tone: '专业严谨',
  length: '中等',
  department: '运营部',
  project: '遇见自媒体运营',
  keywords: ['发布效率', '城市填报', '播放增长']
})

const checklist = reactive([
  { key: 'done', label: '完成的具体事项及成果', checked: true },
  { key: 'problem', label: '遇到的问题与解决方案', checked: true },
  { key: 'data', label: '数据指标与进展', checked: true },
  { key: 'plan', label: '明日计划', checked: true },
  { key: 'other', label: '其他需要说明的事项', checked: false }
])

const promptChips = ['优化语言表达', '补充数据指标', '生成明日计划', '精简摘要']
const generationSteps = ['整理关键数据', '融合人工补充', '生成结构化内容', '优化语言表达']

const typeOptions = [
  { label: '日报', value: 'daily', icon: Clock },
  { label: '周报', value: 'weekly', icon: Histogram },
  { label: '月报', value: 'monthly', icon: DataAnalysis }
]

const messages = ref([
  {
    id: 'welcome',
    role: 'assistant',
    content: '您好，我是您的 AI 报表助手。左侧选择周期后，可以在这里补充今天完成了什么、遇到哪些问题、明天准备做什么，我会把这些内容和系统数据一起整理成日报。',
    time: dayjs().format('HH:mm')
  }
])

const quickRanges = [
  {
    label: '今天',
    apply: () => { range.value = [today, today] },
    isActive: () => range.value[0] === today && range.value[1] === today
  },
  {
    label: '昨天',
    apply: () => {
      const d = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      range.value = [d, d]
    },
    isActive: () => {
      const d = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      return range.value[0] === d && range.value[1] === d
    }
  },
  {
    label: '本周',
    apply: () => { range.value = [dayjs().startOf('week').format('YYYY-MM-DD'), today] },
    isActive: () => range.value[0] === dayjs().startOf('week').format('YYYY-MM-DD') && range.value[1] === today
  },
  {
    label: '上周',
    apply: () => {
      range.value = [
        dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'),
        dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD')
      ]
    },
    isActive: () => range.value[0] === dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD')
  },
  {
    label: '本月',
    apply: () => { range.value = [dayjs().startOf('month').format('YYYY-MM-DD'), today] },
    isActive: () => range.value[0] === dayjs().startOf('month').format('YYYY-MM-DD') && range.value[1] === today
  },
  {
    label: '上月',
    apply: () => {
      range.value = [
        dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
        dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
      ]
    },
    isActive: () => range.value[0] === dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
  }
]

watch(range, (value) => {
  form.periodStart = value?.[0] || today
  form.periodEnd = value?.[1] || form.periodStart
})

const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}

const applyLayoutBindings = (bindings = {}) => {
  if (['daily', 'weekly', 'monthly'].includes(bindings.type)) form.type = bindings.type
  const from = normalizeBoundDate(bindings.dateFrom)
  const to = normalizeBoundDate(bindings.dateTo)
  if (from || to) range.value = [from || to, to || from]
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

const changeType = (type) => {
  form.type = type
  range.value = defaultRangeByType(type)
}

const reportTypeLabel = (type) => ({
  daily: '日报',
  weekly: '周报',
  monthly: '月报',
  monthly_plan: '月计划'
}[type] || '报告')

const typeClass = (type) => ({
  daily: 'type-daily',
  weekly: 'type-weekly',
  monthly: 'type-monthly'
}[type] || 'type-daily')

const typeIcon = (type) => ({
  daily: Clock,
  weekly: Histogram,
  monthly: DataAnalysis
}[type] || Document)

const activeMeta = computed(() => activeContent.value ? `${form.periodStart} 至 ${form.periodEnd}` : '')
const latestGeneratedText = computed(() => activeRawData.value?.meta?.generatedAt ? `最新生成：${dayjs(activeRawData.value.meta.generatedAt).format('HH:mm')}` : '等待生成报告')
const generationTitle = computed(() => generationSteps[generationStepIndex.value] || '正在生成报告')

const reportSummary = computed(() => activeRawData.value?.summary || null)
const detailData = computed(() => activeRawData.value?.details || {})

const parsedTitle = computed(() => {
  const titleLine = (activeContent.value || '').split('\n').find(line => line.trim().startsWith('#'))
  if (titleLine) return titleLine.replace(/^#+\s*/, '').trim()
  return `${reportTypeLabel(form.type)} · ${form.periodStart}`
})

const formatNumber = (value) => {
  const number = Number(value || 0)
  if (number >= 10000) return `${(number / 10000).toFixed(1).replace(/\.0$/, '')} 万`
  return number.toLocaleString('zh-CN')
}

const snapshotCards = computed(() => {
  const summary = reportSummary.value
  if (!summary) return []
  return [
    { label: '素材拍摄', value: summary.production?.shootCount || 0 },
    { label: '发布完成', value: summary.schedule?.published || 0, sub: `${summary.derived?.publishCompletionRate || 0}%` },
    { label: '城市完成', value: summary.cityDistribution?.published || 0, sub: `${summary.derived?.cityCompletionRate || 0}%` },
    { label: '总播放', value: formatNumber(summary.performance?.playCount || 0) },
    { label: '成交单数', value: summary.performance?.dealCount || 0 },
    { label: '成交金额', value: `¥${formatNumber(summary.performance?.dealAmount || 0)}` }
  ]
})

const insightCards = computed(() => {
  const summary = reportSummary.value || {}
  return [
    {
      label: '完成事项',
      value: (summary.schedule?.published || 0) + (summary.cityDistribution?.published || 0),
      hint: '总部发布 + 城市发布',
      icon: CircleCheckFilled,
      color: '#2563eb'
    },
    {
      label: '解决问题',
      value: (summary.schedule?.failed || 0) + (summary.cityDistribution?.failed || 0),
      hint: '失败项需复盘',
      icon: WarningFilled,
      color: '#f97316'
    },
    {
      label: '效率提升',
      value: `${summary.derived?.publishCompletionRate || 0}%`,
      hint: '发布完成率',
      icon: TrendCharts,
      color: '#8b5cf6'
    },
    {
      label: '整体进度',
      value: `${summary.derived?.cityCompletionRate || 0}%`,
      hint: '城市完成率',
      icon: Aim,
      color: '#ef4444'
    }
  ]
})

const completionRate = computed(() => Number(reportSummary.value?.derived?.publishCompletionRate || 0))
const distributionItems = computed(() => [
  { label: '已发布', value: reportSummary.value?.schedule?.published || 0, color: '#4f6bff' },
  { label: '待发布', value: reportSummary.value?.schedule?.pending || 0, color: '#22c55e' },
  { label: '失败/超期', value: (reportSummary.value?.schedule?.failed || 0) + (reportSummary.value?.cityDistribution?.overdue || 0), color: '#f97316' }
])

const workHighlights = computed(() => {
  const summary = reportSummary.value
  const userNotes = userChatNotes.value.slice(-2)
  if (!summary) return userNotes.length ? userNotes : ['等待生成后展示系统自动洞察']
  return [
    `发布完成 ${summary.schedule?.published || 0} 条，完成率 ${summary.derived?.publishCompletionRate || 0}%`,
    `城市端完成 ${summary.cityDistribution?.published || 0} 条，超期 ${summary.cityDistribution?.overdue || 0} 条`,
    `总播放 ${formatNumber(summary.performance?.playCount || 0)}，点赞 ${formatNumber(summary.performance?.likeCount || 0)}`,
    ...(userNotes.length ? [`人工补充：${userNotes[userNotes.length - 1]}`] : [])
  ]
})

const pendingItems = computed(() => {
  const summary = reportSummary.value
  if (!summary) return ['补充今日重点事项', '点击开始生成日报', '生成后复制给团队']
  const items = []
  if (summary.schedule?.pending) items.push(`跟进总部待发布 ${summary.schedule.pending} 条`)
  if (summary.cityDistribution?.pending) items.push(`提醒城市端待处理 ${summary.cityDistribution.pending} 条`)
  if (summary.cityDistribution?.overdue) items.push(`优先处理超期任务 ${summary.cityDistribution.overdue} 条`)
  if (!items.length) items.push('复盘高播放内容并沉淀选题')
  return items
})

const progressPoints = computed(() => {
  const rows = (detailData.value.dailyTrend || []).slice(-7)
  if (!rows.length) return Array.from({ length: 7 }, (_, index) => ({ date: index, label: `D${index + 1}`, height: 28 + index * 8 }))
  const max = Math.max(...rows.map(row => Number(row.publish_count || 0) + Number(row.city_published || 0)), 1)
  return rows.map(row => {
    const value = Number(row.publish_count || 0) + Number(row.city_published || 0)
    return {
      date: row.date,
      label: dayjs(row.date).format('MM-DD'),
      height: Math.max(12, Math.round(value / max * 100))
    }
  })
})

const userChatNotes = computed(() => messages.value.filter(item => item.role === 'user').map(item => item.content))

const buildUserContext = () => ({
  department: form.department,
  project: form.project,
  tone: form.tone,
  length: form.length,
  keywords: form.keywords,
  notes: '',
  chatNotes: userChatNotes.value,
  checkedItems: checklist.filter(item => item.checked).map(item => item.label)
})

const insertPrompt = (text) => {
  inputMessage.value = inputMessage.value ? `${inputMessage.value}\n${text}` : text
}

const sendMessage = () => {
  const content = inputMessage.value.trim()
  if (!content) return
  messages.value.push({
    id: `u-${Date.now()}`,
    role: 'user',
    content,
    time: dayjs().format('HH:mm')
  })
  inputMessage.value = ''
  messages.value.push({
    id: `a-${Date.now()}`,
    role: 'assistant',
    content: '收到，我会把这条补充内容放进本次日报里。继续补充也可以，准备好后点击“开始生成”。',
    time: dayjs().format('HH:mm')
  })
}

const parseRawData = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return null }
}

const selectReport = (item) => {
  activeId.value = item.id
  activeContent.value = item.content || ''
  activeRawData.value = parseRawData(item.raw_data)
  form.type = item.type || form.type
  if (item.period_start && item.period_end) range.value = [item.period_start, item.period_end]
}

const loadReports = async () => {
  try {
    const data = await getAIReports({ page: 1, pageSize: 12 })
    reports.value = data.list || []
    if (reports.value.length && !activeContent.value) selectReport(reports.value[0])
  } catch (error) {
    reports.value = []
    ElMessage.error(error?.message || '历史报告加载失败')
  }
}

const generateReport = async () => {
  generating.value = true
  generationStepIndex.value = 0
  activeId.value = ''
  activeContent.value = '# 正在生成日报\n\n系统正在整理数据与对话补充，请稍等。'
  clearInterval(generationTimer)
  generationTimer = setInterval(() => {
    if (generationStepIndex.value < generationSteps.length - 1) generationStepIndex.value += 1
  }, 1400)
  messages.value.push({
    id: `g-${Date.now()}`,
    role: 'assistant',
    content: '收到，我现在开始生成日报，请稍等。',
    time: dayjs().format('HH:mm')
  })
  try {
    const payload = {
      type: form.type,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      userContext: buildUserContext()
    }
    const data = await generateAIReport(payload)
    activeContent.value = data.content || ''
    activeRawData.value = parseRawData(data.raw_data)
    activeId.value = data.id || ''
    dailyUsed.value += 1
    reports.value = [data, ...reports.value.filter(item => item.id !== data.id)]
    messages.value.push({
      id: `done-${Date.now()}`,
      role: 'assistant',
      content: '日报已生成。右侧可以查看洞察，下方可以复制或导出 Word。',
      time: dayjs().format('HH:mm')
    })
    const fallbackReason = activeRawData.value?.meta?.aiFallbackReason
    ElMessage.success(fallbackReason ? `报告已生成：${fallbackReason}` : '报告已生成')
  } catch (error) {
    activeContent.value = ''
    ElMessage.error(error?.response?.data?.message || error?.message || '生成失败，请稍后重试')
  } finally {
    clearInterval(generationTimer)
    generationTimer = null
    generating.value = false
  }
}

const focusReportSection = (keyword) => {
  inputMessage.value = `请在日报中重点强化“${keyword}”部分，并保持简洁可执行。`
}

const escapeHtml = (value = '') => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]))

const renderInline = (value = '') => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')

const renderedContent = computed(() => (activeContent.value || '').split('\n').map(line => {
  const trimmed = line.trim()
  if (!trimmed) return '<div class="p-empty"></div>'
  const heading = trimmed.match(/^(#+)\s*(.*)$/)
  if (heading) {
    const level = heading[1].length
    const content = escapeHtml(heading[2])
    if (level === 1) return `<h1>${content}</h1>`
    if (level === 2) return `<h2>${content}</h2>`
    return `<h3>${content}</h3>`
  }
  if (/^[-•]\s+/.test(trimmed)) return `<li>${renderInline(trimmed.replace(/^[-•]\s+/, ''))}</li>`
  if (/^\d+\.\s+/.test(trimmed)) return `<li class="num">${renderInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>`
  return `<p>${renderInline(trimmed)}</p>`
}).join('\n'))

const copyReport = async () => {
  if (!activeContent.value) return
  try {
    await navigator.clipboard.writeText(activeContent.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动选择内容复制')
  }
}

const exportWord = () => {
  if (!activeContent.value) return
  const html = `
    <html><head><meta charset="utf-8"><title>${escapeHtml(parsedTitle.value)}</title></head>
    <body>${renderedContent.value}</body></html>
  `
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${parsedTitle.value || 'AI日报'}.doc`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

onMounted(loadReports)
</script>

<style scoped>
.ai-report-workbench {
  min-height: 100%;
  padding: 4px 0 24px;
}

.ai-hero,
.work-panel {
  border: 1px solid #e8ebf3;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
}

.ai-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f6bff, #8b5cf6);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 24px;
}

.hero-brand p,
.hero-brand h1 {
  margin: 0;
}

.hero-brand p {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.hero-brand h1 {
  margin-top: 4px;
  color: #111827;
  font-size: 22px;
  letter-spacing: 0;
}

.hero-actions,
.panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.work-panel {
  height: 100%;
  min-height: 420px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.config-panel,
.insight-panel,
.history-panel,
.preview-panel {
  overflow-y: auto;
}

.panel-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #eef1f7;
  margin-bottom: 16px;
}

.panel-title h2,
.panel-title p {
  margin: 0;
}

.panel-title h2 {
  color: #111827;
  font-size: 16px;
  font-weight: 800;
}

.panel-title p {
  margin-top: 5px;
  color: #8a93a6;
  font-size: 12.5px;
}

.panel-title > span,
.chat-head > span {
  color: #4f6bff;
  font-size: 12px;
  font-weight: 800;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}

.config-section label {
  color: #1f2937;
  font-size: 13px;
  font-weight: 800;
}

.quick-grid,
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.quick-btn,
.type-card,
.ghost-btn,
.primary-btn,
.send-btn,
.icon-btn {
  font-family: inherit;
  cursor: pointer;
  transition: all 0.16s ease;
}

.quick-btn,
.type-card {
  height: 36px;
  border: 1px solid #e5e8f0;
  border-radius: 9px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.quick-btn.active,
.type-card.active {
  border-color: #4f6bff;
  background: #eef2ff;
  color: #3154e7;
}

.type-card {
  height: 58px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.full-picker,
.full-control {
  width: 100%;
}

.slider-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}

.split-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.upload-box {
  min-height: 70px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  display: grid;
  place-items: center;
  gap: 2px;
}

.upload-box .el-icon {
  color: #4f6bff;
  font-size: 20px;
}

.upload-box small {
  color: #9ca3af;
}

.chat-panel {
  min-height: 680px;
}

.chat-body {
  flex: 1;
  min-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
}

.chat-message {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.chat-message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: #eef2ff;
  color: #4f6bff;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.chat-message.user .avatar {
  background: #f1f5f9;
  color: #334155;
}

.bubble {
  max-width: 78%;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f4f6fb;
  color: #334155;
  line-height: 1.6;
}

.chat-message.user .bubble {
  background: #eef4ff;
}

.bubble p,
.bubble time {
  margin: 0;
}

.bubble time {
  display: block;
  margin-top: 6px;
  color: #9ca3af;
  font-size: 11px;
  text-align: right;
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.steps span {
  padding: 4px 8px;
  border-radius: 999px;
  background: #fff;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
}

.steps span.done {
  background: #ecfdf5;
  color: #059669;
}

.steps span.active {
  background: #dbeafe;
  color: #2563eb;
}

.check-card {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #edf0f6;
  border-radius: 12px;
  background: #fbfcff;
  display: grid;
  gap: 8px;
}

.check-card strong {
  color: #111827;
  font-size: 13px;
}

.check-card label,
.pending label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 12.5px;
}

.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0;
}

.quick-actions button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid #e5e8f0;
  border-radius: 999px;
  background: #fff;
  color: #64748b;
}

.chat-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e5e8f0;
  border-radius: 14px;
  background: #fff;
}

.chat-input textarea {
  border: 0;
  outline: 0;
  resize: none;
  color: #334155;
  font-family: inherit;
  line-height: 1.6;
}

.send-btn {
  width: 52px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #4f6bff, #8b5cf6);
  color: #fff;
  font-size: 20px;
}

.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  padding: 14px;
  border: 1px solid #edf0f6;
  border-radius: 14px;
  background: #fbfcff;
  display: grid;
  gap: 6px;
}

.metric-card .el-icon {
  font-size: 20px;
}

.metric-card span,
.metric-card small {
  color: #8a93a6;
  font-size: 12px;
}

.metric-card strong {
  color: #111827;
  font-size: 24px;
}

.insight-block,
.donut-card,
.trend-card {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid #edf0f6;
  border-radius: 14px;
  background: #fff;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.block-head button {
  border: 0;
  background: transparent;
  color: #4f6bff;
  font-weight: 800;
  cursor: pointer;
}

.insight-block h3,
.donut-card h3,
.trend-card h3 {
  margin: 0 0 10px;
  color: #111827;
  font-size: 14px;
}

.star-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.star-list li {
  color: #475569;
  font-size: 12.5px;
  line-height: 1.5;
}

.star-list li::before {
  content: "★";
  color: #f59e0b;
  margin-right: 7px;
}

.insight-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 12px;
}

.donut {
  width: 118px;
  height: 118px;
  margin: 8px auto 12px;
  border: 18px solid #edf2f7;
  border-top-color: #4f6bff;
  border-right-color: #22c55e;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

.donut span {
  color: #111827;
  font-size: 22px;
  font-weight: 900;
}

.donut-card p {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 7px 0;
  color: #64748b;
  font-size: 12px;
}

.donut-card i {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  margin-right: auto;
}

.mini-chart {
  height: 150px;
  display: flex;
  align-items: flex-end;
  gap: 7px;
  padding-top: 20px;
  border-bottom: 1px solid #e5e8f0;
}

.mini-chart i {
  flex: 1;
  border-radius: 999px 999px 0 0;
  background: linear-gradient(180deg, #4f6bff, rgba(79, 107, 255, 0.08));
}

.axis-row {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-top: 8px;
  color: #94a3b8;
  font-size: 10px;
}

.pending {
  display: grid;
  gap: 9px;
}

.preview-panel {
  min-height: 600px;
}

.preview-head {
  align-items: center;
}

.status-pill {
  padding: 5px 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #059669;
  font-size: 12px;
  font-weight: 800;
}

.empty-state {
  flex: 1;
  min-height: 420px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  text-align: center;
  color: #8a93a6;
}

.empty-state .el-icon {
  width: 76px;
  height: 76px;
  border-radius: 22px;
  background: #eef2ff;
  color: #4f6bff;
  font-size: 34px;
}

.empty-state h3,
.empty-state p {
  margin: 0;
}

.report-preview {
  color: #334155;
}

.report-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.report-top h3,
.report-top p {
  margin: 0;
}

.report-top h3 {
  color: #111827;
  font-size: 20px;
}

.report-top p {
  margin-top: 5px;
  color: #8a93a6;
}

.report-top span {
  padding: 5px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3154e7;
  font-size: 12px;
  font-weight: 800;
}

.snapshot-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.snapshot-row div {
  padding: 12px;
  border: 1px solid #edf0f6;
  border-radius: 12px;
  background: #fbfcff;
}

.snapshot-row span,
.snapshot-row small {
  display: block;
  color: #8a93a6;
  font-size: 12px;
}

.snapshot-row strong {
  display: block;
  margin-top: 8px;
  color: #111827;
  font-size: 18px;
}

.report-body {
  line-height: 1.78;
  font-size: 14px;
}

.report-body :deep(h1) {
  margin: 18px 0 10px;
  color: #111827;
  font-size: 20px;
}

.report-body :deep(h2) {
  margin: 18px 0 10px;
  padding-left: 10px;
  border-left: 3px solid #4f6bff;
  color: #3154e7;
  font-size: 16px;
}

.report-body :deep(h3) {
  margin: 14px 0 8px;
  color: #111827;
  font-size: 14px;
}

.report-body :deep(p) {
  margin: 8px 0;
}

.report-body :deep(li) {
  list-style: none;
  position: relative;
  padding: 5px 0 5px 20px;
}

.report-body :deep(li)::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 15px;
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background: #4f6bff;
}

.report-body :deep(strong) {
  color: #111827;
  font-weight: 900;
}

.report-body :deep(code) {
  padding: 2px 6px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #3154e7;
}

.p-empty {
  height: 6px;
}

.history-list {
  display: grid;
  gap: 8px;
}

.history-item {
  width: 100%;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.history-item:hover,
.history-item.active {
  border-color: #c7d2fe;
  background: #f8faff;
}

.history-item > span {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #eef2ff;
  color: #4f6bff;
  display: grid;
  place-items: center;
}

.history-item strong,
.history-item small {
  display: block;
}

.history-item strong {
  color: #111827;
  font-size: 13px;
}

.history-item small {
  margin-top: 3px;
  color: #94a3b8;
  font-size: 11.5px;
}

.history-empty {
  padding: 40px 0;
  color: #94a3b8;
  text-align: center;
}

.ghost-btn,
.primary-btn {
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #e5e8f0;
  background: #fff;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
}

.ghost-btn.small {
  height: 34px;
  padding: 0 11px;
  font-size: 12px;
}

.primary-btn {
  border: 0;
  background: linear-gradient(135deg, #4f6bff, #8b5cf6);
  color: #fff;
  box-shadow: 0 8px 18px rgba(79, 107, 255, 0.24);
}

.ghost-btn:disabled,
.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border: 1px solid #e5e8f0;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
}

:deep(.el-date-editor.el-input__wrapper) {
  width: 100%;
}

@media (max-width: 1200px) {
  .snapshot-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metric-grid,
  .insight-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .ai-hero,
  .hero-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .split-row,
  .quick-grid,
  .type-grid,
  .snapshot-row {
    grid-template-columns: 1fr;
  }
}
</style>
