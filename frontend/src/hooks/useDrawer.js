/**
 * 函数式 Drawer Hook
 * 参考 vue-pure-admin 的 useDrawer 思路，JS 版本
 * 用法：const { openDrawer, closeDrawer } = useDrawer(options)
 */
import { h, render, ref } from 'vue'
import { ElDrawer, ElButton, ElPopconfirm } from 'element-plus'

const drawerStore = ref([])
let drawerIndex = 0

export function useDrawer(options = {}) {
  let container = null
  let currentIndex = -1

  function openDrawer(overrideOptions = {}) {
    const opts = { ...defaultOptions, ...options, ...overrideOptions }
    container = document.createElement('div')
    container.className = 'yun-drawer-portal'
    document.body.appendChild(container)

    currentIndex = drawerIndex++
    const drawerItem = { ...opts, visible: true, _index: currentIndex }
    drawerStore.value.push(drawerItem)

    const close = (args = { command: 'close' }) => {
      const idx = drawerStore.value.findIndex(d => d._index === currentIndex)
      if (idx !== -1) {
        drawerStore.value.splice(idx, 1)
      }
      opts.onClose?.(args)
      if (container) {
        render(null, container)
        if (container.parentNode) document.body.removeChild(container)
        container = null
      }
    }

    const sure = (args = { command: 'sure' }) => {
      if (opts.beforeSure) {
        opts.beforeSure(() => close(args), { options: opts, close })
      } else {
        close(args)
      }
    }

    const defaultFooterButtons = [
      {
        label: opts.cancelText,
        text: true,
        bg: true,
        btnClick: ({ drawer }) => {
          if (opts.beforeCancel) {
            opts.beforeCancel(() => close({ command: 'cancel' }), { options: opts, index: currentIndex })
          } else {
            close({ command: 'cancel' })
          }
        }
      },
      {
        label: opts.sureText,
        type: 'primary',
        text: true,
        bg: true,
        btnClick: ({ drawer }) => {
          if (opts.beforeSure) {
            opts.beforeSure(() => close({ command: 'sure' }), { options: opts, index: currentIndex })
          } else {
            close({ command: 'sure' })
          }
        }
      }
    ]

    const footerButtons = opts.footerButtons?.length > 0 ? opts.footerButtons : defaultFooterButtons

    const footerVNode = opts.hideFooter
      ? null
      : opts.footerRenderer
        ? opts.footerRenderer({ options: opts, index: currentIndex, close, sure })
        : h('div', { class: 'yun-drawer-footer' },
            footerButtons.map((btn, i) => {
              if (btn.popConfirm) {
                return h(ElPopconfirm, { ...btn.popConfirm, onConfirm: () => btn.btnClick?.({ drawer: { options: opts, index: currentIndex } }) },
                  { reference: () => h(ElButton, { ...btn, label: undefined }, () => btn.label) }
                )
              }
              return h(ElButton, {
                ...btn,
                label: undefined,
                onClick: () => btn.btnClick?.({ drawer: { options: opts, index: currentIndex } })
              }, () => btn.label)
            })
          )

    const contentVNode = typeof opts.content === 'function'
      ? opts.content({ options: opts, index: currentIndex, close, sure })
      : opts.content

    const drawerProps = {
      modelValue: true,
      title: opts.title,
      size: opts.size,
      direction: opts.direction,
      appendToBody: true,
      destroyOnClose: true,
      class: 'yun-drawer',
      'onUpdate:modelValue': (val) => {
        if (!val) close({ command: 'close' })
      },
      onOpened: () => opts.onOpen?.({ options: opts, index: currentIndex }),
      onClosed: () => close({ command: 'close' })
    }

    const children = {}
    if (contentVNode) {
      children.default = () => [contentVNode]
    }
    if (footerVNode) {
      children.footer = () => [footerVNode]
    }

    const vnode = h(ElDrawer, drawerProps, children)
    render(vnode, container)

    return { close, sure, index: currentIndex }
  }

  return { openDrawer, closeDrawer: () => {
    const idx = drawerStore.value.findIndex(d => d._index === currentIndex)
    if (idx !== -1) drawerStore.value.splice(idx, 1)
  }}
}

export { drawerStore }

const defaultOptions = {
  title: '详情',
  size: '420px',
  direction: 'rtl',
  cancelText: '取消',
  sureText: '确定',
  hideFooter: false,
  footerButtons: [],
  content: null,
  footerRenderer: null,
  headerRenderer: null,
  onOpen: null,
  onClose: null,
  beforeSure: null,
  beforeCancel: null
}
