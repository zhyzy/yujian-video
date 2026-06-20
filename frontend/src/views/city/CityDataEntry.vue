<template>
  <div class="data-entry-page">
    <ConfigurablePageRenderer page-key="cityDataEntry" :modules="cityDataEntryLayoutModules">
      <template #page-head>
        <header class="hero">
          <div>
            <div class="eyebrow"><IconFont name="data" :fallback="DataAnalysis" /> 城市端 · 数据回填</div>
            <h1>数据录入</h1>
            <p>维护已发布内容的数据表现，支持按时间区间批量录入数据</p>
          </div>
          <div class="hero-actions">
            <el-button @click="loadData"><IconFont name="reset" :fallback="Refresh" />刷新</el-button>
            <el-button type="primary" @click="openDataForm"><IconFont name="add" :fallback="Plus" />填写数据</el-button>
          </div>
        </header>
      </template>

      <template #filter-panel>
        <section class="filter-section">
          <div class="filter-row">
            <div class="filter-item">
              <span class="filter-label">平台</span>
              <el-select v-model="filterPlatform" placeholder="全部平台" clearable style="width: 140px">
                <el-option label="全部平台" value="" />
                <el-option label="抖音" value="douyin" />
                <el-option label="快手" value="kuaishou" />
                <el-option label="视频号" value="weixin" />
                <el-option label="小红书" value="xiaohongshu" />
              </el-select>
            </div>
            <div class="filter-item">
              <span class="filter-label">账号</span>
              <el-select v-model="filterAccount" placeholder="全部账号" clearable style="width: 180px">
                <el-option label="全部账号" value="" />
                <el-option v-for="account in cityAccounts" :key="account.id" :label="account.name" :value="account.id" />
              </el-select>
            </div>
            <div class="filter-item">
              <span class="filter-label">时间</span>
              <el-date-picker
                v-model="filterDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 260px"
              />
            </div>
            <el-button @click="clearFilters">清除筛选</el-button>
            <el-tag v-if="!showHistory" class="mode-tag" effect="plain">只显示最新数据</el-tag>
            <el-tag v-else class="mode-tag" type="primary">显示全部历史数据</el-tag>
            <el-switch v-model="showHistory" active-text="查看历史" inactive-text="只看最新" inline-prompt style="margin-left: auto" />
          </div>
        </section>
      </template>

      <template #record-list>
        <section class="record-list" v-loading="loading">
          <article v-for="row in filteredRecords" :key="row.id" class="record-card">
            <div class="record-header">
              <div class="record-left">
                <div class="record-platform-box">
                  <IconFont :platform="row.publish_platform || row.platform || 'douyin'" class="platform-icon" />
                  <span class="platform-text">{{ platformLabel(row.publish_platform || row.platform) }}</span>
                </div>
                <div class="record-account-row">
                  <span class="record-account-name">{{ row.account_name || row.publish_account_name || '未知账号' }}</span>
                </div>
              </div>
              <div class="record-right">
                <span class="record-date-label">{{ row.date }}</span>
                <span v-if="row.city_remark" class="record-remark">{{ row.city_remark }}</span>
              </div>
            </div>

            <div class="record-metrics">
              <div class="metric-row">
                <div class="metric-box primary">
                  <span class="metric-value">{{ formatNum(row.play_count) }}</span>
                  <span class="metric-label">播放量</span>
                </div>
                <div class="metric-box">
                  <span class="metric-value">{{ formatNum(row.like_count) }}</span>
                  <span class="metric-label">点赞</span>
                </div>
                <div class="metric-box">
                  <span class="metric-value">{{ formatNum(row.comment_count) }}</span>
                  <span class="metric-label">评论</span>
                </div>
              </div>
              <div class="metric-row">
                <div class="metric-box">
                  <span class="metric-value">{{ formatNum(row.deal_count) }}</span>
                  <span class="metric-label">成交</span>
                </div>
                <div class="metric-box money wide">
                  <span class="metric-value">¥{{ row.deal_amount || 0 }}</span>
                  <span class="metric-label">金额</span>
                </div>
              </div>
            </div>

            <div class="record-footer">
              <div class="record-actions">
                <el-button class="btn-edit" size="small" @click="openEditData(row)">
                  <el-icon><EditPen /></el-icon>
                  <span>编辑数据</span>
                </el-button>
                <el-button class="btn-delete" size="small" @click="handleDelete(row)">
                  <el-icon><Delete /></el-icon>
                  <span>删除</span>
                </el-button>
              </div>
            </div>
          </article>
          <div v-if="!loading && !filteredRecords.length" class="empty-state">
            <span class="empty-icon">📭</span>
            <p>{{ hasAnyFilter ? '筛选条件下暂无数据记录' : (showHistory ? '暂无数据记录' : '暂无最新数据，可开启"查看历史"或筛选查看更早数据') }}</p>
            <el-button type="primary" @click="openDataForm">立即填写数据</el-button>
          </div>
        </section>
      </template>
    </ConfigurablePageRenderer>

    <!-- 数据录入对话框 -->
    <el-dialog
      v-model="dataDialogVisible"
      :title="isEditing ? '编辑数据' : '区间汇总录入'"
      width="680px"
      :close-on-click-modal="false"
    >
      <div class="data-form">
        <!-- 快捷区间 -->
        <div v-if="!isEditing" class="quick-range">
          <span class="quick-label">快捷选择：</span>
          <button
            v-for="q in quickRanges"
            :key="q.label"
            class="quick-btn"
            :class="{ active: isQuickRangeActive(q) }"
            @click.stop="applyQuickRange(q)"
          >
            {{ q.label }}
          </button>
        </div>

        <!-- 基本信息组 -->
        <div class="form-section">
          <div class="form-section-title">基本信息</div>
          <div class="form-item">
            <label>发布平台</label>
            <el-select v-model="dataForm.platform" placeholder="请选择平台" style="width: 100%">
              <el-option label="抖音" value="douyin" />
              <el-option label="快手" value="kuaishou" />
              <el-option label="视频号" value="weixin" />
              <el-option label="小红书" value="xiaohongshu" />
            </el-select>
          </div>
          <div class="form-item">
            <label>发布账号</label>
            <el-select v-model="dataForm.account_id" placeholder="请选择发布账号" filterable style="width: 100%">
              <el-option v-for="account in cityAccounts" :key="account.id" :label="`${platformLabel(account.platform)} · ${account.name}`" :value="account.id" />
            </el-select>
          </div>
          <div class="form-item">
            <label>{{ isEditing ? '日期' : '时间区间' }}</label>
            <el-date-picker
              v-if="isEditing"
              v-model="dataForm.date"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 100%"
            />
            <el-date-picker
              v-else
              v-model="dataForm.dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="width: 100%"
            />
          </div>
          <div v-if="!isEditing && dataForm.dateRange && dataForm.dateRange.length === 2" class="range-summary">
            <el-icon><InfoFilled /></el-icon>
            <span>已选择 {{ dataForm.dateRange[0] }} 至 {{ dataForm.dateRange[1] }}，共 {{ dateRangeDays }} 天</span>
          </div>
        </div>

        <!-- 数据指标组 -->
        <div class="form-section">
          <div class="form-section-title">数据指标</div>
          <div class="data-grid">
            <div class="form-item">
              <label>播放量</label>
              <el-input-number v-model="dataForm.play_count" :min="0" style="width: 100%" :placeholder="isEditing ? '播放量' : '区间总播放量'" />
            </div>
            <div class="form-item">
              <label>点赞</label>
              <el-input-number v-model="dataForm.like_count" :min="0" style="width: 100%" :placeholder="isEditing ? '点赞数' : '区间总点赞'" />
            </div>
            <div class="form-item">
              <label>评论</label>
              <el-input-number v-model="dataForm.comment_count" :min="0" style="width: 100%" :placeholder="isEditing ? '评论数' : '区间总评论'" />
            </div>
            <div class="form-item">
              <label>收藏</label>
              <el-input-number v-model="dataForm.favorite_count" :min="0" style="width: 100%" :placeholder="isEditing ? '收藏数' : '区间总收藏'" />
            </div>
            <div class="form-item">
              <label>转发</label>
              <el-input-number v-model="dataForm.share_count" :min="0" style="width: 100%" :placeholder="isEditing ? '转发数' : '区间总转发'" />
            </div>
            <div class="form-item">
              <label>成交单数</label>
              <el-input-number v-model="dataForm.deal_count" :min="0" style="width: 100%" :placeholder="isEditing ? '成交单数' : '区间总成交'" />
            </div>
            <div class="form-item full">
              <label>成交金额</label>
              <el-input-number v-model="dataForm.deal_amount" :min="0" :precision="2" style="width: 100%" :placeholder="isEditing ? '成交金额' : '区间总金额'" />
            </div>
          </div>
          <div v-if="!isEditing && dataForm.dateRange && dataForm.dateRange.length === 2 && (dataForm.play_count || dataForm.like_count)" class="avg-hint">
            <span>区间均值：日均播放 {{ formatNum(avgViews) }}，日均点赞 {{ formatNum(avgLikes) }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button class="dialog-btn-cancel" @click="dataDialogVisible = false">取消</el-button>
        <el-button class="dialog-btn-submit" :loading="saving" @click="submitData">
          {{ saving ? '保存中…' : (isEditing ? '保存修改' : '批量提交') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataAnalysis, Refresh, Plus, InfoFilled, EditPen, Delete } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { getCityDistributions, updateCityDistribution, createCityDistribution, deleteCityDistribution, getAccounts } from '@/api'
import dayjs from 'dayjs'

const cityDataEntryLayoutModules = layoutModuleCatalog.cityDataEntry
const { bindings: layoutBindings } = useLayoutBindings('cityDataEntry')
const loading = ref(false)
const saving = ref(false)
const dataDialogVisible = ref(false)
const isEditing = ref(false)
const currentData = ref(null)

// 当前城市用户的信息
let userData = {}
try { userData = JSON.parse(localStorage.getItem('auth_user') || '{}') } catch {}
const currentUser = ref(userData)

// 城市账号列表
const cityAccounts = ref([])

// 筛选条件
const filterPlatform = ref('')
const filterAccount = ref('')
const filterDateRange = ref(null)

// 所有记录
const allRecords = ref([])

// 数据表单
const dataForm = reactive({
  platform: 'douyin',
  account_id: '',
  date: dayjs().format('YYYY-MM-DD'),
  dateRange: null,
  play_count: 0,
  like_count: 0,
  comment_count: 0,
  favorite_count: 0,
  share_count: 0,
  deal_count: 0,
  deal_amount: 0
})

// 快捷区间
const quickRanges = [
  { label: '本周', start: () => dayjs().startOf('week').format('YYYY-MM-DD'), end: () => dayjs().endOf('week').format('YYYY-MM-DD') },
  { label: '上周', start: () => dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'), end: () => dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD') },
  { label: '本月', start: () => dayjs().startOf('month').format('YYYY-MM-DD'), end: () => dayjs().endOf('month').format('YYYY-MM-DD') },
  { label: '上月', start: () => dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), end: () => dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD') },
  { label: '本季度', start: () => dayjs().startOf('quarter').format('YYYY-MM-DD'), end: () => dayjs().endOf('quarter').format('YYYY-MM-DD') }
]

const platformLabel = (p) => ({ douyin: '抖音', kuaishou: '快手', weixin: '视频号', xiaohongshu: '小红书' }[p] || (p || '-'))

const formatNum = (n) => {
  const v = Number(n || 0)
  if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + ' 万'
  if (v >= 1000) return v.toLocaleString('zh-CN')
  return Math.round(v).toString()
}

// 筛选后的记录
const showHistory = ref(false)

const hasAnyFilter = computed(() => {
  return !!filterPlatform.value || !!filterAccount.value || (!!filterDateRange.value && filterDateRange.value.length === 2)
})

const filteredRecords = computed(() => {
  // 第一步：过滤掉全 0 数据的占位记录
  let list = allRecords.value.filter(t =>
    (t.play_count > 0 || t.like_count > 0 || t.comment_count > 0 || t.deal_count > 0 || (t.deal_amount && t.deal_amount > 0) || t.favorite_count > 0 || t.share_count > 0)
  )

  // 第二步：平台筛选
  if (filterPlatform.value) {
    list = list.filter(t => t.publish_platform === filterPlatform.value || t.platform === filterPlatform.value)
  }

  // 第三步：账号筛选
  if (filterAccount.value) {
    list = list.filter(t => t.account_id === filterAccount.value)
  }

  // 第四步：日期筛选
  if (filterDateRange.value && filterDateRange.value.length === 2) {
    const [start, end] = filterDateRange.value
    list = list.filter(t => t.date >= start && t.date <= end)
  }

  // 按日期倒序
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  // 默认视图：每个账号只显示最新一条
  // 当用户筛选或开启"查看历史"时显示全部
  if (showHistory.value || hasAnyFilter.value) {
    return list
  }

  // 只保留每个账号 + 平台组合的最新一条
  const seen = new Map()
  for (const record of list) {
    const key = `${record.account_id || (record.account_name || record.publish_account_name || 'unknown')}-${record.publish_platform || record.platform || ''}`
    if (!seen.has(key)) {
      seen.set(key, record)
    }
  }
  return Array.from(seen.values())
})

// 日期区间天数
const dateRangeDays = computed(() => {
  if (!dataForm.dateRange || dataForm.dateRange.length !== 2) return 0
  return dayjs(dataForm.dateRange[1]).diff(dayjs(dataForm.dateRange[0]), 'day') + 1
})

// 区间均值
const avgViews = computed(() => {
  if (!dateRangeDays.value) return 0
  return Math.round(dataForm.play_count / dateRangeDays.value)
})
const avgLikes = computed(() => {
  if (!dateRangeDays.value) return 0
  return Math.round(dataForm.like_count / dateRangeDays.value)
})

// 判断快捷区间是否选中
const isQuickRangeActive = (q) => {
  if (!dataForm.dateRange || dataForm.dateRange.length !== 2) return false
  return dataForm.dateRange[0] === q.start() && dataForm.dateRange[1] === q.end()
}

// 应用快捷区间
const applyQuickRange = (q) => {
  dataForm.dateRange = [q.start(), q.end()]
}

// 清除筛选
const clearFilters = () => {
  filterPlatform.value = ''
  filterAccount.value = ''
  filterDateRange.value = null
}

const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}

const applyLayoutBindings = (bindings = {}) => {
  if ('platform' in bindings) {
    filterPlatform.value = bindings.platform === '全部' ? '' : (bindings.platform || '')
    dataForm.platform = filterPlatform.value || dataForm.platform
  }
  if ('accountId' in bindings || 'account_id' in bindings) {
    filterAccount.value = bindings.accountId || bindings.account_id || ''
    dataForm.account_id = filterAccount.value || dataForm.account_id
  }
  const from = normalizeBoundDate(bindings.dateFrom || bindings.startDate)
  const to = normalizeBoundDate(bindings.dateTo || bindings.endDate)
  if (from || to) filterDateRange.value = [from || to, to || from]
  if ('showHistory' in bindings) showHistory.value = Boolean(bindings.showHistory)
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const [distData, accountData] = await Promise.all([
      getCityDistributions({ pageSize: 500 }),
      getAccounts({ type: 'city', cityId: currentUser.value.city_id })
    ])
    allRecords.value = distData.list || []
    cityAccounts.value = Array.isArray(accountData) ? accountData : (accountData?.list || [])
  } catch (e) {
    allRecords.value = []
    cityAccounts.value = []
  } finally {
    loading.value = false
  }
}

// 重置表单
const resetDataForm = () => {
  Object.assign(dataForm, {
    platform: 'douyin',
    account_id: '',
    date: dayjs().format('YYYY-MM-DD'),
    dateRange: null,
    play_count: 0,
    like_count: 0,
    comment_count: 0,
    favorite_count: 0,
    share_count: 0,
    deal_count: 0,
    deal_amount: 0
  })
}

// 打开数据录入表单
const openDataForm = () => {
  isEditing.value = false
  resetDataForm()
  dataDialogVisible.value = true
}

// 打开编辑数据表单
const openEditData = (row) => {
  isEditing.value = true
  currentData.value = row
  const acc = cityAccounts.value.find(a => a.id === row.account_id) || cityAccounts.value.find(a => a.name === (row.account_name || row.publish_account_name))
  Object.assign(dataForm, {
    platform: row.publish_platform || row.platform || 'douyin',
    account_id: acc?.id || '',
    date: row.date || dayjs().format('YYYY-MM-DD'),
    play_count: row.play_count || 0,
    like_count: row.like_count || 0,
    comment_count: row.comment_count || 0,
    favorite_count: row.favorite_count || 0,
    share_count: row.share_count || 0,
    deal_count: row.deal_count || 0,
    deal_amount: row.deal_amount || 0,
    dateRange: null
  })
  dataDialogVisible.value = true
}

// 提交数据
const submitData = async () => {
  if (!dataForm.platform) {
    return ElMessage.warning('请选择平台')
  }
  if (!dataForm.account_id) {
    return ElMessage.warning('请选择发布账号')
  }
  const selectedAccount = cityAccounts.value.find(a => a.id === dataForm.account_id)
  const accountName = selectedAccount?.name || ''

  if (isEditing.value) {
    saving.value = true
    try {
      await updateCityDistribution(currentData.value.id, {
        ...dataForm,
        account_id: dataForm.account_id,
        publish_platform: dataForm.platform,
        publish_account_name: accountName,
        date: dataForm.date
      })
      ElMessage.success('数据已更新')
      dataDialogVisible.value = false
      loadData()
    } catch (e) {
      ElMessage.error('保存失败：' + e.message)
    } finally {
      saving.value = false
    }
    return
  }

  if (!dataForm.dateRange || dataForm.dateRange.length !== 2) {
    return ElMessage.warning('请选择时间区间')
  }
  if (!dataForm.play_count && !dataForm.like_count && !dataForm.deal_count && !dataForm.deal_amount) {
    return ElMessage.warning('请填写至少一项数据')
  }

  saving.value = true
  try {
    const [startDate, endDate] = dataForm.dateRange
    await createCityDistribution({
      account_id: dataForm.account_id,
      publish_platform: dataForm.platform,
      publish_account_name: accountName,
      date: startDate,
      play_count: dataForm.play_count,
      like_count: dataForm.like_count,
      comment_count: dataForm.comment_count,
      favorite_count: dataForm.favorite_count,
      share_count: dataForm.share_count,
      deal_count: dataForm.deal_count,
      deal_amount: dataForm.deal_amount,
      status: 'published',
      city_remark: `区间汇总 ${startDate} 至 ${endDate}`
    })

    ElMessage.success('区间数据已成功录入')
    dataDialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

// 删除数据
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除这条数据吗？`, '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteCityDistribution(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
.data-entry-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Hero */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  padding: 22px 24px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 16px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
}

.hero h1 {
  margin: 0 0 6px;
  font-size: 24px;
  color: #0f172a;
}

.hero p {
  margin: 0;
  color: #7b8497;
  font-size: 13px;
}

.hero-actions {
  display: flex;
  gap: 10px;
}

/* 筛选区域 */
.filter-section {
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 16px;
  padding: 18px 20px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.mode-tag {
  margin-left: 8px;
}

/* 数据列表 */
.record-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

/* 数据卡片 */
.record-card {
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.2s ease;
}

.record-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.08);
}

/* 头部 */
.record-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.record-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 平台框 */
.record-platform-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  border-radius: 8px;
  width: fit-content;
}

.platform-icon {
  font-size: 14px;
}

.platform-text {
  font-size: 12px;
  color: #4f46e5;
  font-weight: 600;
}

/* 账号行 */
.record-account-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-account-name {
  font-size: 15px;
  color: #0f172a;
  font-weight: 600;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.record-date-label {
  font-size: 13px;
  color: #475569;
  font-weight: 600;
}

.record-remark {
  font-size: 11px;
  color: #64748b;
  background: #f8fafc;
  padding: 3px 8px;
  border-radius: 6px;
}

/* 指标 */
.record-metrics {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.metric-row:last-child {
  grid-template-columns: 1fr 2fr;
}

.metric-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 6px;
  background: #f8fafc;
  border-radius: 8px;
}

.metric-box.primary {
  background: linear-gradient(135deg, #eef2ff, #f5f3ff);
}

.metric-box.money {
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
}

.metric-value {
  font-size: 18px;
  color: #0f172a;
  font-weight: 700;
}

.metric-box.primary .metric-value {
  color: #4f46e5;
}

.metric-box.money .metric-value {
  color: #059669;
}

.metric-label {
  font-size: 11px;
  color: #64748b;
}

/* 底部 */
.record-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}

.record-actions {
  display: flex;
  gap: 6px;
}

.btn-edit, .btn-delete {
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
}

.btn-edit {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
}
.btn-edit:hover {
  background: linear-gradient(135deg, #fde68a, #fcd34d);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(234, 179, 8, 0.25);
}

.btn-delete {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #b91c1c;
}
.btn-delete:hover {
  background: linear-gradient(135deg, #fecaca, #fca5a5);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 16px;
}

.empty-icon {
  font-size: 48px;
}

.empty-state p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

/* 对话框表单 */
.data-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 表单分组卡片 */
.form-section {
  background: linear-gradient(135deg, #fafbff, #f0fdfa);
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #4f46e5;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e7ff;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section-title::before {
  content: '';
  width: 4px;
  height: 14px;
  background: linear-gradient(180deg, #6366f1, #8b5cf6);
  border-radius: 3px;
}

.quick-range {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc, #f0fdfa);
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.quick-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
}

.quick-btn {
  padding: 6px 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-btn:hover {
  border-color: #c7d2fe;
  color: #4f46e5;
  transform: translateY(-1px);
}

.quick-btn.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-color: #6366f1;
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-item label {
  font-size: 13px;
  color: #334155;
  font-weight: 600;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.form-item.full {
  grid-column: span 3;
}

.range-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #ecfdf5, #dcfce7);
  color: #047857;
  border-radius: 12px;
  font-size: 13px;
  border: 1px solid #bbf7d0;
}

.avg-hint {
  padding: 12px 16px;
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
  color: #c2410c;
  border-radius: 12px;
  font-size: 12px;
  border: 1px solid #fed7aa;
}

/* ===== 美化 Element Plus 原生控件 ===== */

/* el-select / el-date-picker - 统一输入框外观 */
.data-form :deep(.el-input__wrapper),
.data-form :deep(.el-textarea__inner),
.data-form :deep(.el-select .el-input__wrapper),
.data-form :deep(.el-date-editor.el-input),
.data-form :deep(.el-date-editor.el-input__wrapper) {
  border-radius: 10px;
  padding: 2px 12px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  background: #ffffff;
  transition: all 0.2s ease;
  min-height: 40px;
}

.data-form :deep(.el-input__wrapper:hover),
.data-form :deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c7d2fe inset;
}

.data-form :deep(.el-input__wrapper.is-focus),
.data-form :deep(.el-select .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #c7d2fe inset, 0 2px 8px rgba(99, 102, 241, 0.12);
}

.data-form :deep(.el-input__inner),
.data-form :deep(.el-date-editor .el-input__inner) {
  color: #0f172a;
  font-size: 14px;
  font-weight: 500;
}

.data-form :deep(.el-input__inner::placeholder) {
  color: #94a3b8;
  font-weight: 400;
}

/* 下拉箭头图标颜色 */
.data-form :deep(.el-select__caret),
.data-form :deep(.el-input__suffix-inner .el-icon),
.data-form :deep(.el-date-editor .el-input__suffix .el-icon) {
  color: #94a3b8;
}

/* el-input-number - 数字输入框 */
.data-form :deep(.el-input-number) {
  width: 100%;
  --el-input-number-control-bg: linear-gradient(135deg, #f1f5f9, #e2e8f0);
}

.data-form :deep(.el-input-number .el-input__wrapper) {
  border-radius: 10px;
  padding: 2px 0;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  background: #ffffff;
  transition: all 0.2s ease;
  min-height: 40px;
}

.data-form :deep(.el-input-number .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c7d2fe inset;
}

.data-form :deep(.el-input-number.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 2px #c7d2fe inset, 0 2px 8px rgba(99, 102, 241, 0.12);
}

.data-form :deep(.el-input-number .el-input__inner) {
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

/* 数字加减按钮 */
.data-form :deep(.el-input-number__decrease),
.data-form :deep(.el-input-number__increase) {
  width: 36px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  color: #64748b;
  font-size: 16px;
  border: none;
  transition: all 0.2s ease;
}

.data-form :deep(.el-input-number__decrease) {
  border-radius: 10px 0 0 10px;
  margin-right: 0;
}

.data-form :deep(.el-input-number__increase) {
  border-radius: 0 10px 10px 0;
  margin-left: 0;
}

.data-form :deep(.el-input-number__decrease:hover),
.data-form :deep(.el-input-number__increase:hover) {
  background: linear-gradient(135deg, #c7d2fe, #a5b4fc);
  color: #4f46e5;
}

/* 日期选择器 - 日历图标 */
.data-form :deep(.el-date-editor.el-input, .el-date-editor.el-input__wrapper) {
  width: 100% !important;
}

.data-form :deep(.el-date-editor .el-input__prefix) {
  color: #6366f1;
}

/* 禁用状态 */
.data-form :deep(.el-input.is-disabled .el-input__wrapper),
.data-form :deep(.el-input-number.is-disabled .el-input__wrapper) {
  background: #f8fafc;
  cursor: not-allowed;
}

/* ===== 对话框底部按钮 ===== */
.dialog-btn-cancel,
.dialog-btn-submit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  height: 40px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 10px;
  transition: all 0.2s ease;
  border: none;
}

.dialog-btn-cancel {
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  color: #475569;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.dialog-btn-cancel:hover {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(71, 85, 105, 0.15);
}

.dialog-btn-submit {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.dialog-btn-submit:hover {
  background: linear-gradient(135deg, #4338ca, #4f46e5);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
}

@media (max-width: 1200px) {
  .record-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .hero {
    flex-direction: column;
    align-items: stretch;
  }
  .record-list {
    grid-template-columns: 1fr;
  }
  .metric-row:last-child {
    grid-template-columns: 1fr 2fr;
  }
  .record-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .data-grid {
    grid-template-columns: 1fr;
  }
  .form-item.full {
    grid-column: span 1;
  }
}
</style>
