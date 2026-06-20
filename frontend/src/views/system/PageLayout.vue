<template>
  <div class="page-layout-page">
    <header class="page-head">
      <div>
        <h1><IconFont name="layout" :fallback="Grid" /> 页面布局</h1>
        <p>拖入组件、绑定字段、调整页面展示。</p>
      </div>
      <div class="head-actions">
        <el-input v-model="snapshotRemark" class="remark-input" placeholder="本次保存备注，可选" clearable />
        <el-button @click="historyVisible = true">
          <IconFont name="history" :fallback="Clock" />
          布局历史
        </el-button>
        <el-button @click="resetAllLayouts">
          <IconFont name="reset" :fallback="RefreshLeft" />
          恢复默认
        </el-button>
        <el-button type="primary" @click="saveAll">
          <IconFont name="save" :fallback="Check" />
          保存布局
        </el-button>
      </div>
    </header>

    <PageLayoutEditor :settings="settings" />

    <el-drawer v-model="historyVisible" title="布局历史" size="420px">
      <div class="history-list">
        <div v-if="layoutHistory.length" class="history-tips">最近保留 10 次保存记录，可恢复布局和字段绑定值。</div>
        <article v-for="item in layoutHistory" :key="item.id" class="history-card">
          <div class="history-head">
            <strong>{{ item.remark || '布局快照' }}</strong>
            <span>{{ formatSnapshotTime(item.createdAt) }}</span>
          </div>
          <div class="history-meta">
            <span>{{ item.pageCount || 0 }} 页</span>
            <span>{{ item.visibleModuleCount || 0 }}/{{ item.moduleCount || 0 }} 模块显示</span>
            <span>{{ item.bindingCount || 0 }} 个绑定值</span>
          </div>
          <el-button type="primary" plain @click="restoreSnapshot(item)">恢复此版本</el-button>
        </article>
        <el-empty v-if="!layoutHistory.length" description="暂无布局历史，保存布局后会自动生成快照" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Clock, Grid, RefreshLeft } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import PageLayoutEditor from '@/layout-builder/PageLayoutEditor.vue'
import { buildDefaultLayouts, normalizeLayout } from '@/layout-builder/moduleCatalog'
import { clearPageLayoutBindings, layoutBindingState, replaceLayoutBindingState } from '@/layout-builder/layoutBindings'
import { addLayoutSnapshot, loadSystemSettings, persistSystemSettingsToRemote, saveSystemSettings, syncSystemSettingsFromRemote } from '@/utils/systemSettings'

const settings = reactive(loadSystemSettings())
const historyVisible = ref(false)
const snapshotRemark = ref('')
const layoutHistory = computed(() => Array.isArray(settings.layoutHistory) ? settings.layoutHistory : [])

const normalizeLayouts = () => {
  if (!settings.layouts) settings.layouts = buildDefaultLayouts()
  Object.keys(buildDefaultLayouts()).forEach((pageKey) => {
    settings.layouts[pageKey] = normalizeLayout(pageKey, settings.layouts[pageKey])
  })
}

const saveAll = async () => {
  normalizeLayouts()
  settings.layoutBindings = JSON.parse(JSON.stringify(layoutBindingState || {}))
  addLayoutSnapshot(settings, snapshotRemark.value.trim())
  const localHistory = JSON.parse(JSON.stringify(settings.layoutHistory || []))
  const next = await persistSystemSettingsToRemote(settings)
  Object.assign(settings, next)
  settings.layoutHistory = Array.isArray(settings.layoutHistory) && settings.layoutHistory.length
    ? settings.layoutHistory
    : localHistory
  normalizeLayouts()
  saveSystemSettings(settings)
  snapshotRemark.value = ''
  ElMessage.success('页面布局已保存到后台')
}

const formatSnapshotTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const restoreSnapshot = async (snapshot) => {
  await ElMessageBox.confirm('恢复后会覆盖当前页面布局和字段绑定值，是否继续？', '恢复布局版本', {
    type: 'warning',
    confirmButtonText: '恢复',
    cancelButtonText: '取消'
  })
  settings.layouts = JSON.parse(JSON.stringify(snapshot.layouts || buildDefaultLayouts()))
  settings.layoutBindings = JSON.parse(JSON.stringify(snapshot.layoutBindings || {}))
  replaceLayoutBindingState(settings.layoutBindings)
  normalizeLayouts()
  saveSystemSettings(settings)
  historyVisible.value = false
  ElMessage.success('已恢复历史布局，点击保存布局可同步到后台')
}

const resetAllLayouts = async () => {
  await ElMessageBox.confirm('恢复默认后会重置所有页面布局，是否继续？', '恢复默认布局', {
    type: 'warning',
    confirmButtonText: '恢复默认',
    cancelButtonText: '取消'
  })
  settings.layouts = buildDefaultLayouts()
  Object.keys(settings.layouts).forEach((pageKey) => clearPageLayoutBindings(pageKey))
  settings.layoutBindings = {}
  settings.layoutHistory = []
  const next = await persistSystemSettingsToRemote(settings)
  Object.assign(settings, next)
  normalizeLayouts()
  ElMessage.success('已恢复默认布局，并同步到后台')
}

onMounted(async () => {
  normalizeLayouts()
  try {
    const remote = await syncSystemSettingsFromRemote()
    Object.assign(settings, remote)
    normalizeLayouts()
    saveSystemSettings(settings)
  } catch (error) {
    ElMessage.warning(`后台布局配置加载失败，已使用本地缓存：${error?.message || '未知错误'}`)
  }
})
</script>

<style scoped>
.page-layout-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.page-head {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 16px;
}
.page-head h1 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 3px;
  color: #0f172a;
  font-size: 18px;
}
.page-head p {
  margin: 0;
  color: #7b8497;
  font-size: 12px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.remark-input {
  width: 210px;
}
.head-actions .el-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.history-tips {
  padding: 12px;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
  line-height: 1.6;
}
.history-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #eceff5;
  border-radius: 14px;
  background: #fff;
}
.history-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.history-head strong {
  color: #0f172a;
  font-size: 14px;
}
.history-head span {
  color: #94a3b8;
  font-size: 12px;
  white-space: nowrap;
}
.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.history-meta span {
  padding: 5px 8px;
  border-radius: 999px;
  background: #f5f6fa;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}
@media (max-width: 900px) {
  .page-head {
    align-items: stretch;
    flex-direction: column;
  }
  .remark-input {
    width: 100%;
  }
}
</style>
