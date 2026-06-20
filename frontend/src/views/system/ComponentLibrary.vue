<template>
  <div class="component-library">
    <!-- 顶部标题栏 -->
    <div class="page-head">
      <div class="head-left">
        <div class="eyebrow"><span class="dot"></span>组件库 · Component Library</div>
        <h1 class="head-title">
          基础组件库
          <span class="head-sub">可复用的 UI 组件，支持函数式和标签式两种用法。</span>
        </h1>
      </div>
      <div class="head-right">
        <div class="cl-search">
          <el-icon :size="15"><Search /></el-icon>
          <input v-model="search" placeholder="搜索组件..." />
        </div>
      </div>
    </div>

    <div class="cl-body">
      <!-- 左侧分类导航 -->
      <aside class="cl-sidebar">
        <div class="cl-sidebar-title">组件分类</div>
        <nav class="cl-nav">
          <a
            v-for="cat in categories"
            :key="cat.key"
            :class="['cl-nav-item', { active: activeCat === cat.key }]"
            @click="activeCat = cat.key"
          >
            <span class="cl-nav-icon">{{ cat.icon }}</span>
            <span class="cl-nav-label">{{ cat.label }}</span>
            <span class="cl-nav-count">{{ getCatCount(cat.key) }}</span>
          </a>
        </nav>
      </aside>

      <!-- 右侧组件展示区 -->
      <main class="cl-main">
        <div v-for="cat in pagedCategories" :key="cat.key" class="cl-cat-section">
          <div class="cl-cat-header">
            <h2 class="cl-cat-title">{{ cat.icon }} {{ cat.label }}</h2>
            <p class="cl-cat-desc">{{ cat.desc }}</p>
          </div>
          <div class="cl-grid">
            <div
              v-for="comp in cat.components"
              :key="comp.name"
              class="cl-card"
              @click="openPreview(comp)"
            >
              <div class="cl-card-preview">
                <component :is="comp.preview" />
              </div>
              <div class="cl-card-info">
                <h3 class="cl-card-name">{{ comp.label }}</h3>
                <p class="cl-card-desc">{{ comp.desc }}</p>
                <div class="cl-card-tags">
                  <span class="cl-tag" v-for="t in comp.tags" :key="t">{{ t }}</span>
                </div>
              </div>
              <div class="cl-card-actions">
                <button class="ghost-btn sm" @click.stop="openPreview(comp)">预览</button>
                <button class="primary-btn sm" @click.stop="copyCode(comp)">复制代码</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="cl-pagination" v-if="totalPages > 1">
          <button class="ghost-btn sm" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
          <span class="cl-page-info">{{ currentPage }} / {{ totalPages }}</span>
          <button class="ghost-btn sm" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
        </div>

        <div v-if="pagedCategories.length === 0" class="cl-empty">
          <span class="cl-empty-icon">🔍</span>
          <p>没有找到匹配的组件</p>
        </div>
      </main>
    </div>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      :title="previewComp?.label + ' · 预览'"
      width="680px"
      :append-to-body="true"
      class="cl-preview-dialog"
    >
      <div class="cl-preview-body">
        <div class="cl-preview-demo">
          <component :is="previewComp?.preview" />
        </div>
        <div class="cl-preview-code">
          <div class="cl-code-header">
            <span>示例代码</span>
            <button class="ghost-btn sm" @click="copyCode(previewComp)">复制</button>
          </div>
          <pre class="cl-code-block"><code>{{ previewComp?.code }}</code></pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * ComponentLibrary - 组件库展示页面
 * 所有 demo 组件均为真正可交互的 Vue 组件
 */
import { ref, computed, watch, h, defineComponent, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import ReText from '@/components/base/ReText.vue'
import ReCountTo from '@/components/base/ReCountTo.vue'
import ReFlop from '@/components/base/ReFlop.vue'
import ReQrcode from '@/components/base/ReQrcode.vue'
import ReCropper from '@/components/base/ReCropper.vue'
import { useDialog } from '@/hooks/useDialog.js'
import { useDrawer } from '@/hooks/useDrawer.js'
import BuilderComponentPreview from '@/layout-builder/BuilderComponentPreview.vue'
import { basicControls, layoutControls } from '@/layout-builder/componentPalette'
import ModuleFallbackCard from '@/layout-builder/ModuleFallbackCard.vue'
import { fieldBindingCatalog } from '@/layout-builder/fieldBindingCatalog'
import { layoutModuleCatalog, layoutPages } from '@/layout-builder/moduleCatalog'

const search = ref('')
const activeCat = ref('all')
const currentPage = ref(1)
const pageSize = 6
const previewVisible = ref(false)
const previewComp = ref(null)

// 分类切换/搜索时重置页码
watch([search, activeCat], () => { currentPage.value = 1 })

// ============================
// 真正可交互的 Demo 组件
// ============================

// ReDialog 演示：点击按钮真的打开 Dialog
const ReDialogDemo = defineComponent({
  setup() {
    const { openDialog } = useDialog()
    return () => h('div', { style: 'padding:20px;text-align:center;' }, [
      h('button', {
        style: 'padding:8px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;cursor:pointer;transition:all 0.15s;',
        onClick: () => openDialog({
          title: '函数式 Dialog 演示',
          width: '420px',
          content: () => h('div', { style: 'padding:24px;color:#374151;line-height:1.6;' },
            '这是通过 useDialog() 打开的函数式对话框。无需在模板中写 <el-dialog>，直接用 JS 调用。'
          ),
          sureText: '知道了',
          cancelText: '关闭',
          onSure: () => {}
        })
      }, '打开 Dialog')
    ])
  }
})

// ReDrawer 演示：点击按钮真的打开 Drawer
const ReDrawerDemo = defineComponent({
  setup() {
    const { openDrawer } = useDrawer()
    return () => h('div', { style: 'padding:20px;text-align:center;' }, [
      h('button', {
        style: 'padding:8px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;cursor:pointer;transition:all 0.15s;',
          onClick: () => openDrawer({
            title: '函数式 Drawer 演示',
            direction: 'rtl',
            size: '360px',
          content: () => h('div', { style: 'padding:24px;color:#374151;line-height:1.6;' },
            '这是通过 useDrawer() 打开的函数式抽屉，支持四个方向（left/right/top/bottom）。'
          )
        })
      }, '打开 Drawer')
    ])
  }
})

// ReCountTo 演示
function ReCountToDemo() {
  return h('div', { style: 'padding:20px;text-align:center;' }, [
    h(ReCountTo, { start: 0, end: 8848, duration: 2000, separator: ',', suffix: ' m' })
  ])
}

// ReQrcode 演示
function ReQrcodeDemo() {
  return h('div', { style: 'padding:20px;display:flex;justify-content:center;' }, [
    h(ReQrcode, { value: 'https://github.com', size: 140 })
  ])
}

// ReText 演示（容器窄，触发省略）
function ReTextDemo() {
  return h('div', { style: 'padding:20px;width:180px;' }, [
    h(ReText, { 'line-clamp': 2 }, () => '这是一段很长的文本内容，用于测试多行省略和 Tooltip 自动显示的效果，鼠标悬停可以看到完整内容。')
  ])
}

// ReFlop 演示
function ReFlopDemo() {
  return h('div', { style: 'padding:20px;display:flex;justify-content:center;' }, [
    h(ReFlop, { 'front-text': '点击翻转', 'back-text': '背面内容', style: 'width:120px;height:80px;' })
  ])
}

const makeLayoutBuilderDemo = (module) => defineComponent({
  setup() {
    return () => h('div', { style: 'padding:16px;min-height:220px;' }, [
      h(BuilderComponentPreview, { module })
    ])
  }
})

const toLibraryComponent = (module) => ({
  name: module.key,
  label: module.title,
  desc: module.config?.helpText || '页面布局可拖拽组件，支持在右侧配置字段、文案、默认值和展示宽度',
  tags: [module.key.startsWith('control-') ? '基础控件' : '布局控件', '页面布局'],
  preview: makeLayoutBuilderDemo(module),
  code: `<PageLayoutModule type="${module.key}" title="${module.title}" />`
})

const businessGroups = layoutPages
  .map((page) => {
    const modules = layoutModuleCatalog[page.key] || []
    return {
      key: `business-${page.key}`,
      label: page.label,
      icon: page.scope === 'city' ? '🏙️' : '📌',
      desc: page.description,
      components: modules.map((module) => ({
        name: `${page.key}-${module.key}`,
        label: module.title,
        desc: `${page.label}页面组件，可在页面布局中拖动、隐藏、调整宽度和顺序`,
        tags: [page.scope === 'city' ? '城市端' : '管理端', page.label],
        preview: defineComponent({
          setup() {
            return () => h('div', { style: 'padding:16px;min-height:220px;' }, [
              h(ModuleFallbackCard, { module: { ...module, componentKey: module.key }, pageKey: page.key })
            ])
          }
        }),
        code: `<PageLayoutModule page="${page.key}" type="${module.key}" />`
      }))
    }
  })
  .filter((group) => group.components.length)

const FieldBindingDemo = (page, fields) => defineComponent({
  setup() {
    return () => h('div', { class: 'binding-demo' }, [
      h('div', { class: 'binding-demo-head' }, [
        h('strong', page.label),
        h('span', page.scope === 'city' ? '城市端' : '管理端')
      ]),
      h('div', { class: 'binding-demo-list' }, fields.slice(0, 5).map((field) => h('div', { class: 'binding-demo-row' }, [
        h('code', field.field),
        h('span', field.label)
      ]))),
      fields.length > 5 ? h('small', `还有 ${fields.length - 5} 个字段`) : null
    ])
  }
})

const bindingComponents = layoutPages
  .map((page) => {
    const fields = fieldBindingCatalog[page.key] || []
    if (!fields.length) return null
    return {
      name: `binding-${page.key}`,
      label: `${page.label}字段绑定`,
      desc: fields.map((field) => `${field.field}：${field.effect}`).join('；'),
      tags: [page.scope === 'city' ? '城市端' : '管理端', '字段绑定'],
      preview: FieldBindingDemo(page, fields),
      code: fields.map((field) => `${field.field} // ${field.label}：${field.effect}`).join('\n')
    }
  })
  .filter(Boolean)

// ReCropper 演示：用内联 SVG 作为源图片（不依赖外部图片）
const ReCropperDemo = defineComponent({
  setup() {
    // 创建一个临时的图片 URL 用于演示
    const imgSrc = ref('')
    onMounted(() => {
      // 用 canvas 生成一张演示图片
      const c = document.createElement('canvas')
      c.width = 400; c.height = 300
      const ctx = c.getContext('2d')
      // 渐变背景
      const g = ctx.createLinearGradient(0, 0, 400, 300)
      g.addColorStop(0, '#6366f1')
      g.addColorStop(1, '#8b5cf6')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 400, 300)
      // 文字
      ctx.fillStyle = '#fff'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('裁剪演示图片', 200, 140)
      ctx.fillText('拖拽选区进行裁剪', 200, 170)
      imgSrc.value = c.toDataURL()
    })
    return () => imgSrc.value
      ? h(ReCropper, { src: imgSrc.value, style: 'max-height:280px;' })
      : h('div', { style: 'padding:20px;color:#9ca3af;font-size:13px;' }, '加载中...')
  }
})

// ============================
// 分类数据
// ============================
const categories = [
  {
    key: 'layout-basic',
    label: '页面布局 · 基础控件',
    icon: '🧩',
    desc: '和页面布局左侧完全一致的基础控件，可拖入任意页面并配置字段',
    components: basicControls.map(toLibraryComponent)
  },
  {
    key: 'layout-container',
    label: '页面布局 · 布局控件',
    icon: '▦',
    desc: '和页面布局左侧完全一致的布局容器，用于组织页面结构',
    components: layoutControls.map(toLibraryComponent)
  },
  {
    key: 'layout-bindings',
    label: '页面布局 · 字段绑定',
    icon: '🔗',
    desc: '页面布局组件可绑定的业务字段；选择对应字段后，控件值会驱动实际页面筛选或表单默认值',
    components: bindingComponents
  },
  ...businessGroups,
  {
    key: 'feedback',
    label: '反馈类',
    icon: '💬',
    desc: '对话框、抽屉、消息提示等交互反馈组件',
    components: [
      {
        name: 'ReDialog',
        label: '函数式 Dialog',
        desc: '通过 useDialog() 函数直接打开对话框，无需在模板中写 <el-dialog>',
        tags: ['函数式', 'Dialog'],
        preview: ReDialogDemo,
        code: `// 函数式打开 Dialog\nimport { useDialog } from '@/hooks/useDialog.js'\nconst { openDialog } = useDialog()\n\nopenDialog({\n  title: '提示',\n  content: () => h('div', '内容'),\n  width: '520px',\n  onSure: () => { /* 确认回调 */ }\n})`
      },
      {
        name: 'ReDrawer',
        label: '函数式 Drawer',
        desc: '通过 useDrawer() 函数直接打开抽屉，支持四个方向',
        tags: ['函数式', 'Drawer'],
        preview: ReDrawerDemo,
        code: `// 函数式打开 Drawer\nimport { useDrawer } from '@/hooks/useDrawer.js'\nconst { openDrawer } = useDrawer()\n\nopenDrawer({\n  title: '详情',\n  direction: 'right',\n  width: '400px',\n  content: () => h(MyComponent)\n})`
      }
    ]
  },
  {
    key: 'data',
    label: '数据展示',
    icon: '📊',
    desc: '数字动画、二维码、滚动等数据可视化组件',
    components: [
      {
        name: 'ReCountTo',
        label: '数字滚动',
        desc: '数字从起始值动画滚动到结束值，支持千分位格式化',
        tags: ['动画', '数字'],
        preview: ReCountToDemo,
        code: `<ReCountTo :start="0" :end="12345" :duration="2000" :separator="','" />`
      },
      {
        name: 'ReQrcode',
        label: '二维码生成',
        desc: '基于 Canvas 的二维码生成组件，支持自定义颜色和尺寸',
        tags: ['Canvas', '二维码'],
        preview: ReQrcodeDemo,
        code: `<ReQrcode value="https://example.com" :size="200" />`
      },
      {
        name: 'ReText',
        label: '文本省略',
        desc: '文本溢出时自动显示 Tooltip，支持多行省略',
        tags: ['文本', 'Tooltip'],
        preview: ReTextDemo,
        code: `<ReText :line-clamp="2" style="width:200px">\n  长文本内容...\n</ReText>`
      }
    ]
  },
  {
    key: 'media',
    label: '多媒体',
    icon: '🖼️',
    desc: '图片裁剪、翻牌动画等多媒体处理组件',
    components: [
      {
        name: 'ReCropper',
        label: '图片裁剪',
        desc: '基于 cropperjs 的图片裁剪，支持旋转、翻转、缩放、任意比例',
        tags: ['图片', '裁剪'],
        preview: ReCropperDemo,
        code: `<ReCropper src="/test.jpg" @crop="onCrop" />\n\n// onCrop 回调接收 { url, blob, canvas }\nfunction onCrop({ url, blob }) {\n  console.log(url, blob)\n}`
      },
      {
        name: 'ReFlop',
        label: '翻牌动画',
        desc: '点击翻转卡片，展示正反面内容，支持 v-model 控制',
        tags: ['动画', '交互'],
        preview: ReFlopDemo,
        code: `<ReFlop front-text="正面标题" back-text="背面内容" />`
      }
    ]
  }
]

// ============================
// 过滤 & 分页
// ============================
const filteredCategories = computed(() => {
  // "全部"：显示所有分类
  if (activeCat.value === 'all' && !search.value) return categories
  const kw = (search.value || '').toLowerCase()
  return categories
    .map(cat => {
      const comps = cat.components.filter(
        c => c.name.toLowerCase().includes(kw) || c.label.includes(kw) || c.desc.includes(kw)
      )
      return { ...cat, components: comps }
    })
    .filter(cat => activeCat.value === 'all' ? cat.components.length > 0 : cat.key === activeCat.value)
})

const totalPages = computed(() => Math.ceil(filteredCategories.value.length / pageSize) || 1)
const pagedCategories = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredCategories.value.slice(start, start + pageSize)
})

function getCatCount(key) {
  if (key === 'all') return categories.reduce((s, c) => s + c.components.length, 0)
  const cat = categories.find(c => c.key === key)
  return cat?.components.length || 0
}

function openPreview(comp) {
  previewComp.value = comp
  previewVisible.value = true
}

function copyCode(comp) {
  if (!comp?.code) return
  navigator.clipboard.writeText(comp.code).catch(() => {})
}
</script>

<style scoped>
/* ========== 整体容器 ========== */
.component-library {
  padding: 28px 36px 48px;
  min-height: 100vh;
  background: #f5f6fa;
}

/* ========== 顶部标题栏 ========== */
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
}
.head-left { flex: 1; }
.eyebrow {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
  display: inline-block;
}
.head-title {
  font-size: 26px;
  font-weight: 700;
  color: #111827;
  margin: 0;
  line-height: 1.3;
}
.head-sub {
  font-size: 14px;
  color: #9ca3af;
  font-weight: 400;
  margin-left: 8px;
}
.head-right { display: flex; align-items: center; gap: 12px; }

/* 搜索框 */
.cl-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 8px 14px;
  width: 220px;
  transition: border-color 0.2s, box-shadow 0.2s;
  color: #6b7280;
}
.cl-search:focus-within {
  border-color: #a5b4fc;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
.cl-search input {
  border: none;
  outline: none;
  font-size: 13px;
  color: #111827;
  background: transparent;
  width: 100%;
}
.cl-search input::placeholder { color: #9ca3af; }

/* ========== 主体布局 ========== */
.cl-body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* ========== 左侧分类导航 ========== */
.cl-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 16px;
  padding: 16px 0;
  border: 1px solid #ececf1;
  position: sticky;
  top: 20px;
}
.cl-sidebar-title {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 600;
  padding: 0 20px 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.cl-nav { display: flex; flex-direction: column; gap: 2px; }
.cl-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 13.5px;
  color: #4b5563;
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
  text-decoration: none;
}
.cl-nav-item:hover {
  background: #f5f3ff;
  color: #4338ca;
}
.cl-nav-item.active {
  background: linear-gradient(90deg, #eef2ff, #f5f3ff);
  border-left-color: #6366f1;
  color: #4338ca;
  font-weight: 500;
}
.cl-nav-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }
.cl-nav-label { flex: 1; }
.cl-nav-count {
  font-size: 11px;
  background: #f3f4f6;
  color: #6b7280;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 500;
}
.cl-nav-item.active .cl-nav-count {
  background: rgba(99, 102, 241, 0.12);
  color: #4338ca;
}

/* ========== 右侧主内容区 ========== */
.cl-main { flex: 1; min-width: 0; }
.cl-cat-section { margin-bottom: 36px; }
.cl-cat-header { margin-bottom: 16px; }
.cl-cat-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
  letter-spacing: -0.2px;
}
.cl-cat-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

/* ========== 组件卡片 ========== */
.cl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.cl-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #ececf1;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}
.cl-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
}
.cl-card-preview {
  padding: 8px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cl-card-info { padding: 16px 18px 12px; }
.cl-card-name {
  font-size: 14.5px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 6px;
  letter-spacing: -0.1px;
}
.cl-card-desc {
  font-size: 12.5px;
  color: #9ca3af;
  margin: 0 0 10px;
  line-height: 1.5;
}
.cl-card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.cl-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 500;
}
.cl-card-actions {
  display: flex;
  gap: 8px;
  padding: 0 18px 16px;
}
.binding-demo {
  width: 100%;
  padding: 14px;
  color: #0f172a;
}
.binding-demo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.binding-demo-head strong {
  font-size: 14px;
}
.binding-demo-head span {
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 700;
}
.binding-demo-list {
  display: grid;
  gap: 7px;
}
.binding-demo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 9px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fff;
}
.binding-demo-row code {
  color: #4f46e5;
  font-size: 12px;
  font-weight: 800;
}
.binding-demo-row span {
  color: #64748b;
  font-size: 12px;
}
.binding-demo small {
  display: block;
  margin-top: 8px;
  color: #94a3b8;
}

/* ========== 按钮 ========== */
.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  flex: 1;
}
.primary-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.primary-btn.sm { padding: 5px 12px; font-size: 12.5px; flex: none; }

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid #ececf1;
  background: #fff;
  color: #6b7280;
  flex: 1;
}
.ghost-btn:hover { border-color: #a5b4fc; color: #4338ca; background: #f5f3ff; }
.ghost-btn.sm { padding: 5px 12px; font-size: 12.5px; flex: none; }
.ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ========== 分页 ========== */
.cl-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 0;
}
.cl-page-info {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}

/* ========== 空状态 ========== */
.cl-empty {
  text-align: center;
  padding: 60px 0;
  color: #9ca3af;
  font-size: 14px;
}
.cl-empty-icon { font-size: 32px; display: block; margin-bottom: 12px; }

/* ========== 预览弹窗 ========== */
.cl-preview-body { max-height: 55vh; overflow-y: auto; }
.cl-preview-demo {
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
}
.cl-preview-code { }
.cl-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12.5px;
  color: #6b7280;
  font-weight: 500;
}

/* ========== 代码块 ========== */
.cl-code-block {
  background: #111827;
  color: #a5f3fc;
  padding: 16px 20px;
  border-radius: 12px;
  font-size: 12.5px;
  line-height: 1.7;
  overflow-x: auto;
  margin: 0;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  tab-size: 2;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
