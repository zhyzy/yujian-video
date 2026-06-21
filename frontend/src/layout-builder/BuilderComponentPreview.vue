<template>
  <section class="builder-preview" :class="{ layout: isLayout }">
    <header v-if="!['layout-divider'].includes(key)">
      <div>
        <h3>{{ module.title }}</h3>
        <p>{{ config.helpText || description }}</p>
      </div>
      <b v-if="config.required">必填</b>
    </header>

    <div v-if="isDataOverviewHero" class="data-hero-preview">
      <div>
        <span>数据中心 · 实时概览</span>
        <strong>数据总览</strong>
        <p>2026/6/15 - 2026/6/21 · 基于 186 条上报数据综合分析</p>
      </div>
      <div class="preview-range">
        <i>7 天</i><i>30 天</i><i>90 天</i><i>本年</i>
      </div>
    </div>

    <div v-else-if="isDataOverviewSummary" class="data-kpi-preview">
      <div class="preview-kpi hero">
        <span>总播放量</span>
        <strong>53.9 万</strong>
        <em></em>
      </div>
      <div v-for="item in dataKpis" :key="item.label" class="preview-kpi">
        <i :class="item.class"></i>
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div v-else-if="isDataOverviewCharts" class="preview-chart-grid">
      <div class="preview-chart-card">
        <strong>播放趋势分析</strong>
        <span>按日聚合播放量走势</span>
        <div class="preview-line-chart">
          <i v-for="n in 8" :key="n"></i>
        </div>
      </div>
      <div class="preview-chart-card donut">
        <strong>平台占比</strong>
        <span>按平台统计播放量份额</span>
        <div class="preview-donut"><b>53.9 万</b><small>总播放</small></div>
      </div>
    </div>

    <div v-else-if="isDataOverviewAccounts" class="preview-account-grid">
      <div v-for="item in previewAccounts" :key="item.name" class="preview-account-card">
        <strong>{{ item.name }}</strong>
        <span>{{ item.platform }}</span>
        <div>
          <i>播放<br>{{ item.views }}</i>
          <i>点赞<br>{{ item.likes }}</i>
          <i>评论<br>{{ item.comments }}</i>
          <i>成交<br>0</i>
        </div>
      </div>
    </div>

    <div v-else-if="isDataOverviewDetail" class="preview-data-table">
      <div class="preview-table-head">
        <span>日期</span><span>视频 / 账号</span><span>播放</span><span>点赞</span><span>评论</span>
      </div>
      <div v-for="row in previewRows" :key="row.title" class="preview-table-row">
        <span>{{ row.date }}</span><strong>{{ row.title }}</strong><span>{{ row.views }}</span><span>{{ row.likes }}</span><span>{{ row.comments }}</span>
      </div>
    </div>

    <div v-else-if="key === 'control-checkbox'" class="field-line">
      <el-checkbox v-model="checkboxValue">{{ config.label || module.title }}</el-checkbox>
    </div>

    <div v-else-if="key === 'control-color'" class="field-line color-line">
      <el-color-picker v-model="colorValue" show-alpha :predefine="predefineColors" />
      <span>{{ colorValue }}</span>
    </div>

    <div v-else-if="key === 'control-date'" class="field-line">
      <el-date-picker v-model="dateValue" type="date" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-datetime'" class="field-line">
      <el-date-picker v-model="dateTimeValue" type="datetime" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-counter'" class="field-line">
      <el-input-number v-model="numberValue" :min="Number(config.min ?? 0)" :max="Number(config.max ?? 999)" />
    </div>

    <div v-else-if="key === 'control-radio'" class="field-line">
      <el-radio-group v-model="singleValue">
        <el-radio v-for="option in options" :key="option" :value="option">{{ option }}</el-radio>
      </el-radio-group>
    </div>

    <div v-else-if="key === 'control-select'" class="field-line">
      <el-select v-model="singleValue" :placeholder="placeholder">
        <el-option v-for="option in options" :key="option" :label="option" :value="option" />
      </el-select>
    </div>

    <div v-else-if="key === 'control-multi-select'" class="field-line">
      <el-select v-model="multiValue" multiple :placeholder="placeholder">
        <el-option v-for="option in options" :key="option" :label="option" :value="option" />
      </el-select>
    </div>

    <div v-else-if="key === 'control-slider'" class="field-line slider-line">
      <el-slider v-model="numberValue" :min="Number(config.min ?? 0)" :max="Number(config.max ?? 100)" show-input />
    </div>

    <div v-else-if="key === 'control-switch'" class="field-line">
      <el-switch v-model="checkboxValue" active-text="开启" inactive-text="关闭" />
    </div>

    <div v-else-if="key === 'control-input'" class="field-line">
      <el-input v-model="textValue" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-textarea'" class="field-line">
      <el-input v-model="textValue" type="textarea" :rows="3" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-time'" class="field-line">
      <el-time-picker v-model="timeValue" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-rich-text'" class="rich-text-box">
      <div class="rich-toolbar"><i>B</i><i>I</i><i>H1</i><i>链接</i><i>图片</i></div>
      <div class="rich-body" contenteditable="true">{{ textValue }}</div>
    </div>

    <div v-else-if="key === 'control-json'" class="json-box">
      <pre>{{ formattedJson }}</pre>
    </div>

    <div v-else-if="key === 'layout-divider'" class="divider-preview">
      <span>{{ config.label || module.title }}</span>
    </div>

    <el-alert
      v-else-if="key === 'layout-alert'"
      :title="config.label || module.title"
      :description="config.helpText || '用于在页面中展示重要提醒、操作说明或状态提示。'"
      :type="config.alertType || 'info'"
      show-icon
      :closable="false"
    />

    <el-tabs v-else-if="key === 'layout-tabs'" class="tabs-preview" model-value="tab1">
      <el-tab-pane v-for="option in options.slice(0, 4)" :key="option" :label="option" :name="option">
        <div class="tab-content">{{ option }}内容区，可继续承载业务模块。</div>
      </el-tab-pane>
    </el-tabs>

    <el-collapse v-else-if="key === 'layout-collapse'" model-value="panel1">
      <el-collapse-item title="基础信息" name="panel1">
        <div class="collapse-content">这里展示折叠面板内容。</div>
      </el-collapse-item>
      <el-collapse-item title="更多设置" name="panel2">
        <div class="collapse-content">支持把说明、表单或列表收纳起来。</div>
      </el-collapse-item>
    </el-collapse>

    <div v-else-if="key === 'layout-grid'" class="grid-preview" :style="{ gridTemplateColumns: `repeat(${Number(config.columns || 3)}, minmax(0, 1fr))` }">
      <i v-for="n in Number(config.columns || 3) * 2" :key="n"></i>
    </div>

    <div v-else-if="key === 'layout-table'" class="table-preview">
      <table>
        <thead><tr><th>字段</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="row in ['素材审核', '发布计划', '数据回填']" :key="row">
            <td>{{ row }}</td><td>正常</td><td>查看</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getLayoutBindingKey, getLayoutBindingValue, setLayoutBindingValue } from './layoutBindings'

const props = defineProps({
  module: { type: Object, required: true },
  pageKey: { type: String, default: '' }
})

const key = computed(() => props.module.componentKey || props.module.key || '')
const config = computed(() => props.module.config || {})
const fieldName = computed(() => getLayoutBindingKey(props.module))
const isLayout = computed(() => key.value.startsWith('layout-'))
const placeholder = computed(() => config.value.placeholder || `请输入${props.module.title}`)
const options = computed(() => String(config.value.options || '选项一\n选项二\n选项三').split(/\n|,/).map((item) => item.trim()).filter(Boolean))
const description = computed(() => isLayout.value ? '页面结构与内容容器' : '可配置表单控件')
const isDataOverview = computed(() => props.pageKey === 'dataOverview')
const isDataOverviewHero = computed(() => isDataOverview.value && key.value === 'page-head')
const isDataOverviewSummary = computed(() => isDataOverview.value && key.value === 'summary-row')
const isDataOverviewCharts = computed(() => isDataOverview.value && key.value === 'chart-panel')
const isDataOverviewAccounts = computed(() => isDataOverview.value && key.value === 'account-overview-panel')
const isDataOverviewDetail = computed(() => isDataOverview.value && key.value === 'data-detail-panel')
const dataKpis = [
  { label: '总点赞', value: '4,420', class: 'pink' },
  { label: '总评论', value: '620', class: 'amber' },
  { label: '成交单数', value: '0', class: 'green' },
  { label: '视频总数', value: '186 条', class: 'cyan' }
]
const previewAccounts = [
  { name: '遇见约到家', platform: '快手', views: '31.3 万', likes: '3,640', comments: '520' },
  { name: '遇见约到家', platform: '视频号', views: '22.1 万', likes: '620', comments: '100' }
]
const previewRows = [
  { date: '06-21', title: '兰州 · 小熊的安妮', views: '9.4 万', likes: '1,092', comments: '156' },
  { date: '06-20', title: '太原 · 遇见向阳而生', views: '6.6 万', likes: '186', comments: '30' }
]

const initialValue = (fallback) => getLayoutBindingValue(props.pageKey, fieldName.value, fallback)
const checkboxValue = ref(Boolean(initialValue(config.value.defaultValue ?? true)))
const colorValue = ref(initialValue(config.value.defaultValue || '#6366f1'))
const dateValue = ref(initialValue(config.value.defaultValue || ''))
const dateTimeValue = ref(initialValue(config.value.defaultValue || ''))
const numberValue = ref(Number(initialValue(config.value.defaultValue ?? 30)))
const singleValue = ref(initialValue(config.value.defaultValue || options.value[0] || ''))
const multiValue = ref(initialValue(Array.isArray(config.value.defaultValue) ? config.value.defaultValue : options.value.slice(0, 2)))
const textValue = ref(initialValue(config.value.defaultValue || '这是一段可编辑内容'))
const timeValue = ref(initialValue(config.value.defaultValue || ''))

const predefineColors = ['#4f46e5', '#10b981', '#f97316', '#ef4444', '#111827', '#f8fafc']
const formattedJson = computed(() => {
  try {
    return JSON.stringify(JSON.parse(config.value.defaultValue || '{"status":200,"title":"页面组件","enabled":true}'), null, 2)
  } catch {
    return config.value.defaultValue || '{}'
  }
})

watch(config, () => {
  textValue.value = config.value.defaultValue || textValue.value
})

const bindValue = (source) => {
  watch(source, (value) => {
    setLayoutBindingValue(props.pageKey, fieldName.value, value)
  }, { deep: true })
}

;[
  checkboxValue,
  colorValue,
  dateValue,
  dateTimeValue,
  numberValue,
  singleValue,
  multiValue,
  textValue,
  timeValue
].forEach(bindValue)
</script>

<style scoped>
.builder-preview {
  height: 100%;
  min-height: 200px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.builder-preview.layout {
  background: #f9fafb;
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
h3,
p {
  margin: 0;
}
h3 {
  color: #0f172a;
  font-size: 15px;
}
p {
  margin-top: 5px;
  color: #8a91a4;
  font-size: 13px;
}
header b {
  padding: 4px 8px;
  border-radius: 8px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 12px;
}
.field-line {
  display: flex;
  align-items: center;
  gap: 12px;
}
.field-line :deep(.el-select),
.field-line :deep(.el-input),
.field-line :deep(.el-date-editor),
.field-line :deep(.el-input-number) {
  width: 100%;
}
.color-line span {
  color: #64748b;
  font-size: 13px;
}
.slider-line {
  display: block;
}
.rich-text-box,
.json-box {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.rich-toolbar {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid #eef0f6;
  background: #f8fafc;
}
.rich-toolbar i {
  padding: 4px 7px;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}
.rich-body {
  min-height: 72px;
  padding: 12px;
  color: #334155;
  outline: 0;
}
.json-box pre {
  max-height: 150px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  color: #334155;
  font-size: 12px;
  line-height: 1.6;
}
.divider-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-weight: 900;
}
.divider-preview::before,
.divider-preview::after {
  content: "";
  height: 1px;
  flex: 1;
  background: #dfe3ec;
}
.tabs-preview :deep(.el-tabs__content) {
  padding-top: 8px;
}
.tab-content,
.collapse-content {
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
}
.grid-preview {
  display: grid;
  gap: 10px;
}
.grid-preview i {
  min-height: 56px;
  border: 1px dashed #c7d2fe;
  border-radius: 10px;
  background: #f8faff;
}
.table-preview table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 10px;
  font-size: 13px;
}
.table-preview th,
.table-preview td {
  padding: 10px;
  border-bottom: 1px solid #eef0f6;
  text-align: left;
}
.table-preview th {
  background: #f8fafc;
  color: #64748b;
}
.data-hero-preview {
  min-height: 150px;
  padding: 22px;
  border-radius: 18px;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: #fff;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.data-hero-preview span,
.data-hero-preview p {
  color: rgba(255, 255, 255, 0.78);
}
.data-hero-preview strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
}
.preview-range {
  display: flex;
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
}
.preview-range i {
  padding: 7px 10px;
  border-radius: 9px;
  color: #fff;
  font-size: 12px;
  font-style: normal;
}
.preview-range i:first-child {
  background: #fff;
  color: #4f46e5;
}
.data-kpi-preview {
  display: grid;
  grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.preview-kpi {
  min-height: 120px;
  padding: 16px;
  border: 1px solid #edf0f6;
  border-radius: 16px;
  background: #fff;
}
.preview-kpi.hero {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: #fff;
}
.preview-kpi span,
.preview-chart-card span {
  display: block;
  color: #8a91a4;
  font-size: 12px;
}
.preview-kpi.hero span {
  color: rgba(255, 255, 255, 0.82);
}
.preview-kpi strong {
  display: block;
  margin-top: 14px;
  color: #0f172a;
  font-size: 26px;
}
.preview-kpi.hero strong {
  color: #fff;
}
.preview-kpi i {
  display: block;
  width: 30px;
  height: 30px;
  margin-bottom: 12px;
  border-radius: 10px;
}
.preview-kpi i.pink { background: #ec4899; }
.preview-kpi i.amber { background: #f59e0b; }
.preview-kpi i.green { background: #10b981; }
.preview-kpi i.cyan { background: #06b6d4; }
.preview-kpi em {
  display: block;
  height: 3px;
  margin-top: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
}
.preview-chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 12px;
}
.preview-chart-card,
.preview-account-card,
.preview-data-table {
  padding: 16px;
  border: 1px solid #edf0f6;
  border-radius: 16px;
  background: #fff;
}
.preview-chart-card strong,
.preview-account-card strong {
  display: block;
  margin-bottom: 5px;
  color: #0f172a;
}
.preview-line-chart {
  height: 150px;
  margin-top: 18px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.preview-line-chart i {
  flex: 1;
  border-radius: 999px 999px 0 0;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.45), rgba(99, 102, 241, 0.05));
}
.preview-line-chart i:nth-child(1) { height: 28%; }
.preview-line-chart i:nth-child(2) { height: 44%; }
.preview-line-chart i:nth-child(3) { height: 62%; }
.preview-line-chart i:nth-child(4) { height: 74%; }
.preview-line-chart i:nth-child(5) { height: 66%; }
.preview-line-chart i:nth-child(6) { height: 83%; }
.preview-line-chart i:nth-child(7) { height: 58%; }
.preview-line-chart i:nth-child(8) { height: 36%; }
.preview-donut {
  width: 150px;
  height: 150px;
  margin: 22px auto 0;
  border: 22px solid #f1f5f9;
  border-top-color: #10b981;
  border-right-color: #f97316;
  border-radius: 50%;
  display: grid;
  place-items: center;
  text-align: center;
}
.preview-donut b,
.preview-donut small {
  grid-area: 1 / 1;
}
.preview-donut b {
  transform: translateY(-8px);
  color: #0f172a;
  font-size: 18px;
}
.preview-donut small {
  transform: translateY(16px);
  color: #8a91a4;
}
.preview-account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.preview-account-card span {
  color: #8a91a4;
  font-size: 12px;
}
.preview-account-card div {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}
.preview-account-card i {
  padding: 8px;
  border-radius: 10px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 12px;
  font-style: normal;
  text-align: center;
}
.preview-data-table {
  overflow: hidden;
}
.preview-table-head,
.preview-table-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 80px 80px 80px;
  gap: 10px;
  align-items: center;
}
.preview-table-head {
  padding: 12px;
  border-radius: 12px 12px 0 0;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}
.preview-table-row {
  padding: 14px 12px;
  border-top: 1px solid #eef0f6;
  color: #334155;
  font-size: 13px;
}
.preview-table-row strong {
  color: #0f172a;
}
</style>
