/**
 * 函数式 Dialog Hook
 * 参考 vue-pure-admin 的 useDialog 思路，但用项目自己的 JS 风格实现
 * 用法：const { openDialog, closeDialog } = useDialog(options)
 */
import { h, render, ref } from 'vue'
import { ElDialog, ElButton, ElIcon } from 'element-plus'

export function useDialog(options = {}) {
  const instanceRef = ref(null)
  let vnode = null
  let container = null

  function openDialog(overrideOptions = {}) {
    const opts = { ...defaultOptions, ...options, ...overrideOptions }
    if (instanceRef.value) {
      closeDialog()
    }
    container = document.createElement('div')
    container.className = 'yun-jsx-portal'
    document.body.appendChild(container)

    const close = (args) => {
      opts.onClose?.(args)
      closeDialog()
    }

    const sure = (args) => {
      opts.onSure?.(args)
      if (opts.closeOnSure !== false) {
        close(args)
      }
    }

    const footerVNode = opts.hideFooter
      ? null
      : opts.footerRenderer
        ? opts.footerRenderer({ options: opts, close, sure })
        : h('div', { class: 'yun-dialog-footer' }, [
            h(ElButton, { onClick: () => close({ command: 'cancel' }) }, () => opts.cancelText),
            h(ElButton, {
              type: 'primary',
              loading: sureLoading.value,
              onClick: () => {
                if (opts.beforeSure) {
                  opts.beforeSure(sure, { options: opts, close })
                } else {
                  sure({ command: 'sure' })
                }
              }
            }, () => opts.sureText)
          ])

    const dialogProps = {
      modelValue: true,
      title: opts.title,
      width: opts.width,
      top: opts.top,
      appendToBody: true,
      destroyOnClose: true,
      class: 'yun-dialog',
      'onUpdate:modelValue': (val) => {
        if (!val) close({ command: 'close' })
      }
    }

    if (opts.fullscreen !== undefined) dialogProps.fullscreen = opts.fullscreen
    if (opts.draggable !== undefined) dialogProps.draggable = opts.draggable
    if (opts.closeOnClickModal !== undefined) dialogProps.closeOnClickModal = opts.closeOnClickModal

    const contentVNode = typeof opts.content === 'function'
      ? opts.content({ options: opts, close, sure })
      : opts.content

    const children = {}
    if (contentVNode) {
      children.default = () => [contentVNode]
    }
    if (footerVNode) {
      children.footer = () => [footerVNode]
    }
    if (opts.headerRenderer) {
      children.header = (scope) => [opts.headerRenderer({ ...scope, options: opts, close, sure })]
    }

    vnode = h(ElDialog, dialogProps, children)
    render(vnode, container)
    instanceRef.value = vnode

    return { close, sure }
  }

  function closeDialog() {
    if (container) {
      render(null, container)
      document.body.removeChild(container)
      container = null
      vnode = null
      instanceRef.value = null
    }
  }

  return { openDialog, closeDialog, dialogInstance: instanceRef }
}

const sureLoading = ref(false)

const defaultOptions = {
  title: '提示',
  width: '520px',
  top: '15vh',
  cancelText: '取消',
  sureText: '确定',
  hideFooter: false,
  closeOnSure: true,
  closeOnClickModal: false,
  fullscreen: false,
  draggable: false,
  content: null,
  footerRenderer: null,
  headerRenderer: null,
  onClose: null,
  onSure: null,
  beforeSure: null
}
