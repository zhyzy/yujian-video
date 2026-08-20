<!--
  直播账号管理页：维护抖音、快手、视频号、小红书等平台直播账号台账，
  为后续直播状态同步、直播数据看板和直播监控墙提供账号基础数据。
-->
<template>
  <div class="live-page">
    <section class="summary-grid">
      <article class="summary-card">
        <span>账号总数</span>
        <strong>{{ summary.total || 0 }}</strong>
        <small>已录入直播账号</small>
      </article>
      <article class="summary-card green">
        <span>启用中</span>
        <strong>{{ summary.active || 0 }}</strong>
        <small>可纳入直播排班</small>
      </article>
      <article class="summary-card purple">
        <span>直播中</span>
        <strong>{{ summary.living || 0 }}</strong>
        <small>等待平台同步状态</small>
      </article>
      <article class="summary-card amber">
        <span>蓝V账号</span>
        <strong>{{ summary.bluev || 0 }}</strong>
        <small>已标记企业认证</small>
      </article>
    </section>

    <section class="toolbar">
      <div class="platform-tabs">
        <button
          v-for="item in platformTabs"
          :key="item.key"
          :class="{ active: filters.platform === item.key }"
          @click="setPlatform(item.key)"
        >
          <IconFont v-if="item.key !== 'all'" :platform="item.key" />
          <span>{{ item.label }}</span>
        </button>
      </div>
      <div class="filters">
        <el-select v-model="filters.status" placeholder="账号状态" style="width: 128px" @change="loadAccounts">
          <el-option label="全部状态" value="all" />
          <el-option label="启用" value="active" />
          <el-option label="停用" value="paused" />
        </el-select>
        <el-input
          v-model="filters.keyword"
          class="keyword"
          clearable
          placeholder="搜索账号、主播、管理人"
          :prefix-icon="Search"
          @keyup.enter="loadAccounts"
          @clear="loadAccounts"
        />
        <el-button @click="loadAccounts">查询</el-button>
      </div>
    </section>

    <section class="table-panel" v-loading="loading">
      <div class="table-head">
        <strong>直播账号台账</strong>
        <span>{{ accounts.length }} 个账号</span>
      </div>
      <el-table :data="accounts" row-key="id" class="live-table" empty-text="暂无直播账号">
        <el-table-column label="账号平台" min-width="130">
          <template #default="{ row }">
            <span class="platform-chip" :class="'p-' + row.platform">
              <IconFont :platform="row.platform" />
              {{ row.platform_label || platformLabel(row.platform) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="账号名称" min-width="190">
          <template #default="{ row }">
            <div class="account-cell">
              <strong>{{ row.account_name }}</strong>
              <span>{{ row.platform_account || '未填写平台账号' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="live_person" label="直播人" min-width="120">
          <template #default="{ row }">{{ row.live_person || '-' }}</template>
        </el-table-column>
        <el-table-column label="是否蓝V" width="110">
          <template #default="{ row }">
            <el-tag :type="row.is_blue_v ? 'success' : 'info'" effect="plain">{{ row.is_blue_v ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="manager" label="管理人" min-width="120">
          <template #default="{ row }">{{ row.manager || '-' }}</template>
        </el-table-column>
        <el-table-column label="直播状态" min-width="120">
          <template #default="{ row }">
            <span class="status-pill" :class="'s-' + row.last_live_status">{{ liveStatusLabel(row.last_live_status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="直播数据" min-width="150">
          <template #default="{ row }">
            <div class="data-cell">
              <strong>{{ row.session_count || 0 }}</strong>
              <span>场 · {{ formatNumber(row.total_viewers || 0) }}观看</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link type="primary" @click="openSessions(row)">看数据</el-button>
              <el-button link @click="openRoom(row)">直播间</el-button>
              <el-button link @click="openEditDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeAccount(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <div class="floating-actions">
      <div class="floating-action-row">
        <button class="float-secondary" @click="loadAccounts"><el-icon><Refresh /></el-icon>刷新</button>
        <button class="float-main" @click="openCreateDialog"><el-icon><Plus /></el-icon>新增账号</button>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑直播账号' : '新增直播账号'" width="680px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="108px">
        <div class="form-grid">
          <el-form-item label="账号平台" prop="platform">
            <el-select v-model="form.platform" @change="syncPlatformLabel">
              <el-option v-for="item in platformOptions" :key="item.key" :label="item.label" :value="item.key" />
            </el-select>
          </el-form-item>
          <el-form-item label="账号名称" prop="account_name">
            <el-input v-model="form.account_name" placeholder="例如：遇见太原直播号" />
          </el-form-item>
          <el-form-item label="平台账号">
            <el-input v-model="form.platform_account" placeholder="平台昵称、ID 或主页标识" />
          </el-form-item>
          <el-form-item label="直播人">
            <el-input v-model="form.live_person" placeholder="主播姓名" />
          </el-form-item>
          <el-form-item label="是否蓝V">
            <el-switch v-model="form.is_blue_v" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="账号状态">
            <el-select v-model="form.status">
              <el-option label="启用" value="active" />
              <el-option label="停用" value="paused" />
            </el-select>
          </el-form-item>
          <el-form-item label="管理人">
            <el-input v-model="form.manager" placeholder="负责运营人员" />
          </el-form-item>
          <el-form-item label="直播状态">
            <el-select v-model="form.last_live_status">
              <el-option label="未知" value="unknown" />
              <el-option label="未开播" value="offline" />
              <el-option label="直播中" value="living" />
              <el-option label="已结束" value="ended" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="直播间链接">
          <el-input v-model="form.room_url" placeholder="平台直播间或创作者中心链接" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="记录开播时间、账号定位、注意事项等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAccount">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="sessionsDrawerVisible" :title="sessionTitle" size="720px">
      <div class="session-head">
        <div>
          <strong>{{ selectedAccount?.account_name || '-' }}</strong>
          <span>{{ platformLabel(selectedAccount?.platform) }} · {{ selectedAccount?.live_person || '未填写主播' }}</span>
        </div>
        <el-button :disabled="!selectedAccount?.room_url" @click="openRoom(selectedAccount)">打开直播间</el-button>
      </div>
      <el-table :data="sessions" row-key="id" empty-text="暂无直播数据，后续接入平台同步后会自动出现">
        <el-table-column prop="title" label="直播主题" min-width="180">
          <template #default="{ row }">{{ row.title || '未命名直播' }}</template>
        </el-table-column>
        <el-table-column prop="started_at" label="开始时间" min-width="150">
          <template #default="{ row }">{{ row.started_at || '-' }}</template>
        </el-table-column>
        <el-table-column label="观看/点赞" min-width="130">
          <template #default="{ row }">{{ formatNumber(row.viewer_count) }} / {{ formatNumber(row.like_count) }}</template>
        </el-table-column>
        <el-table-column label="成交" min-width="120">
          <template #default="{ row }">{{ row.sales_count || 0 }} 单</template>
        </el-table-column>
        <el-table-column label="来源" width="100">
          <template #default="{ row }">{{ row.data_source === 'api' ? '平台同步' : '手动' }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import {
  createLiveAccount,
  deleteLiveAccount,
  getLiveAccountSessions,
  getLiveAccounts,
  updateLiveAccount
} from '@/api'

const platformOptions = [
  { key: 'douyin', label: '抖音' },
  { key: 'kuaishou', label: '快手' },
  { key: 'weixin', label: '视频号' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'other', label: '其他' }
]
const platformTabs = [{ key: 'all', label: '全部' }, ...platformOptions]
const emptyForm = () => ({
  id: '',
  platform: 'douyin',
  platform_label: '抖音',
  account_name: '',
  platform_account: '',
  live_person: '',
  is_blue_v: false,
  manager: '',
  status: 'active',
  room_url: '',
  remark: '',
  last_live_status: 'unknown'
})

const loading = ref(false)
const saving = ref(false)
const accounts = ref([])
const summary = ref({})
const filters = reactive({ platform: 'all', status: 'all', keyword: '' })
const dialogVisible = ref(false)
const sessionsDrawerVisible = ref(false)
const formRef = ref(null)
const form = reactive(emptyForm())
const selectedAccount = ref(null)
const sessions = ref([])

const rules = {
  platform: [{ required: true, message: '请选择账号平台', trigger: 'change' }],
  account_name: [{ required: true, message: '请输入账号名称', trigger: 'blur' }]
}

const sessionTitle = computed(() => selectedAccount.value ? '直播数据明细' : '直播数据')

const platformLabel = (value) => platformOptions.find(item => item.key === value)?.label || value || '-'
const liveStatusLabel = (value) => ({ living: '直播中', offline: '未开播', ended: '已结束', unknown: '未知' }[value] || '未知')
const formatNumber = (value = 0) => Number(value || 0).toLocaleString('zh-CN')

const loadAccounts = async () => {
  loading.value = true
  try {
    const data = await getLiveAccounts({ ...filters })
    accounts.value = data?.list || []
    summary.value = data?.summary || {}
  } finally {
    loading.value = false
  }
}

const setPlatform = (platform) => {
  filters.platform = platform
  loadAccounts()
}

const resetForm = (payload = {}) => {
  Object.assign(form, emptyForm(), payload, {
    is_blue_v: Boolean(payload.is_blue_v)
  })
}

const syncPlatformLabel = () => {
  form.platform_label = platformLabel(form.platform)
}

const openCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  resetForm(row)
  dialogVisible.value = true
}

const saveAccount = async () => {
  await formRef.value?.validate()
  saving.value = true
  try {
    const payload = { ...form, is_blue_v: form.is_blue_v ? 1 : 0 }
    if (form.id) {
      await updateLiveAccount(form.id, payload)
      ElMessage.success('直播账号已更新')
    } else {
      await createLiveAccount(payload)
      ElMessage.success('直播账号已创建')
    }
    dialogVisible.value = false
    loadAccounts()
  } finally {
    saving.value = false
  }
}

const removeAccount = async (row) => {
  await ElMessageBox.confirm(`确定删除直播账号“${row.account_name}”吗？已有直播数据会保留。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
  await deleteLiveAccount(row.id)
  ElMessage.success('直播账号已删除')
  loadAccounts()
}

const openSessions = async (row) => {
  selectedAccount.value = row
  sessionsDrawerVisible.value = true
  const data = await getLiveAccountSessions(row.id)
  sessions.value = data?.list || []
  selectedAccount.value = data?.account || row
}

const openRoom = (row) => {
  if (!row?.room_url) return ElMessage.warning('还没有填写直播间链接')
  window.open(row.room_url, '_blank', 'noopener,noreferrer')
}

onMounted(loadAccounts)
</script>

<style scoped>
.live-page {
  display: grid;
  gap: 16px;
  padding: 24px;
  color: #162033;
}

.page-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  color: #64748b;
  font-weight: 700;
}

.eyebrow span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #14b8a6;
}

h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.15;
  letter-spacing: 0;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 15px;
}

.head-actions,
.filters,
.row-actions,
.session-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.summary-card,
.table-panel,
.toolbar {
  border: 1px solid #dfe7f2;
  border-radius: 8px;
  background: #fff;
}

.summary-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  box-shadow: 0 8px 24px rgba(36, 55, 86, 0.05);
}

.summary-card span,
.summary-card small {
  color: #64748b;
}

.summary-card strong {
  color: #4f46e5;
  font-size: 34px;
  line-height: 1;
}

.summary-card.green strong { color: #059669; }
.summary-card.purple strong { color: #6366f1; }
.summary-card.amber strong { color: #d97706; }

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
}

.platform-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.platform-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-weight: 700;
  cursor: pointer;
}

.platform-tabs button.active {
  border-color: #b8c4ff;
  background: #eef2ff;
  color: #4f46e5;
}

.keyword {
  width: 260px;
}

.table-panel {
  overflow: hidden;
}

.table-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid #edf2f7;
}

.table-head span {
  color: #64748b;
}

.platform-chip,
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-weight: 700;
}

.platform-chip {
  background: #f8fafc;
}

.p-douyin { color: #be185d; }
.p-kuaishou { color: #c2410c; }
.p-weixin { color: #047857; }
.p-xiaohongshu { color: #b91c1c; }
.p-other { color: #475569; }

.status-pill {
  background: #f1f5f9;
  color: #64748b;
}

.s-living {
  background: #e0e7ff;
  color: #4f46e5;
}

.s-offline {
  background: #f8fafc;
  color: #64748b;
}

.s-ended {
  background: #ecfdf5;
  color: #059669;
}

.account-cell,
.data-cell {
  display: grid;
  gap: 4px;
}

.account-cell span,
.data-cell span {
  color: #64748b;
  font-size: 13px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
}

.session-head {
  justify-content: space-between;
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.session-head div {
  display: grid;
  gap: 4px;
}

.session-head span {
  color: #64748b;
}

@media (max-width: 900px) {
  .live-page {
    padding: 16px;
  }

  .page-head,
  .toolbar {
    display: grid;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filters {
    display: grid;
    grid-template-columns: 1fr;
  }

  .keyword {
    width: 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
