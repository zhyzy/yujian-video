<template>
  <div class="ai-page">
    <ConfigurablePageRenderer page-key="aiReports" :modules="aiReportsLayoutModules">
    <template #page-head>
    <div class="page-head">
      <div class="head-left">
        <div class="eyebrow">
          <span class="dot"></span>AI 智能总结 · 每日洞察
        </div>
        <h1 class="head-title">
          AI 日报
          <span class="head-sub">自动聚合素材、发布、城市与数据表现，一键生成可直接分享的运营报告。</span>
        </h1>
      </div>
      <div class="head-right">
        <button class="ghost-btn" @click="openManualDialog">
          <el-icon><EditPen /></el-icon>手动填写
        </button>
        <button class="ghost-btn" @click="loadReports">
          <el-icon><Refresh /></el-icon>刷新历史
        </button>
        <button class="primary-btn" :disabled="generating" @click="generateReport">
          <el-icon v-if="generating"><Loading /></el-icon>
          <el-icon v-else><MagicStick /></el-icon>
          <span>{{ generating ? '生成中...' : '生成报告' }}</span>
        </button>
      </div>
    </div>
    </template>

    <template #generate-panel>
        <div class="panel">
          <div class="panel-head compact">
            <div>
              <h3>报告设置</h3>
              <p>选择类型与周期，即刻生成</p>
            </div>
            <el-icon class="panel-icon"><Setting /></el-icon>
          </div>

          <div class="seg-wrap">
            <div class="seg-label">报告类型</div>
            <div class="seg-group">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                class="seg-item"
                :class="{ active: form.type === opt.value }"
                @click="changeType(opt.value)"
              >
                <el-icon class="seg-icon"><component :is="opt.icon" /></el-icon>
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <div class="range-wrap">
            <div class="seg-label">统计周期</div>
            <div class="field-inline form-field">
              <el-icon class="field-icon"><Calendar /></el-icon>
              <el-date-picker
                v-model="range"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                class="inline-picker"
                style="width: 100%"
              />
            </div>
          </div>

          <div class="quick-range">
            <button
              v-for="q in quickRanges"
              :key="q.label"
              class="mini-btn"
              :class="{ active: q.isActive() }"
              @click="q.apply()"
            >{{ q.label }}</button>
          </div>

          <div class="tip-box">
            <div class="tip-head">
              <el-icon class="tip-icon"><MagicStick /></el-icon>
              <strong>智能洞察</strong>
            </div>
            <p>AI 将分析周期内的素材录入量、排期执行、城市下发进度与数据表现，自动提炼关键指标、异常预警与下一步建议。</p>
          </div>
        </div>
    </template>

    <template #report-list>
        <div class="panel">
          <div class="panel-head compact">
            <div>
              <h3>历史报告</h3>
              <p>共 {{ reports.length }} 份历史记录</p>
            </div>
            <el-icon class="panel-icon"><Document /></el-icon>
          </div>

          <div v-if="!reports.length" class="empty-inline small">
            暂无历史报告 · 点击“生成报告”创建
          </div>

          <div v-else class="history-list">
            <button
              v-for="(item, i) in reports"
              :key="item.id || i"
              class="history-item"
              :class="{ active: activeId === item.id }"
              @click="selectReport(item)"
            >
              <div class="history-icon" :class="typeClass(item.type)">
                <el-icon><component :is="typeIcon(item.type)" /></el-icon>
              </div>
              <div class="history-body">
                <div class="history-title">{{ reportTypeLabel(item.type) }}</div>
                <div class="history-meta">
                  <el-icon><Calendar /></el-icon>
                  <span>{{ item.period_start }} 至 {{ item.period_end }}</span>
                </div>
              </div>
              <el-icon class="history-arrow"><ArrowRight /></el-icon>
            </button>
          </div>
        </div>
    </template>

    <template #report-content>
        <div class="panel report-panel">
          <div class="panel-head">
            <div>
              <h3>
                <span class="live-dot"></span>
                报告内容
              </h3>
              <p>{{ activeMeta || '点击左侧生成或选择一份报告' }}</p>
            </div>
            <div class="panel-actions">
              <button class="ghost-btn small" :disabled="!activeContent" @click="copyReport">
                <el-icon><CopyDocument /></el-icon>复制
              </button>
            </div>
          </div>

          <div v-if="generating" class="generation-box">
            <div class="generation-top">
              <span class="pulse-dot"></span>
              <strong>{{ generationTitle }}</strong>
            </div>
            <div class="generation-steps">
              <span
                v-for="(step, i) in generationSteps"
                :key="step"
                :class="{ done: i < generationStepIndex, active: i === generationStepIndex }"
              >{{ step }}</span>
            </div>
            <p>{{ generationHint }}</p>
          </div>

          <div v-if="!activeContent" class="report-empty">
            <div class="empty-art">
              <div class="ring"></div>
              <el-icon class="empty-icon"><MagicStick /></el-icon>
            </div>
            <h4>还没有报告</h4>
            <p>选择报告类型与周期，点击“生成报告”让 AI 为你总结本期运营表现。</p>
            <button class="primary-btn" :disabled="generating" @click="generateReport">
              <el-icon><MagicStick /></el-icon>
              <span>立即生成</span>
            </button>
          </div>

          <div v-else class="report-content">
            <div class="report-header">
              <div class="report-title-row">
                <h2>{{ parsedTitle }}</h2>
                <span class="report-tag">{{ reportTypeLabel(form.type) }}</span>
              </div>
              <div class="report-sub">
                <el-icon><Calendar /></el-icon>
                <span>{{ activeMeta }}</span>
              </div>
            </div>
            <div v-if="snapshotCards.length" class="ai-snapshot">
              <div
                v-for="card in snapshotCards"
                :key="card.label"
                class="snapshot-card"
                :class="'tone-' + card.tone"
              >
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
                <em v-if="card.sub">{{ card.sub }}</em>
              </div>
            </div>
            <div v-if="sourceBadges.length" class="source-row">
              <span class="source-title">数据来源</span>
              <span v-for="item in sourceBadges" :key="item.label" class="source-badge">
                {{ item.label }} · {{ item.count }}
              </span>
            </div>
            <div v-if="topPlatforms.length || topCities.length" class="insight-grid">
              <div v-if="topPlatforms.length" class="insight-mini">
                <h4>平台表现</h4>
                <p v-for="item in topPlatforms" :key="item.platform">
                  <span>{{ item.platform }}</span>
                  <b>{{ formatNumber(item.play_count) }}</b>
                </p>
              </div>
              <div v-if="topCities.length" class="insight-mini">
                <h4>城市填报</h4>
                <p v-for="item in topCities" :key="item.city_name">
                  <span>{{ item.city_name }}</span>
                  <b>{{ item.published_count || 0 }}/{{ item.task_count || 0 }}</b>
                </p>
              </div>
            </div>
            <div class="report-divider"></div>
            <div class="report-body" v-html="renderedContent"></div>
          </div>
        </div>
    </template>
    </ConfigurablePageRenderer>

    <el-dialog v-model="manualVisible" title="手动填写报告" width="720px" class="manual-dialog">
      <div class="manual-form">
        <div class="manual-types">
          <button
            v-for="opt in manualTypeOptions"
            :key="opt.value"
            class="manual-type"
            :class="{ active: manualForm.type === opt.value }"
            @click="changeManualType(opt.value)"
          >
            <el-icon><component :is="opt.icon" /></el-icon>
            <span>{{ opt.label }}</span>
          </button>
        </div>
        <div class="manual-field">
          <label>报告周期</label>
          <el-date-picker
            v-model="manualRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />
        </div>
        <div class="manual-field">
          <label>报告内容</label>
          <el-input
            v-model="manualForm.content"
            type="textarea"
            :rows="14"
            resize="vertical"
            placeholder="可以填写日报、周报、月报复盘，或本月计划。保存后会进入左侧历史报告，方便月底回顾。"
          />
        </div>
      </div>
      <template #footer>
        <button class="ghost-btn" @click="manualVisible = false">取消</button>
        <button class="primary-btn" :disabled="savingManual" @click="saveManualReport">
          <el-icon v-if="savingManual"><Loading /></el-icon>
          保存
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import {
  CopyDocument, MagicStick, Refresh, Calendar, Setting, Document,
  ArrowRight, Loading, DataAnalysis, Clock, Histogram, EditPen
} from '@element-plus/icons-vue'
import { generateAIReport, getAIReports, saveManualAIReport } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const route = useRoute()
const aiReportsLayoutModules = layoutModuleCatalog.aiReports
const { bindings: layoutBindings } = useLayoutBindings('aiReports')
const generating = ref(false)
const reports = ref([])
const activeContent = ref('')
const activeId = ref(null)
const activeRawData = ref(null)
const generationStepIndex = ref(0)
const generationHint = ref('')
const manualVisible = ref(false)
const savingManual = ref(false)
const manualRange = ref([])
const manualForm = reactive({ type: 'daily', content: '' })
let generationTimer = null

const today = dayjs().format('YYYY-MM-DD')
const routeDate = typeof route.query.date === 'string' ? route.query.date : ''
const routeType = typeof route.query.type === 'string' ? route.query.type : 'daily'

const defaultRangeByType = (type) => {
  if (routeDate) return [routeDate, routeDate]
  if (type === 'weekly') return [dayjs().subtract(6, 'day').format('YYYY-MM-DD'), today]
  if (type === 'monthly') return [dayjs().startOf('month').format('YYYY-MM-DD'), today]
  return [today, today]
}

const range = ref(defaultRangeByType(routeType))
const form = reactive({ type: routeType, periodStart: range.value[0], periodEnd: range.value[1] })

const typeOptions = [
  { label: '日报', value: 'daily', icon: Clock },
  { label: '周报', value: 'weekly', icon: Histogram },
  { label: '月报', value: 'monthly', icon: DataAnalysis }
]
const manualTypeOptions = [
  ...typeOptions,
  { label: '月计划', value: 'monthly_plan', icon: Document }
]

const generationSteps = ['聚合全站数据', '请求 AI 分析', '整理报告内容', '写入历史记录']
const generationTitle = computed(() => generationSteps[generationStepIndex.value] || '正在生成报告')

const quickRanges = [
  {
    label: '今日',
    apply: () => { range.value = [today, today] },
    isActive: () => range.value[0] === today && range.value[1] === today
  },
  {
    label: '昨日',
    apply: () => {
      const day = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      range.value = [day, day]
    },
    isActive: () => {
      const day = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      return range.value[0] === day && range.value[1] === day
    }
  },
  {
    label: '近 7 天',
    apply: () => { range.value = [dayjs().subtract(6, 'day').format('YYYY-MM-DD'), today] },
    isActive: () => range.value[0] === dayjs().subtract(6, 'day').format('YYYY-MM-DD') && range.value[1] === today
  },
  {
    label: '本月',
    apply: () => { range.value = [dayjs().startOf('month').format('YYYY-MM-DD'), today] },
    isActive: () => range.value[0] === dayjs().startOf('month').format('YYYY-MM-DD') && range.value[1] === today
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
  monthly_plan: '月计划',
  quarterly: '季度报告'
}[type] || '报告')

const typeClass = (type) => ({
  daily: 'type-daily',
  weekly: 'type-weekly',
  monthly: 'type-monthly',
  monthly_plan: 'type-plan'
}[type] || 'type-daily')

const typeIcon = (type) => ({
  daily: Clock,
  weekly: Histogram,
  monthly: DataAnalysis,
  monthly_plan: Document
}[type] || Document)

const activeMeta = computed(() => {
  if (!activeContent.value) return ''
  return `${form.periodStart} 至 ${form.periodEnd}`
})

const parsedTitle = computed(() => {
  const lines = (activeContent.value || '').split('\n')
  const titleLine = lines.find(line => line.trim().startsWith('#'))
  if (titleLine) return titleLine.replace(/^#+\s*/, '').trim()
  return `${reportTypeLabel(form.type)} · ${form.periodStart}`
})

const reportSummary = computed(() => activeRawData.value?.summary || null)
const detailData = computed(() => activeRawData.value?.details || {})
const snapshotCards = computed(() => {
  const summary = reportSummary.value
  if (!summary) return []
  return [
    { label: '拍摄素材', value: summary.production?.shootCount || 0, tone: 'indigo' },
    { label: '发布完成', value: summary.schedule?.published || 0, sub: `${summary.derived?.publishCompletionRate || 0}%`, tone: 'green' },
    { label: '城市完成', value: summary.cityDistribution?.published || 0, sub: `${summary.derived?.cityCompletionRate || 0}%`, tone: 'cyan' },
    { label: '总播放', value: formatNumber(summary.performance?.playCount || 0), tone: 'blue' },
    { label: '成交单数', value: summary.performance?.dealCount || 0, tone: 'orange' },
    { label: '成交金额', value: `¥${formatNumber(summary.performance?.dealAmount || 0)}`, tone: 'purple' }
  ]
})

const sourceBadges = computed(() => {
  const details = detailData.value
  if (!reportSummary.value) return []
  return [
    { label: '素材生产', count: reportSummary.value.production?.materialRecords || 0 },
    { label: '平台数据', count: details.platformStats?.length || 0 },
    { label: '城市数据', count: details.cityStats?.length || 0 },
    { label: '账号数据', count: details.accountStats?.length || 0 },
    { label: '趋势日期', count: details.dailyTrend?.length || 0 }
  ]
})

const topPlatforms = computed(() => (detailData.value.platformStats || []).slice(0, 4))
const topCities = computed(() => (detailData.value.cityStats || []).slice(0, 4))

const renderedContent = computed(() => {
  const lines = (activeContent.value || '').split('\n')
  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return '<div class="p-empty"></div>'

    const heading = trimmed.match(/^(#+)\s*(.*)$/)
    if (heading) {
      const level = heading[1].length
      const content = heading[2]
      if (level === 1) return `<h1>${escapeHtml(content)}</h1>`
      if (level === 2) return `<h2>${escapeHtml(content)}</h2>`
      return `<h3>${escapeHtml(content)}</h3>`
    }

    if (/^[-•]\s+/.test(trimmed)) {
      return `<li>${renderInline(trimmed.replace(/^[-•]\s+/, ''))}</li>`
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      return `<li class="num">${renderInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>`
    }

    return `<p>${renderInline(trimmed)}</p>`
  }).join('\n')
})

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function renderInline(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function parseRawData(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const selectReport = (item) => {
  activeId.value = item.id
  activeContent.value = item.content || ''
  activeRawData.value = parseRawData(item.raw_data)
  form.type = item.type || form.type
  if (item.period_start && item.period_end) {
    range.value = [item.period_start, item.period_end]
  }
}

const loadReports = async () => {
  try {
    const data = await getAIReports({ page: 1, pageSize: 10 })
    reports.value = data.list || []
    if (reports.value.length && !activeContent.value) {
      selectReport(reports.value[0])
    }
  } catch (error) {
    reports.value = []
    ElMessage.error(error?.message || '历史报告加载失败')
  }
}

const generateReport = async () => {
  generating.value = true
  activeId.value = null
  activeRawData.value = null
  generationStepIndex.value = 0
  generationHint.value = '正在读取素材、排期、城市下发、发布台账与数据总览。'
  const requestType = ['daily', 'weekly', 'monthly'].includes(form.type) ? form.type : 'daily'
  activeContent.value = `# ${reportTypeLabel(requestType)}生成中\n\n系统正在聚合全站数据，请稍等。`
  clearInterval(generationTimer)
  generationTimer = setInterval(() => {
    if (generationStepIndex.value < generationSteps.length - 1) {
      generationStepIndex.value += 1
      generationHint.value = [
        '已完成数据聚合，正在让 AI 生成分析结论。',
        '模型分析中，如果外部服务超时，系统会自动生成本地报告。',
        '正在整理正文、指标卡片与数据来源。',
        '即将保存到历史报告。'
      ][generationStepIndex.value] || generationHint.value
    }
  }, 1800)
  try {
    const data = await generateAIReport({ ...form, type: requestType })
    activeContent.value = data.content || ''
    activeRawData.value = parseRawData(data.raw_data)
    activeId.value = data.id || null
    generationStepIndex.value = generationSteps.length - 1
    const fallbackReason = activeRawData.value?.meta?.aiFallbackReason
    ElMessage.success(fallbackReason ? `报告已生成：${fallbackReason}` : '报告已生成')
    loadReports()
  } catch (error) {
    const isTimeout = error?.code === 'ECONNABORTED' || String(error?.message || '').includes('timeout')
    activeContent.value = ''
    ElMessage.error(isTimeout ? 'AI 生成时间较长，请稍后查看历史报告或重新生成' : (error?.response?.data?.message || error?.message || '生成失败，请稍后重试'))
  } finally {
    clearInterval(generationTimer)
    generationTimer = null
    generating.value = false
  }
}

const openManualDialog = () => {
  manualForm.type = ['daily', 'weekly', 'monthly', 'monthly_plan'].includes(form.type) ? form.type : 'daily'
  manualRange.value = [...range.value]
  manualForm.content = ''
  manualVisible.value = true
}

const changeManualType = (type) => {
  manualForm.type = type
  if (type === 'weekly') manualRange.value = [dayjs().subtract(6, 'day').format('YYYY-MM-DD'), today]
  else if (type === 'monthly' || type === 'monthly_plan') manualRange.value = [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().endOf('month').format('YYYY-MM-DD')]
  else manualRange.value = [today, today]
}

const saveManualReport = async () => {
  if (!manualForm.content.trim()) {
    ElMessage.warning('请先填写报告内容')
    return
  }
  savingManual.value = true
  try {
    const payload = {
      type: manualForm.type,
      periodStart: manualRange.value?.[0] || today,
      periodEnd: manualRange.value?.[1] || manualRange.value?.[0] || today,
      content: manualForm.content
    }
    const data = await saveManualAIReport(payload)
    manualVisible.value = false
    ElMessage.success('报告已保存')
    reports.value = [data, ...reports.value.filter(item => item.id !== data.id)]
    selectReport(data)
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存失败')
  } finally {
    savingManual.value = false
  }
}

const copyReport = async () => {
  try {
    await navigator.clipboard.writeText(activeContent.value || '')
    ElMessage.success('已复制到剪贴板')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = activeContent.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('已复制到剪贴板')
  }
}

onMounted(loadReports)
</script>

<style scoped>
.ai-page { padding: 6px 2px 30px; }

.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; letter-spacing: 0.02em; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }

.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.head-left { display: flex; flex-direction: column; gap: 8px; }
.head-title { font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: 0; line-height: 1.2; display: flex; flex-direction: column; gap: 6px; margin: 0; }
.head-sub { font-size: 13.5px; color: #6b7280; font-weight: 400; max-width: 620px; }
.head-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.primary-btn {
  height: 38px; padding: 0 16px; border-radius: 10px; border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
  font-size: 13.5px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.28); transition: all 0.18s;
  font-family: inherit;
}
.primary-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99,102,241,0.35); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ghost-btn {
  height: 38px; padding: 0 14px; border-radius: 10px;
  border: 1px solid #e5e7eb; background: #fff; color: #374151;
  font-size: 13px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s;
  font-family: inherit;
}
.ghost-btn.small { height: 34px; padding: 0 12px; font-size: 12.5px; border-radius: 9px; }
.ghost-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }

.field-inline {
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px; height: 40px; border-radius: 10px;
  background: #fff; border: 1px solid #ececf1;
}
.field-inline .field-icon { color: #6b7280; font-size: 14px; }
:deep(.inline-picker .el-input__wrapper) { box-shadow: none; padding: 0; background: transparent; }
:deep(.inline-picker .el-input__inner) { font-size: 13px; color: #111827; }

.panel {
  background: #fff; border: 1px solid #ececf1; border-radius: 14px;
  padding: 20px 22px;
}
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
.panel-head.compact { margin-bottom: 16px; }
.panel-head h3 { font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: 0; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
.panel-head p { font-size: 12.5px; color: #6b7280; margin: 0; }
.panel-icon { width: 34px; height: 34px; border-radius: 10px; background: #eef2ff; color: #6366f1; display: grid; place-items: center; font-size: 16px; flex-shrink: 0; }
.panel-actions { display: flex; align-items: center; gap: 8px; }

.main-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 14px;
  align-items: start;
}
.side-col { display: flex; flex-direction: column; gap: 14px; }

.seg-wrap { margin-bottom: 16px; }
.seg-label { font-size: 12px; color: #374151; font-weight: 500; margin-bottom: 8px; }

.seg-group {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: #f8fafc;
  padding: 6px;
  border-radius: 10px;
}
.seg-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 12px 8px; border: 0; background: transparent; border-radius: 8px;
  cursor: pointer; color: #6b7280; font-size: 12.5px; font-weight: 500;
  transition: all 0.15s;
  font-family: inherit;
}
.seg-icon { font-size: 16px; }
.seg-item:hover { color: #4338ca; background: #fff; }
.seg-item.active {
  background: #fff; color: #4338ca; font-weight: 600;
  box-shadow: 0 1px 3px rgba(15,23,42,0.08);
}

.range-wrap { margin-bottom: 12px; }
.form-field { width: 100%; box-sizing: border-box; height: 40px; }

.quick-range { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.mini-btn {
  height: 30px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff; color: #6b7280;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.mini-btn:hover { border-color: #6366f1; color: #6366f1; }
.mini-btn.active {
  background: #eef2ff; border-color: #6366f1; color: #4338ca; font-weight: 600;
}

.tip-box {
  background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  padding: 14px 16px;
}
.tip-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: #4338ca; font-size: 13px; }
.tip-icon { font-size: 15px; }
.tip-box p { margin: 0; font-size: 12.5px; color: #4b5563; line-height: 1.6; }

.empty-inline { padding: 30px 10px; text-align: center; color: #9ca3af; font-size: 12.5px; }
.empty-inline.small { padding: 22px 10px; font-size: 12px; }

.history-list { display: flex; flex-direction: column; gap: 6px; }
.history-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 10px;
  border: 1px solid transparent; background: transparent;
  cursor: pointer; transition: all 0.15s; text-align: left;
  font-family: inherit;
}
.history-item:hover { background: #f8fafc; border-color: #ececf1; }
.history-item.active {
  background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
  border-color: #c7d2fe;
}

.history-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: #eef2ff; color: #6366f1;
  display: grid; place-items: center; font-size: 16px;
  flex-shrink: 0;
}
.history-icon.type-weekly { background: #fff7ed; color: #ea580c; }
.history-icon.type-monthly { background: #ecfdf5; color: #059669; }
.history-icon.type-plan { background: #fdf2f8; color: #db2777; }

.history-body { flex: 1; min-width: 0; }
.history-title { font-size: 13px; color: #0f172a; font-weight: 600; margin-bottom: 3px; }
.history-meta { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #9ca3af; }
.history-meta .el-icon { font-size: 11px; }

.history-arrow { color: #c7d2fe; font-size: 14px; flex-shrink: 0; transition: all 0.15s; }
.history-item.active .history-arrow { color: #6366f1; }
.history-item:hover .history-arrow { color: #6366f1; }

.report-panel { min-height: 620px; display: flex; flex-direction: column; }
.live-dot { width: 8px; height: 8px; border-radius: 999px; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,0.15); display: inline-block; }

.generation-box {
  margin: -4px 0 18px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #c7d2fe;
  background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
}
.generation-top { display: flex; align-items: center; gap: 9px; color: #3730a3; font-size: 13px; }
.pulse-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #6366f1;
  box-shadow: 0 0 0 0 rgba(99,102,241,0.38);
  animation: pulse 1.3s infinite;
}
@keyframes pulse {
  70% { box-shadow: 0 0 0 9px rgba(99,102,241,0); }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
}
.generation-steps { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.generation-steps span {
  height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 999px;
  background: #fff;
  color: #94a3b8;
  font-size: 11.5px;
  font-weight: 700;
}
.generation-steps span.done { color: #059669; background: #ecfdf5; }
.generation-steps span.active { color: #4338ca; background: #e0e7ff; }
.generation-box p { margin: 10px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.6; }

.report-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 50px 20px; text-align: center;
}
.empty-art {
  width: 90px; height: 90px; border-radius: 24px;
  background: linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%);
  display: grid; place-items: center; position: relative; margin-bottom: 8px;
}
.empty-art .ring {
  position: absolute; inset: -10px; border-radius: 28px;
  border: 2px dashed #c7d2fe; opacity: 0.6;
  animation: spin 18s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.empty-icon { font-size: 36px; color: #6366f1; }

.report-empty h4 { margin: 0; font-size: 17px; color: #0f172a; font-weight: 700; }
.report-empty p { margin: 0 0 8px; font-size: 13px; color: #6b7280; max-width: 400px; line-height: 1.6; }

.report-content { padding: 8px 4px 4px; }
.report-header { margin-bottom: 16px; padding: 0 4px; }
.report-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.report-title-row h2 {
  margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;
  letter-spacing: 0;
}
.report-tag {
  display: inline-block; padding: 4px 10px; border-radius: 99px;
  font-size: 11.5px; font-weight: 600;
  background: #eef2ff; color: #4338ca;
}
.report-sub {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: #6b7280;
}
.report-sub .el-icon { font-size: 12px; }

.ai-snapshot {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.snapshot-card {
  min-height: 86px;
  padding: 13px 12px;
  border-radius: 12px;
  border: 1px solid #edf2f7;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.snapshot-card span { font-size: 12px; color: #64748b; font-weight: 600; }
.snapshot-card strong { font-size: 21px; color: #0f172a; letter-spacing: 0; line-height: 1.2; }
.snapshot-card em { font-style: normal; font-size: 11px; font-weight: 700; color: #059669; }
.snapshot-card.tone-indigo { background: #eef2ff; border-color: #dbe4ff; }
.snapshot-card.tone-green { background: #ecfdf5; border-color: #bbf7d0; }
.snapshot-card.tone-cyan { background: #ecfeff; border-color: #a5f3fc; }
.snapshot-card.tone-blue { background: #eff6ff; border-color: #bfdbfe; }
.snapshot-card.tone-orange { background: #fff7ed; border-color: #fed7aa; }
.snapshot-card.tone-purple { background: #f5f3ff; border-color: #ddd6fe; }

.source-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.source-title { font-size: 12px; color: #94a3b8; font-weight: 700; }
.source-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11.5px;
  font-weight: 600;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.insight-mini {
  border: 1px solid #edf2f7;
  border-radius: 12px;
  padding: 12px;
  background: #fff;
}
.insight-mini h4 { margin: 0 0 8px; font-size: 12.5px; color: #334155; }
.insight-mini p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 12.5px;
  color: #64748b;
  border-top: 1px solid #f1f5f9;
}
.insight-mini p:first-of-type { border-top: 0; }
.insight-mini b { color: #4338ca; font-weight: 800; }

.report-divider {
  height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
  margin: 10px 0 20px;
}

.report-body {
  line-height: 1.75; color: #1f2937; font-size: 14px;
}
.report-body :deep(h1) { font-size: 18px; font-weight: 700; color: #0f172a; margin: 18px 0 10px; letter-spacing: 0; }
.report-body :deep(h2) { font-size: 15.5px; font-weight: 700; color: #4338ca; margin: 18px 0 8px; padding-left: 10px; border-left: 3px solid #6366f1; }
.report-body :deep(h3) { font-size: 14px; font-weight: 600; color: #374151; margin: 14px 0 6px; }
.report-body :deep(p) { margin: 8px 0; }
.report-body :deep(strong) { color: #0f172a; font-weight: 700; background: linear-gradient(180deg, transparent 60%, rgba(99,102,241,0.15) 60%); padding: 0 2px; }
.report-body :deep(code) { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12.5px; font-family: 'SF Mono', ui-monospace, monospace; color: #4338ca; }
.report-body :deep(li) {
  list-style: none; padding: 6px 0 6px 24px; position: relative;
}
.report-body :deep(li)::before {
  content: ''; position: absolute; left: 6px; top: 14px;
  width: 6px; height: 6px; border-radius: 99px;
  background: #c7d2fe;
}
.report-body :deep(li.num)::before {
  content: none;
}
.report-body :deep(li.num) {
  padding-left: 26px;
}
.report-body :deep(li.num)::after {
  content: '';
  position: absolute; left: 0; top: 6px;
  width: 20px; height: 20px; border-radius: 6px;
  background: #eef2ff; color: #4338ca;
  font-size: 11px; font-weight: 700;
  display: grid; place-items: center;
}
.report-body :deep(.p-empty) { height: 6px; }

.manual-form { display: flex; flex-direction: column; gap: 16px; }
.manual-types {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.manual-type {
  height: 56px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.16s;
  font-family: inherit;
}
.manual-type:hover { border-color: #c7d2fe; color: #4338ca; background: #f8fafc; }
.manual-type.active { border-color: #6366f1; color: #4338ca; background: #eef2ff; box-shadow: 0 6px 14px rgba(99,102,241,0.12); }
.manual-field { display: flex; flex-direction: column; gap: 8px; }
.manual-field label { font-size: 13px; color: #334155; font-weight: 700; }
:deep(.manual-dialog .el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1000px) {
  .main-grid { grid-template-columns: 1fr; }
  .report-panel { min-height: 480px; }
  .ai-snapshot { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .page-head { flex-direction: column; align-items: flex-start; }
  .ai-snapshot { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .insight-grid { grid-template-columns: 1fr; }
  .manual-types { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
