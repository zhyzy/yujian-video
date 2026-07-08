<template>
  <div class="page">
    <ConfigurablePageRenderer page-key="operationLogs" :modules="operationLogsLayoutModules">
    <template #page-head>
    <header class="page-head">
      <div>
        <div class="eyebrow"><IconFont name="log" :fallback="Document" /> 系统审计 · 追踪</div>
        <h1>操作日志</h1>
        <p>记录所有用户在系统中的操作行为</p>
      </div>
    </header>
    </template>

    <template #filter-panel>
    <section class="panel">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
            @change="loadData"
          />
        </el-form-item>
        <el-form-item label="操作人">
          <el-input
            v-model="filters.username"
            placeholder="搜索用户名"
            clearable
            style="width: 160px"
            @keyup.enter="loadData"
            @clear="loadData"
          />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filters.actionType" placeholder="全部" clearable style="width: 140px" @change="loadData">
            <el-option label="新增" value="create" />
            <el-option label="修改" value="update" />
            <el-option label="删除" value="delete" />
            <el-option label="登录" value="login" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="HTTP方法">
          <el-select v-model="filters.method" placeholder="全部" clearable style="width: 120px" @change="loadData">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
            <el-option label="PUT" value="PUT" />
            <el-option label="DELETE" value="DELETE" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">
            <IconFont name="search" :fallback="Search" />
            查询
          </el-button>
          <el-button @click="resetFilters">
            <IconFont name="reset" :fallback="RefreshLeft" />
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </section>
    </template>

    <template #log-table>
    <section class="panel">
      <el-table :data="logs" v-loading="loading" stripe style="width: 100%">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="detail-panel">
              <div class="detail-row">
                <span class="detail-label">请求方式：</span>
                <el-tag :type="methodTagType(row.method)" size="small">{{ row.method }}</el-tag>
              </div>
              <div class="detail-row">
                <span class="detail-label">请求路径：</span>
                <span class="detail-value code">{{ row.path }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">状态码：</span>
                <el-tag :type="statusTagType(row.status_code)" size="small">{{ row.status_code }}</el-tag>
              </div>
              <div class="detail-row">
                <span class="detail-label">IP 地址：</span>
                <span class="detail-value">{{ row.ip }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">User-Agent：</span>
                <span class="detail-value">{{ row.user_agent || '-' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">耗时：</span>
                <span class="detail-value">{{ row.duration ? row.duration + 'ms' : '-' }}</span>
              </div>
              <div v-if="row.request_body" class="detail-block">
                <div class="detail-label">请求 Body：</div>
                <pre class="json-block">{{ formatJson(row.request_body) }}</pre>
              </div>
              <div v-if="row.response_body" class="detail-block">
                <div class="detail-label">响应 Body：</div>
                <pre class="json-block">{{ formatJson(row.response_body) }}</pre>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="操作时间" width="170" />
        <el-table-column label="操作人" width="140">
          <template #default="{ row }">
            <div class="user-cell">
              <div v-if="row.user_avatar" class="avatar"><img :src="row.user_avatar" alt=""></div>
              <div v-else class="avatar text">{{ (row.username || '?').slice(0, 1) }}</div>
              <span>{{ row.username || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作动作" min-width="180">
          <template #default="{ row }">
            <span class="action-text">{{ actionDescription(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="HTTP方法" width="100">
          <template #default="{ row }">
            <el-tag :type="methodTagType(row.method)" size="small" effect="light">{{ row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="请求路径" min-width="200">
          <template #default="{ row }">
            <span class="path-text">{{ row.path }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="resource_type" label="资源类型" width="120">
          <template #default="{ row }">{{ row.resource_type || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态码" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status_code)" size="small">{{ row.status_code }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP地址" width="140" />
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </section>
    </template>
    </ConfigurablePageRenderer>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Search, RefreshLeft } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getOperationLogs } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'

const operationLogsLayoutModules = layoutModuleCatalog.operationLogs
const { bindings: layoutBindings } = useLayoutBindings('operationLogs')
const loading = ref(false)
const logs = ref([])
const dateRange = ref([])
const filters = reactive({
  username: '',
  actionType: '',
  method: ''
})
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const applyLayoutBindings = (bindings = {}) => {
  let shouldReload = false
  if ('username' in bindings && (bindings.username || '') !== filters.username) {
    filters.username = bindings.username || ''
    shouldReload = true
  }
  if ('method' in bindings && (bindings.method || '') !== filters.method) {
    filters.method = bindings.method || ''
    shouldReload = true
  }
  if ('actionType' in bindings && (bindings.actionType || '') !== filters.actionType) {
    filters.actionType = bindings.actionType || ''
    shouldReload = true
  }
  if (shouldReload) loadData()
}

const methodTagType = (method) => {
  const map = { GET: 'primary', POST: 'success', PUT: 'warning', DELETE: 'danger' }
  return map[method] || 'info'
}

const statusTagType = (code) => {
  if (!code) return 'info'
  if (code >= 200 && code < 300) return 'success'
  if (code >= 400 && code < 500) return 'warning'
  if (code >= 500) return 'danger'
  return 'info'
}

const actionDescription = (row) => {
  const method = row.method || ''
  const path = row.path || ''
  if (method === 'GET' && path.includes('/login')) return '登录系统'
  if (method === 'POST') return `新增${row.resource_type || '资源'}`
  if (method === 'PUT') return `修改${row.resource_type || '资源'}`
  if (method === 'DELETE') return `删除${row.resource_type || '资源'}`
  if (method === 'GET') return `查询${row.resource_type || '资源'}`
  return row.action || '其他操作'
}

const formatJson = (data) => {
  if (!data) return ''
  try {
    if (typeof data === 'string') {
      return JSON.stringify(JSON.parse(data), null, 2)
    }
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      username: filters.username || undefined,
      method: filters.method || undefined,
      actionType: filters.actionType || undefined
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res = await getOperationLogs(params)
    logs.value = res.list || res.data?.list || []
    pagination.total = res.total || res.data?.total || 0
  } catch (e) {
    ElMessage.error(e?.message || '加载失败')
    logs.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.username = ''
  filters.actionType = ''
  filters.method = ''
  dateRange.value = []
  pagination.page = 1
  loadData()
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.page-head {
  display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  padding: 22px 24px; background: #fff; border: 1px solid #eceff5; border-radius: 16px;
}
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #6366f1; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.page-head h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
.page-head p { margin: 0; color: #7b8497; font-size: 13px; }
.panel { background: #fff; border: 1px solid #eceff5; border-radius: 16px; padding: 18px; }

.filter-form :deep(.el-form-item) { margin-bottom: 0; margin-right: 12px; }
.filter-form :deep(.el-form-item__label) { font-weight: 600; color: #475569; }

.user-cell { display: flex; align-items: center; gap: 8px; }
.user-cell .avatar {
  width: 28px; height: 28px; border-radius: 999px; overflow: hidden;
  background: #eef2ff; display: grid; place-items: center; flex-shrink: 0;
}
.user-cell .avatar img { width: 100%; height: 100%; object-fit: cover; }
.user-cell .avatar.text { color: #fff; font-weight: 700; font-size: 12px; background: linear-gradient(135deg, #6366f1, #14b8a6); }
.user-cell span { font-size: 13px; color: #0f172a; font-weight: 500; }

.action-text { color: #334155; font-size: 13px; }
.path-text { font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #64748b; }

.detail-panel { padding: 8px 16px 16px; background: #f8fafc; border-radius: 10px; margin: 4px 0; }
.detail-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
.detail-label { color: #64748b; min-width: 80px; flex-shrink: 0; font-weight: 500; }
.detail-value { color: #0f172a; word-break: break-all; }
.detail-value.code { font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #4f46e5; }
.detail-block { margin-top: 8px; }
.detail-block .detail-label { margin-bottom: 6px; display: block; }
.json-block {
  margin: 0; padding: 12px; background: #1e293b; color: #e2e8f0;
  border-radius: 8px; font-size: 12px; line-height: 1.6;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  max-height: 320px; overflow: auto; white-space: pre-wrap; word-break: break-all;
}

.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }

@media (max-width: 800px) {
  .page-head { flex-direction: column; align-items: stretch; }
  .filter-form :deep(.el-form-item) { display: flex; margin-right: 0; margin-bottom: 12px; }
  .filter-form :deep(.el-form-item__label) { width: 80px !important; text-align: right; }
}
</style>
