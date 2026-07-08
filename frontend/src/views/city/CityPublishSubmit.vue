<template>
  <div class="publish-page">
    <ConfigurablePageRenderer page-key="cityPublishSubmit" :modules="cityPublishSubmitLayoutModules">
      <template #page-head>
        <header class="hero">
          <div>
            <div class="eyebrow"><IconFont name="publishPlan" :fallback="EditPen" /> 城市端 · 发布回填</div>
            <h1>发布填报</h1>
            <p>填写发布信息，记录当天发布详情</p>
          </div>
          <div class="hero-actions">
            <el-date-picker v-model="currentDate" value-format="YYYY-MM-DD" />
            <el-button type="primary" @click="openCreate"><IconFont name="add" :fallback="Plus" />新增发布</el-button>
          </div>
        </header>
      </template>

      <template #summary-row>
        <section class="summary-row">
          <div class="sum-card"><strong>{{ taskDateRows.length }}</strong><span>当日下发</span></div>
          <div class="sum-card green"><strong>{{ publishedCount }}</strong><span>当日发布</span></div>
          <div class="sum-card amber"><strong>{{ pendingCount }}</strong><span>待填报</span></div>
        </section>
      </template>

      <template #record-grid>
        <section class="record-table-wrap" v-loading="loading">
          <el-table :data="todayRows" border stripe class="record-table" v-empty="!loading && !todayRows.length">
            <el-table-column prop="date" label="日期" width="110" align="center" />
            <el-table-column prop="publish_platform" label="平台" width="100" align="center">
              <template #default="{ row }">
                <span class="platform-badge" :style="{ background: platformBg(row.publish_platform || row.platform) }">
                  {{ platformLabel(row.publish_platform || row.platform) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="account_name" label="账号" width="160" />
            <el-table-column prop="video_title" label="视频标题" min-width="200">
              <template #default="{ row }">
                <span class="title-text">{{ row.video_title || row.material_name || '城市下发任务' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'published' ? 'success' : 'warning'" size="small">
                  {{ row.status === 'published' ? '已提交' : '待填报' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="publish_url" label="发布链接" min-width="200">
              <template #default="{ row }">
                <template v-if="row.publish_url">
                  <el-button class="btn-link" size="small" @click="openLink(row.publish_url)">查看链接</el-button>
                </template>
                <span v-else class="muted">未填写</span>
              </template>
            </el-table-column>
            <el-table-column prop="actual_publish_time" label="发布时间" width="170" align="center">
              <template #default="{ row }">
                <span>{{ row.actual_publish_time || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" align="center" fixed="right">
              <template #default="{ row }">
                <el-button class="btn-edit" size="small" @click="openEdit(row)">
                  <el-icon><EditPen /></el-icon>
                  <span>编辑填报</span>
                </el-button>
                <el-button v-if="row.status === 'published'" class="btn-data" size="small" type="primary" @click="goToDataEntry(row)">
                  <el-icon><DataAnalysis /></el-icon>
                  <span>填写数据</span>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!loading && !todayRows.length" description="该日期暂无发布记录，点击右上角新增" />
        </section>
      </template>
    </ConfigurablePageRenderer>

    <el-dialog
      v-model="showDialog"
      :title="editing ? '编辑发布信息' : '新增发布'"
      width="640px"
      destroy-on-close
      @closed="unlockPageScroll"
    >
      <div class="publish-form">
        <!-- 基本信息组 -->
        <div class="form-section">
          <div class="form-section-title">基本信息</div>
          <el-form-item label="关联任务">
            <el-select v-model="form.id" clearable filterable placeholder="可选择当前日期的总部下发任务" style="width: 100%" @change="selectTask">
              <el-option v-for="task in taskDateRows" :key="task.id" :label="`${task.date} · ${platformLabel(task.publish_platform || task.platform)} · ${task.video_title || '城市下发任务'}`" :value="task.id" />
            </el-select>
          </el-form-item>
          <div class="form-grid">
            <el-form-item label="发布平台">
              <el-select v-model="form.publish_platform" style="width: 100%">
                <el-option label="快手" value="kuaishou" />
                <el-option label="视频号" value="weixin" />
                <el-option label="抖音" value="douyin" />
                <el-option label="小红书" value="xiaohongshu" />
              </el-select>
            </el-form-item>
            <el-form-item label="发布账号"><el-input v-model="form.publish_account_name" disabled placeholder="系统自动从关联任务获取" /></el-form-item>
          </div>
        </div>

        <!-- 发布内容组 -->
        <div class="form-section">
          <div class="form-section-title">发布内容</div>
          <el-form-item label="发布链接"><el-input v-model="form.publish_url" placeholder="发布后的视频链接" /></el-form-item>
          <el-form-item label="发布截图">
            <div class="shot-uploader" tabindex="0" @paste="handlePasteImage">
              <div v-if="form.publish_screenshot" class="shot-preview">
                <img :src="mediaUrl(form.publish_screenshot)" alt="发布截图">
                <button type="button" class="btn-remove-shot" @click="form.publish_screenshot = ''">移除</button>
              </div>
              <div v-else class="shot-empty">
                <span>点击上传或直接粘贴截图</span>
                <small>支持 png / jpg / webp，保存到本地服务器</small>
              </div>
              <input ref="shotInput" type="file" accept="image/*" @change="handleShotFile" style="display:none" />
              <el-button class="btn-upload-shot" @click="shotInput?.click()">
                <el-icon><Plus /></el-icon>
                <span>上传截图</span>
              </el-button>
            </div>
          </el-form-item>
        </div>

        <!-- 其他信息组 -->
        <div class="form-section">
          <div class="form-section-title">其他信息</div>
          <el-form-item label="发布时间">
            <el-date-picker
              v-model="form.actual_publish_time"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
              :disabled-date="disabledActualPublishDate"
            />
            <div class="field-tip">发布时间日期必须和下发任务日期一致，避免填报到其他日期任务中。</div>
          </el-form-item>
          <el-form-item label="备注"><el-input v-model="form.city_remark" type="textarea" :rows="2" placeholder="可填写备注信息" /></el-form-item>
        </div>
      </div>
      <template #footer>
        <el-button class="dialog-btn-cancel" @click="closeDialog">取消</el-button>
        <el-button class="dialog-btn-submit" :loading="saving" @click="saveForm">
          {{ saving ? '保存中…' : '保存发布信息' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { EditPen, Link, Plus, Open, DataAnalysis } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { createCityDistribution, getAccounts, getCityDistributions, updateCityDistribution, uploadAvatar } from '@/api'
import { resolveMediaUrl } from '@/utils/mediaUrl'
import { getPlatformName } from '@/utils/iconMapping'

const route = useRoute()
const router = useRouter()
const cityPublishSubmitLayoutModules = layoutModuleCatalog.cityPublishSubmit
const { bindings: layoutBindings } = useLayoutBindings('cityPublishSubmit')
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const editing = ref(false)
const shotInput = ref(null)
const currentDate = ref(dayjs().format('YYYY-MM-DD'))
const tasks = ref([])
const accounts = ref([])
let userData = {}
try { userData = JSON.parse(localStorage.getItem('auth_user') || '{}') } catch {}
const currentUser = ref(userData)
const autoOpenedTaskId = ref('')
const form = reactive(emptyForm())

if (route.query.date) {
  currentDate.value = route.query.date
}

function emptyForm() {
  return {
    id: '',
    date: dayjs().format('YYYY-MM-DD'),
    account_id: '',
    publish_platform: 'kuaishou',
    publish_account_name: '',
    publish_url: '',
    publish_screenshot: '',
    actual_publish_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    city_remark: ''
  }
}

const taskDateRows = computed(() => tasks.value.filter(item => item.date === currentDate.value))
const actualPublishedRows = computed(() => tasks.value.filter(item =>
  item.status === 'published' && String(item.actual_publish_time || item.published_at || '').startsWith(currentDate.value)
))
const todayRows = computed(() => {
  const merged = [...taskDateRows.value, ...actualPublishedRows.value]
  return [...new Map(merged.map(item => [String(item.id), item])).values()]
})
const publishedCount = computed(() => actualPublishedRows.value.length)
const pendingCount = computed(() => taskDateRows.value.filter(item => item.status !== 'published').length)
const totalPlay = computed(() => todayRows.value.reduce((sum, item) => sum + Number(item.play_count || 0), 0))
const totalDeals = computed(() => todayRows.value.reduce((sum, item) => sum + Number(item.deal_count || 0), 0))
const totalRevenue = computed(() => todayRows.value.reduce((sum, item) => sum + Number(item.deal_amount || 0), 0).toLocaleString('zh-CN'))
const formTaskDate = computed(() => String(form.date || currentDate.value).slice(0, 10))

const platformLabel = (value) => ({ kuaishou: '快手', weixin: '视频号', douyin: '抖音', xiaohongshu: '小红书' }[value] || '未选择')
const platformBg = (p) => ({
  douyin: 'linear-gradient(135deg, #0f172a, #334155)',
  kuaishou: 'linear-gradient(135deg, #ff6633, #ff9500)',
  weixin: 'linear-gradient(135deg, #07c160, #10b981)',
  xiaohongshu: 'linear-gradient(135deg, #ff2442, #ef4444)'
}[p] || 'linear-gradient(135deg, #6366f1, #8b5cf6)')
const mediaUrl = (url) => resolveMediaUrl(url)
const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}
const applyLayoutBindings = (bindings = {}) => {
  const nextDate = normalizeBoundDate(bindings.date || bindings.currentDate)
  if (nextDate && nextDate !== currentDate.value) currentDate.value = nextDate
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
const unlockPageScroll = () => {
  nextTick(() => {
    document.body.classList.remove('el-popup-parent--hidden')
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    document.documentElement.style.overflow = ''
  })
}
const closeDialog = () => {
  showDialog.value = false
  unlockPageScroll()
}
const clearTaskQuery = async () => {
  if (!route.query.taskId) return
  const query = { ...route.query }
  delete query.taskId
  await router.replace({ path: route.path, query })
}
const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})
const uploadShotFile = async (file) => {
  if (!file) return
  const data = await fileToDataUrl(file)
  const res = await uploadAvatar({ filename: file.name || 'publish-shot.png', mime: file.type, data })
  form.publish_screenshot = res.url
  ElMessage.success('截图已上传')
}
const handleShotFile = async (event) => {
  const file = event.target.files?.[0]
  try { await uploadShotFile(file) } finally { event.target.value = '' }
}
const handlePasteImage = async (event) => {
  const file = [...(event.clipboardData?.files || [])].find(item => item.type?.startsWith('image/'))
  if (!file) return
  event.preventDefault()
  await uploadShotFile(file)
}

const loadData = async () => {
  loading.value = true
  try {
    const [taskData, publishedData, accountData] = await Promise.all([
      getCityDistributions({ pageSize: 200, dateFrom: currentDate.value, dateTo: currentDate.value }),
      getCityDistributions({
        pageSize: 200,
        actualDateFrom: currentDate.value,
        actualDateTo: currentDate.value,
        status: 'published'
      }),
      getAccounts({ type: 'city', cityId: currentUser.value.city_id })
    ])
    const mergedRows = [...(taskData.list || []), ...(publishedData.list || [])]
    tasks.value = [...new Map(mergedRows.map(item => [String(item.id), item])).values()]
    accounts.value = accountData || []
    const taskId = route.query.taskId
    if (taskId && autoOpenedTaskId.value !== String(taskId) && !showDialog.value) {
      const task = tasks.value.find(item => String(item.id) === String(taskId))
      if (task) {
        autoOpenedTaskId.value = String(taskId)
        openEdit(task)
      }
    }
  } finally {
    loading.value = false
  }
}

const selectTask = (id) => {
  const task = tasks.value.find(item => item.id === id)
  if (task) fillForm(task)
}

const fillForm = (row = {}) => {
  const taskDate = String(row.date || currentDate.value).slice(0, 10)
  const defaultActualTime = `${taskDate} ${dayjs().format('HH:mm:ss')}`
  Object.assign(form, emptyForm(), {
    ...row,
    account_id: row.account_id || accounts.value[0]?.id || '',
    publish_platform: row.publish_platform || row.platform || 'kuaishou',
    publish_account_name: row.account_name || row.publish_account_name || accounts.value[0]?.name || '',
    actual_publish_time: row.actual_publish_time || defaultActualTime
  })
}

const openCreate = () => {
  editing.value = false
  Object.assign(form, emptyForm(), {
    date: currentDate.value,
    account_id: accounts.value[0]?.id || '',
    publish_account_name: accounts.value[0]?.name || '',
    actual_publish_time: `${currentDate.value} ${dayjs().format('HH:mm:ss')}`
  })
  showDialog.value = true
}

const openEdit = (row) => {
  editing.value = true
  fillForm(row)
  showDialog.value = true
}

// 跳转到数据录入页面
const goToDataEntry = (row) => {
  router.push({ path: '/city/data-entry', query: { taskId: row.id } })
}

const disabledActualPublishDate = (date) => dayjs(date).format('YYYY-MM-DD') !== formTaskDate.value

const saveForm = async () => {
  if (!form.publish_url) return ElMessage.warning('请填写发布链接')
  if (!form.actual_publish_time) return ElMessage.warning('请选择发布时间')
  if (String(form.actual_publish_time).slice(0, 10) !== formTaskDate.value) {
    return ElMessage.warning(`发布时间日期必须与下发任务日期一致：${formTaskDate.value}`)
  }
  saving.value = true
  try {
    const payload = { ...form, status: 'published', date: form.date || currentDate.value }
    const shouldUpdateTask = form.id && tasks.value.some(item => String(item.id) === String(form.id))
    if (shouldUpdateTask) {
      await updateCityDistribution(form.id, payload)
    } else {
      const { id, ...createPayload } = payload
      await createCityDistribution(createPayload)
    }
    ElMessage.success('发布信息已保存')
    autoOpenedTaskId.value = String(form.id || route.query.taskId || '')
    await clearTaskQuery()
    closeDialog()
    window.dispatchEvent(new CustomEvent('task-progress-updated'))
    await loadData()
  } finally {
    saving.value = false
  }
}

watch(currentDate, loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
watch(() => route.query.taskId, () => {
  if (!route.query.taskId) return
  autoOpenedTaskId.value = ''
  loadData()
})
onMounted(loadData)
</script>

<style scoped>
.publish-page { display: flex; flex-direction: column; gap: 16px; }
.hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 22px 24px; background: #fff; border: 1px solid #eceff5; border-radius: 16px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #0f766e; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.hero h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
.hero p { margin: 0; color: #7b8497; font-size: 13px; }
.hero-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.summary-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.sum-card { padding: 18px; border-radius: 14px; background: #fff; border: 1px solid #eceff5; }
.sum-card strong { display: block; font-size: 28px; color: #4f46e5; margin-bottom: 4px; }
.sum-card.green strong { color: #059669; }
.sum-card.amber strong { color: #d97706; }
.sum-card span { color: #7b8497; font-size: 13px; }

.record-table-wrap { background: #fff; border: 1px solid #eceff5; border-radius: 14px; overflow: hidden; }
.record-table { width: 100%; }
.record-table :deep(.el-table__header-wrapper th) { background: #f8fafc; font-weight: 700; color: #334155; font-size: 13px; }
.record-table :deep(.el-table__body-wrapper td) { font-size: 13px; color: #475569; }
.record-table :deep(.el-table__body tr:hover > td) { background: #f5f3ff !important; }

.platform-badge {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.title-text {
  color: #1e293b;
  font-weight: 500;
}

.muted {
  color: #94a3b8;
  font-size: 12px;
}

.btn-link {
  color: #4f46e5;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  height: 26px;
}

.btn-edit, .btn-data {
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

.btn-data {
  background: linear-gradient(135deg, #4f46e5, #6366f1) !important;
  color: #ffffff !important;
}
.btn-data:hover {
  background: linear-gradient(135deg, #4338ca, #4f46e5) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35) !important;
}

/* ===== 编辑发布信息对话框 ===== */
.publish-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 表单分组卡片 */
.form-section {
  background: linear-gradient(135deg, #fafbff, #f0fdfa);
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  margin-bottom: 4px;
}

.form-section-title::before {
  content: '';
  width: 4px;
  height: 14px;
  background: linear-gradient(180deg, #6366f1, #8b5cf6);
  border-radius: 3px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* el-form-item label 美化 */
.publish-form :deep(.el-form-item__label) {
  font-size: 13px !important;
  color: #334155 !important;
  font-weight: 600 !important;
  line-height: 40px !important;
}

.publish-form :deep(.el-form-item) {
  margin-bottom: 12px !important;
}

/* 统一输入框外观 */
.publish-form :deep(.el-input__wrapper),
.publish-form :deep(.el-textarea__inner),
.publish-form :deep(.el-select .el-input__wrapper),
.publish-form :deep(.el-date-editor.el-input),
.publish-form :deep(.el-date-editor.el-input__wrapper) {
  border-radius: 10px !important;
  padding: 2px 12px !important;
  box-shadow: 0 0 0 1px #e2e8f0 inset !important;
  background: #ffffff !important;
  transition: all 0.2s ease;
  min-height: 40px !important;
}

.publish-form :deep(.el-input__wrapper:hover),
.publish-form :deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c7d2fe inset !important;
}

.publish-form :deep(.el-input__wrapper.is-focus),
.publish-form :deep(.el-select .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #c7d2fe inset, 0 2px 8px rgba(99,102,241,0.12) !important;
}

.publish-form :deep(.el-input__inner),
.publish-form :deep(.el-date-editor .el-input__inner),
.publish-form :deep(.el-textarea__inner) {
  color: #0f172a !important;
  font-size: 14px !important;
  font-weight: 500 !important;
}

.publish-form :deep(.el-input__inner::placeholder),
.publish-form :deep(.el-textarea__inner::placeholder) {
  color: #94a3b8 !important;
  font-weight: 400 !important;
}

.publish-form :deep(.el-textarea__inner) {
  padding: 10px 12px !important;
  font-family: inherit !important;
}

/* 下拉箭头图标颜色 */
.publish-form :deep(.el-select__caret),
.publish-form :deep(.el-input__suffix-inner .el-icon),
.publish-form :deep(.el-date-editor .el-input__suffix .el-icon) {
  color: #94a3b8 !important;
}

.publish-form :deep(.el-date-editor .el-input__prefix) {
  color: #6366f1 !important;
}

/* 禁用状态 */
.publish-form :deep(.el-input.is-disabled .el-input__wrapper) {
  background: #f8fafc !important;
  cursor: not-allowed !important;
}

.publish-form :deep(.el-input.is-disabled .el-input__inner) {
  color: #64748b !important;
  -webkit-text-fill-color: #64748b !important;
}

/* 上传截图区域 */
.shot-uploader {
  width: 100%;
  border: 2px dashed #c7d2fe;
  border-radius: 14px;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc, #ecfeff);
  display: flex;
  align-items: center;
  gap: 16px;
  outline: 0;
  transition: all 0.2s;
}

.shot-uploader:focus, .shot-uploader:hover {
  border-color: #818cf8;
  box-shadow: 0 0 0 4px rgba(99,102,241,0.1);
  background: linear-gradient(135deg, #eef2ff, #ecfeff);
}

.shot-preview {
  position: relative;
  width: 180px;
  height: 108px;
  border-radius: 12px;
  overflow: hidden;
  background: #e5e7eb;
  border: 1px solid #cbd5e1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.shot-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.btn-remove-shot {
  position: absolute;
  right: 8px;
  top: 8px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(220,38,38,0.9), rgba(239,68,68,0.9));
  color: #fff;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-remove-shot:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239,68,68,0.3);
}

.shot-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #334155;
}

.shot-empty span {
  font-weight: 700;
  font-size: 15px;
}

.shot-empty small {
  color: #64748b;
  font-size: 12px;
}

.btn-upload-shot {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 8px 16px !important;
  height: 36px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  border: none !important;
  border-radius: 10px !important;
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  color: #ffffff !important;
  transition: all 0.2s !important;
  box-shadow: 0 2px 8px rgba(99,102,241,0.25) !important;
}

.btn-upload-shot:hover {
  background: linear-gradient(135deg, #4f46e5, #6366f1) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(99,102,241,0.4) !important;
}

/* ===== 对话框底部按钮 ===== */
.dialog-btn-cancel,
.dialog-btn-submit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px !important;
  height: 40px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  border-radius: 10px !important;
  transition: all 0.2s ease !important;
  border: none !important;
}

.dialog-btn-cancel {
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0) !important;
  color: #475569 !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
}

.dialog-btn-cancel:hover {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(71, 85, 105, 0.15) !important;
}

.dialog-btn-submit {
  background: linear-gradient(135deg, #4f46e5, #6366f1) !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3) !important;
}

.dialog-btn-submit:hover {
  background: linear-gradient(135deg, #4338ca, #4f46e5) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4) !important;
}

@media (max-width: 800px) { .hero, .card-head, .card-foot { flex-direction: column; align-items: stretch; } .summary-row, .record-grid, .form-grid { grid-template-columns: 1fr; } }
</style>
