<template>
  <div class="distribution-page">
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="dot"></span>发布管理 · 城市下发</div>
        <h1>下发记录</h1>
        <p>管理总部下发给城市账号的发布任务，查看下发状态和执行情况。</p>
      </div>
      <div class="head-actions">
        <button class="primary-btn" @click="loadList"><el-icon><Refresh /></el-icon>刷新</button>
        <button class="primary-btn" @click="openCreate"><el-icon><Plus /></el-icon>新增下发</button>
      </div>
    </div>

    <section class="filter-panel">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">下发日期</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            class="filter-input"
            @change="loadList"
          />
        </div>
        <div class="filter-item">
          <span class="filter-label">城市</span>
          <el-select v-model="filters.cityId" placeholder="全部城市" class="filter-input" @change="onCityChange">
            <el-option label="全部城市" value="" />
            <el-option v-for="city in cities" :key="city.id" :label="city.name" :value="city.id" />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">账号</span>
          <el-select v-model="filters.accountId" placeholder="全部账号" class="filter-input">
            <el-option label="全部账号" value="" />
            <el-option
              v-for="account in filteredAccounts"
              :key="account.id"
              :label="account.name"
              :value="account.id"
            >
              <div class="el-option-with-icon">
                <IconFont :platform="account.platform" />
                <span>{{ account.name }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">状态</span>
          <el-select v-model="filters.status" class="filter-input">
            <el-option label="全部" value="" />
            <el-option label="待发布" value="pending" />
            <el-option label="已填报" value="published" />
            <el-option label="超期" value="overdue" />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">下载状态</span>
          <el-select v-model="filters.downloadStatus" class="filter-input" @change="loadList">
            <el-option label="全部" value="" />
            <el-option label="已点击下载" value="downloaded" />
            <el-option label="未下载" value="not_downloaded" />
          </el-select>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">关键词</span>
          <el-input
            v-model="filters.keyword"
            placeholder="搜索视频标题/链接"
            class="filter-input"
            clearable
            @keyup.enter="loadList"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="filter-item">
          <span class="filter-label">发布时间</span>
          <el-time-picker
            v-model="timeRange"
            is-range
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="HH:mm"
            format="HH:mm"
            class="filter-input time-picker"
          />
        </div>
        <div class="filter-item filter-actions">
          <button class="ghost-btn" @click="resetFilters">重置</button>
          <button class="primary-btn" @click="loadList">搜索</button>
        </div>
      </div>
    </section>

    <section class="table-panel">
      <el-table :data="tableData" v-loading="loading" stripe style="width: 100%" border>
        <el-table-column prop="city_name" label="城市" min-width="100" />
        <el-table-column label="账号名称" min-width="180">
          <template #default="{ row }">
            <div class="account-cell">
              <span class="platform-pill" :style="{ '--platform-color': platformColor(row.platform) }">
                <IconFont :platform="row.platform" :color="platformColor(row.platform)" />
              </span>
              <span class="account-name">{{ row.account_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="下发日期" min-width="120" />
        <el-table-column prop="publish_time" label="发布时间" min-width="100" />
        <el-table-column prop="video_title" label="视频标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="视频链接" min-width="180">
          <template #default="{ row }">
            <div class="link-cell">
              <span class="link-text" :title="row.video_url || row.material_url">
                {{ row.video_url || row.material_url || '-' }}
              </span>
              <el-button
                v-if="row.video_url || row.material_url"
                type="primary"
                link
                size="small"
                @click="copyLink(row.video_url || row.material_url)"
              >
                <el-icon><CopyDocument /></el-icon>
                复制
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下载状态" min-width="145" align="center">
          <template #default="{ row }">
            <div class="download-state">
              <el-tag :type="row.downloaded_at ? 'success' : 'info'" effect="light">
                {{ row.downloaded_at ? '已点击下载' : '未下载' }}
              </el-tag>
              <small v-if="row.downloaded_at">{{ formatDownloadTime(row.downloaded_at) }}</small>
              <small v-if="row.download_count > 1">共 {{ row.download_count }} 次</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无下发记录" />
        </template>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingRecord ? '编辑下发记录' : '新增下发记录'"
      width="680px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="城市" prop="city_id">
              <el-select v-model="form.city_id" placeholder="请选择城市" style="width: 100%" @change="onFormCityChange">
                <el-option v-for="city in cities" :key="city.id" :label="city.name" :value="city.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="账号" prop="account_id">
              <el-select v-model="form.account_id" placeholder="请选择账号" style="width: 100%">
                <el-option
                  v-for="account in formAccountOptions"
                  :key="account.id"
                  :label="account.name"
                  :value="account.id"
                >
                  <div class="el-option-with-icon">
                    <IconFont :platform="account.platform" />
                    <span>{{ account.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="下发日期" prop="date">
              <el-date-picker
                v-model="form.date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发布时间" prop="publish_time">
              <el-time-picker
                v-model="form.publish_time"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="视频标题" prop="video_title">
          <el-input v-model="form.video_title" placeholder="请输入视频标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="视频链接" prop="video_url">
          <el-input v-model="form.video_url" placeholder="请输入视频链接或素材地址" />
        </el-form-item>
        <el-form-item label="发布要求" prop="publish_requirement">
          <el-input
            v-model="form.publish_requirement"
            type="textarea"
            :rows="3"
            placeholder="请输入发布要求或备注"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态" style="width: 200px">
            <el-option label="待发布" value="pending" />
            <el-option label="已填报" value="published" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CopyDocument,
  Delete,
  Edit,
  Plus,
  Refresh,
  Search
} from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { usePageSearch } from '@/composables/usePageSearch'
import {
  getCityDistributions,
  createCityDistribution,
  updateCityDistribution,
  deleteCityDistribution,
  getCities,
  getAccounts
} from '@/api'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingRecord = ref(false)
const formRef = ref(null)
const cities = ref([])
const cityAccounts = ref([])
const dateRange = ref([])
const timeRange = ref([])

const filters = reactive({
  cityId: '',
  accountId: '',
  status: '',
  downloadStatus: '',
  keyword: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})
const { pageSearchKeyword } = usePageSearch()

const tableData = ref([])

watch(pageSearchKeyword, value => {
  filters.keyword = value
  pagination.page = 1
  loadData()
})

const platforms = [
  { key: 'douyin', label: '抖音', color: '#ef4444' },
  { key: 'kuaishou', label: '快手', color: '#f97316' },
  { key: 'weixin', label: '视频号', color: '#10b981' },
  { key: 'xiaohongshu', label: '小红书', color: '#e11d48' },
  { key: 'other', label: '其他', color: '#64748b' }
]

const platformColor = (p) => platforms.find(item => item.key === p)?.color || '#6366f1'

const statusLabel = (status) => {
  const map = {
    pending: '待发布',
    published: '已填报',
    overdue: '超期'
  }
  return map[status] || status || '未知'
}

const statusType = (status) => {
  const map = {
    pending: 'warning',
    published: 'success',
    overdue: 'danger'
  }
  return map[status] || 'info'
}

const filteredAccounts = computed(() => {
  if (filters.cityId) {
    return cityAccounts.value.filter(a => a.city_id === filters.cityId)
  }
  return cityAccounts.value
})

const formAccountOptions = computed(() => {
  if (form.city_id) {
    return cityAccounts.value.filter(a => a.city_id === form.city_id)
  }
  return cityAccounts.value
})

const emptyForm = () => ({
  id: '',
  city_id: '',
  account_id: '',
  date: dayjs().format('YYYY-MM-DD'),
  publish_time: '09:00',
  video_title: '',
  video_url: '',
  publish_requirement: '',
  status: 'pending'
})

const form = reactive(emptyForm())

const formRules = {
  city_id: [{ required: true, message: '请选择城市', trigger: 'change' }],
  account_id: [{ required: true, message: '请选择账号', trigger: 'change' }],
  date: [{ required: true, message: '请选择下发日期', trigger: 'change' }],
  publish_time: [{ required: true, message: '请选择发布时间', trigger: 'change' }],
  video_title: [{ required: true, message: '请输入视频标题', trigger: 'blur' }]
}

const loadCities = async () => {
  const res = await getCities()
  cities.value = Array.isArray(res) ? res : []
}

const loadCityAccounts = async () => {
  const allAccounts = []
  const cityList = cities.value
  for (const city of cityList) {
    try {
      const res = await getAccounts({ type: 'city', city_id: city.id, pageSize: 1000 })
      const list = res.list || res || []
      list.forEach(acc => {
        allAccounts.push({
          ...acc,
          city_id: city.id,
          city_name: city.name
        })
      })
    } catch (e) {
      if (city.accounts && Array.isArray(city.accounts)) {
        city.accounts.forEach(acc => {
          allAccounts.push({
            ...acc,
            city_id: city.id,
            city_name: city.name
          })
        })
      }
    }
  }
  cityAccounts.value = allAccounts
}

const loadList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.dateFrom = dateRange.value[0]
      params.dateTo = dateRange.value[1]
    }
    if (filters.cityId) params.cityId = filters.cityId
    if (filters.accountId) params.accountId = filters.accountId
    if (filters.status) params.status = filters.status
    if (filters.downloadStatus) params.downloadStatus = filters.downloadStatus
    if (filters.keyword) params.keyword = filters.keyword
    if (timeRange.value && timeRange.value.length === 2) {
      params.timeFrom = timeRange.value[0]
      params.timeTo = timeRange.value[1]
    }

    const res = await getCityDistributions(params)
    const list = res.list || res || []
    const today = dayjs().format('YYYY-MM-DD')
    
    tableData.value = list.map(item => {
      let status = item.status || 'pending'
      if (status === 'pending' && item.date && item.date < today) {
        status = 'overdue'
      }
      return { ...item, status }
    })
    
    pagination.total = res.total || list.length
  } catch (e) {
    ElMessage.error('加载失败：' + e.message)
  } finally {
    loading.value = false
  }
}

const onCityChange = () => {
  filters.accountId = ''
  loadList()
}

const onFormCityChange = () => {
  form.account_id = ''
}

const resetFilters = () => {
  filters.cityId = ''
  filters.accountId = ''
  filters.status = ''
  filters.downloadStatus = ''
  filters.keyword = ''
  dateRange.value = []
  timeRange.value = []
  pagination.page = 1
  loadList()
}

const copyLink = async (text) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制链接')
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

const formatDownloadTime = (value) => dayjs(value).format('MM-DD HH:mm')

const openCreate = () => {
  editingRecord.value = false
  Object.assign(form, emptyForm())
  dialogVisible.value = true
}

const openEdit = (row) => {
  editingRecord.value = true
  Object.assign(form, emptyForm(), {
    id: row.id,
    city_id: row.city_id,
    account_id: row.account_id,
    date: row.date,
    publish_time: row.publish_time || row.time || '09:00',
    video_title: row.video_title || '',
    video_url: row.video_url || row.material_url || '',
    publish_requirement: row.publish_requirement || row.remark || '',
    status: row.status === 'overdue' ? 'pending' : (row.status || 'pending')
  })
  dialogVisible.value = true
}

const saveRecord = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  
  saving.value = true
  try {
    const payload = { ...form }
    if (editingRecord.value) {
      await updateCityDistribution(payload.id, payload)
      ElMessage.success('更新成功')
    } else {
      await createCityDistribution(payload)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    await loadList()
  } catch (e) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.video_title || '该下发记录'}」吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }
  
  try {
    await deleteCityDistribution(row.id)
    ElMessage.success('删除成功')
    await loadList()
  } catch (e) {
    ElMessage.error('删除失败：' + e.message)
  }
}

onMounted(async () => {
  await loadCities()
  await loadCityAccounts()
  await loadList()
})
</script>

<style scoped>
.distribution-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.download-state { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.download-state small { color: #94a3b8; font-size: 11px; line-height: 1.2; }

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.14);
}

h1 {
  margin-top: 8px;
  color: #0f172a;
  font-size: 30px;
  letter-spacing: 0;
}

.page-head p {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.ghost-btn,
.primary-btn {
  height: 40px;
  border-radius: 10px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
}

.ghost-btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #475569;
}

.primary-btn {
  border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.24);
}

.filter-panel {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  gap: 10px;
}

.filter-label {
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.filter-input {
  width: 200px;
}

.filter-input.time-picker {
  width: 240px;
}

.filter-actions {
  margin-left: auto;
  gap: 8px;
}

.table-panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
}

.account-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.platform-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #edf2f7;
}

.account-name {
  font-weight: 600;
  color: #0f172a;
}

.link-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.link-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
  font-size: 13px;
  min-width: 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #eef0f5;
}

.el-option-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 1100px) {
  .page-head {
    align-items: stretch;
    flex-direction: column;
  }
  
  .head-actions {
    justify-content: flex-start;
  }
  
  .filter-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-item {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-input,
  .filter-input.time-picker {
    width: 100%;
  }
  
  .filter-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
