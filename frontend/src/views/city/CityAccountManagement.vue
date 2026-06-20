<template>
  <div class="page-wrap city-account-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <div class="eyebrow">
          <span class="dot"></span>账号矩阵
        </div>
        <h1 class="title">我的账号</h1>
        <p class="subtitle">管理您在各平台的分发账号，支持查看和编辑账号信息</p>
      </div>
      <div class="header-right">
        <button class="btn-primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          新增账号
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div
        v-for="stat in platformStats"
        :key="stat.key"
        class="stat-card"
        :class="'stat-' + stat.key"
        @click="activePlatform = stat.key"
        :style="{ cursor: 'pointer' }"
      >
        <div class="stat-icon">
          <IconFont :platform="stat.key" />
        </div>
        <div class="stat-info">
          <span class="stat-label">{{ stat.label }}</span>
          <strong class="stat-value">{{ stat.count }}</strong>
        </div>
      </div>
    </div>

    <!-- 平台 Tab 切换 -->
    <div class="platform-tabs">
      <button
        v-for="tab in platformTabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activePlatform === tab.key }"
        @click="activePlatform = tab.key"
      >
        <IconFont v-if="tab.key !== 'all'" :platform="tab.key" />
        {{ tab.label }}
        <span class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- 账号列表 -->
    <div v-if="filteredAccounts.length" class="account-list">
      <div v-for="account in filteredAccounts" :key="account.id" class="account-card">
        <div class="account-main">
          <div class="account-platform" :class="'p-' + account.platform">
            <IconFont :platform="account.platform" />
            <span>{{ account.platform_label || getPlatformName(account.platform) }}</span>
          </div>
          <div class="account-info">
            <h3 class="account-name">{{ account.name }}</h3>
            <a
              v-if="account.platform_account"
              class="account-link"
              :href="account.platform_account"
              target="_blank"
              rel="noopener"
            >
              <el-icon><Link /></el-icon>
              {{ account.platform_account }}
            </a>
            <span v-else class="account-link placeholder">未填写账号链接</span>
          </div>
        </div>
        <div class="account-right">
          <span class="status-badge" :class="'st-' + account.status">
            {{ statusLabel(account.status) }}
          </span>
          <button class="mini-btn" @click="openEditDialog(account)">
            <el-icon><EditPen /></el-icon>
          </button>
          <button class="mini-btn danger" @click="deleteAccount(account)">
            <el-icon><Delete /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <el-icon><UserFilled /></el-icon>
      </div>
      <div class="empty-text">
        <strong>暂无账号</strong>
        <span>点击右上角「新增账号」开始添加</span>
      </div>
    </div>

    <!-- 新增/编辑 账号弹窗 -->
    <div class="dialog-overlay" v-if="showDialog" @click.self="closeDialog">
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>{{ editingAccount ? '编辑账号' : '新增账号' }}</h3>
            <p>{{ editingAccount ? '修改账号信息' : '为您的城市新增一个分发账号' }}</p>
          </div>
          <button class="icon-close" @click="closeDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <!-- 新增时显示平台选择，编辑时显示平台标签 -->
          <div class="form-field" v-if="!editingAccount">
            <label>平台 <em>*</em></label>
            <select v-model="form.platform" class="select-input" @change="onPlatformChange">
              <option v-for="p in platformOptions" :key="p.key" :value="p.key">{{ p.label }}</option>
            </select>
          </div>
          <div class="form-field" v-else>
            <label>平台</label>
            <div class="platform-tag-display" :class="'p-' + form.platform">
              <IconFont :platform="form.platform" />
              <span>{{ form.platform_label || getPlatformName(form.platform) }}</span>
            </div>
          </div>
          <div class="form-field" v-if="editingAccount && form.platform === 'other'">
            <label>平台显示名称</label>
            <input v-model="form.platform_label" class="text-input" placeholder="如：B站" />
          </div>
          <div class="form-field">
            <label>账号名称 <em>*</em></label>
            <input v-model="form.name" class="text-input" placeholder="如：遇见西安快手号" />
          </div>
          <div class="form-field">
            <label>账号链接 / 主页地址</label>
            <input v-model="form.platform_account" class="text-input" placeholder="https://..." />
          </div>
          <div class="form-field">
            <label>状态</label>
            <select v-model="form.status" class="select-input">
              <option value="active">活跃</option>
              <option value="pending">待完善</option>
              <option value="paused">暂停</option>
            </select>
          </div>
          <div class="form-field">
            <label>备注</label>
            <textarea v-model="form.remark" class="textarea-input" placeholder="可选，运营说明" rows="2"></textarea>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="btn-ghost" @click="closeDialog">取消</button>
          <button class="btn-primary" :disabled="!form.name" @click="saveAccount">
            {{ editingAccount ? '保存修改' : '创建账号' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import IconFont from '@/components/IconFont.vue'
import { getAccounts, createAccount, updateAccount, deleteAccount as delAccount } from '@/api'
import { getPlatformName, platformBgColors } from '@/utils/iconMapping'

const platformOptions = [
  { key: 'douyin', label: '抖音' },
  { key: 'kuaishou', label: '快手' },
  { key: 'weixin', label: '视频号' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'weibo', label: '微博' },
  { key: 'bilibili', label: 'B站' },
  { key: 'other', label: '其他' }
]

const accounts = ref([])
const activePlatform = ref('all')
const showDialog = ref(false)
const editingAccount = ref(null)

const form = ref({
  platform: 'douyin',
  platform_label: '',
  name: '',
  platform_account: '',
  status: 'active',
  remark: ''
})

// 加载账号数据
const loadAccounts = async () => {
  try {
    const data = await getAccounts({ type: 'city' })
    accounts.value = Array.isArray(data) ? data : []
  } catch (error) {
    ElMessage.error('加载账号失败')
    accounts.value = []
  }
}

// 平台统计
const platformStats = computed(() => {
  const stats = {}
  accounts.value.forEach(acc => {
    const p = acc.platform || 'other'
    stats[p] = (stats[p] || 0) + 1
  })
  const total = accounts.value.length
  return [
    { key: 'kuaishou', label: '快手', count: stats.kuaishou || 0 },
    { key: 'weixin', label: '视频号', count: stats.weixin || 0 },
    { key: 'douyin', label: '抖音', count: stats.douyin || 0 },
    { key: 'xiaohongshu', label: '小红书', count: stats.xiaohongshu || 0 },
    { key: 'other', label: '其他', count: (stats.other || 0) + (stats.weibo || 0) + (stats.bilibili || 0) }
  ]
})

// 平台 Tab
const platformTabs = computed(() => {
  const stats = {}
  accounts.value.forEach(acc => {
    const p = acc.platform || 'other'
    stats[p] = (stats[p] || 0) + 1
  })
  const tabs = [
    { key: 'all', label: '全部', count: accounts.value.length }
  ]
  const order = ['kuaishou', 'weixin', 'douyin', 'xiaohongshu', 'other']
  order.forEach(key => {
    if (stats[key]) {
      tabs.push({ key, label: getPlatformName(key), count: stats[key] })
    }
  })
  return tabs
})

// 过滤后的账号列表
const filteredAccounts = computed(() => {
  if (activePlatform.value === 'all') return accounts.value
  return accounts.value.filter(acc => {
    const p = acc.platform || 'other'
    if (activePlatform.value === 'other') {
      return ['other', 'weibo', 'bilibili'].includes(p)
    }
    return p === activePlatform.value
  })
})

// 平台选择变化
const onPlatformChange = () => {
  form.value.platform_label = ''
}

// 打开新增弹窗
const openAddDialog = () => {
  editingAccount.value = null
  form.value = {
    platform: 'douyin',
    platform_label: '',
    name: '',
    platform_account: '',
    status: 'active',
    remark: ''
  }
  showDialog.value = true
}

// 打开编辑弹窗
const openEditDialog = (account) => {
  editingAccount.value = account
  form.value = {
    platform: account.platform || 'other',
    platform_label: account.platform_label || '',
    name: account.name || '',
    platform_account: account.platform_account || '',
    status: account.status || 'active',
    remark: account.remark || ''
  }
  showDialog.value = true
}

// 关闭弹窗
const closeDialog = () => {
  showDialog.value = false
  editingAccount.value = null
}

// 保存账号
const saveAccount = async () => {
  if (!form.value.name) {
    ElMessage.warning('请填写账号名称')
    return
  }
  try {
    const payload = { ...form.value }
    if (editingAccount.value) {
      await updateAccount(editingAccount.value.id, payload)
      ElMessage.success('账号更新成功')
    } else {
      await createAccount(payload)
      ElMessage.success('账号创建成功')
    }
    closeDialog()
    loadAccounts()
  } catch (error) {
    ElMessage.error(error?.message || '操作失败')
  }
}

// 删除账号
const deleteAccount = async (account) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除账号「${account.name}」吗？`,
      '删除确认',
      { type: 'warning' }
    )
    await delAccount(account.id)
    ElMessage.success('账号已删除')
    loadAccounts()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || '删除失败')
    }
  }
}

// 状态标签
const statusLabel = (s) => ({
  active: '活跃',
  pending: '待完善',
  paused: '暂停'
}[s] || s)

onMounted(() => {
  loadAccounts()
})
</script>

<style scoped>
.city-account-page {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6366f1;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
}

.title {
  font-size: 24px;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 4px;
}

.subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.2s;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.stat-kuaishou .stat-icon { background: linear-gradient(135deg, #fff3e6, #ffe4cc); }
.stat-weixin .stat-icon { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); }
.stat-douyin .stat-icon { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); }
.stat-xiaohongshu .stat-icon { background: linear-gradient(135deg, #fff0f0, #ffe4e4); }
.stat-other .stat-icon { background: linear-gradient(135deg, #f0f4ff, #e0e7ff); }

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
}

.stat-value {
  font-size: 22px;
  font-weight: 800;
  color: #1e293b;
}

/* 平台 Tab */
.platform-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: #f8fafc;
  border-radius: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.tab-btn:hover {
  background: #ffffff;
  color: #1e293b;
}

.tab-btn.active {
  background: #ffffff;
  color: #6366f1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.tab-count {
  background: #f1f5f9;
  color: #94a3b8;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
}

.tab-btn.active .tab-count {
  background: #ede9fe;
  color: #7c3aed;
}

/* 账号列表 */
.account-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.2s;
}

.account-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.06);
}

.account-main {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.account-platform {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.account-platform.p-kuaishou { background: linear-gradient(135deg, #fff3e6, #ffe4cc); color: #d97706; }
.account-platform.p-weixin { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); color: #15803d; }
.account-platform.p-douyin { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); color: #475569; }
.account-platform.p-xiaohongshu { background: linear-gradient(135deg, #fff0f0, #ffe4e4); color: #dc2626; }
.account-platform.p-other, .account-platform.p-weibo, .account-platform.p-bilibili {
  background: linear-gradient(135deg, #f0f4ff, #e0e7ff); color: #4f46e5;
}

.account-info {
  min-width: 0;
  flex: 1;
}

.account-name {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
}

.account-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6366f1;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}

.account-link:hover {
  text-decoration: underline;
}

.account-link.placeholder {
  color: #cbd5e1;
  font-style: italic;
}

.account-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.st-active { background: #dcfce7; color: #15803d; }
.status-badge.st-pending { background: #fef3c7; color: #d97706; }
.status-badge.st-paused { background: #f1f5f9; color: #64748b; }

.mini-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}

.mini-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: #f5f3ff;
}

.mini-btn.danger:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: #fef2f2;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.empty-text strong {
  display: block;
  font-size: 16px;
  color: #1e293b;
  margin-bottom: 4px;
}

.empty-text span {
  font-size: 13px;
  color: #94a3b8;
}

/* 按钮 */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.35);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ghost:hover {
  background: #f1f5f9;
  color: #1e293b;
}

/* 弹窗 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.dialog-card {
  background: #ffffff;
  border-radius: 16px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.dialog-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.dialog-head h3 {
  font-size: 17px;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 2px;
}

.dialog-head p {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.icon-close {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #f8fafc;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}

.icon-close:hover {
  background: #fee2e2;
  color: #ef4444;
}

.dialog-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 20px;
  border-top: 1px solid #f1f5f9;
}

/* 表单 */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.form-field label em {
  color: #ef4444;
  font-style: normal;
}

.text-input,
.select-input,
.textarea-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #1e293b;
  background: #ffffff;
  transition: all 0.15s;
  box-sizing: border-box;
  font-family: inherit;
}

.text-input:focus,
.select-input:focus,
.textarea-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.select-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}

.textarea-input {
  resize: vertical;
  min-height: 60px;
}

.platform-tag-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  width: fit-content;
}

@media (max-width: 640px) {
  .city-account-page {
    padding: 16px;
  }

  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .account-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .account-right {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
