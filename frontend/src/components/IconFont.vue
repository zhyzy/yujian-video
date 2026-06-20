<template>
  <span
    class="app-icon"
    :class="customClass"
    :style="iconStyle"
    aria-hidden="true"
  >
    <i class="iconfont app-icon__font" :class="resolvedClass" :style="{ color: computedColor }"></i>
    <el-icon v-if="fallback" class="app-icon__fallback">
      <component :is="fallback" />
    </el-icon>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { getPlatformIcon, getVideoTypeIcon } from '@/utils/iconMapping'

const props = defineProps({
  // 通用名称（兼容旧用法）
  name: { type: String, default: '' },
  // 平台 key：douyin / kuaishou / weixin / xiaohongshu
  platform: { type: String, default: '' },
  // 视频类型名：招商类 / 技师类 / 剧情类 / 服务展示
  typeName: { type: String, default: '' },
  // 自定义 iconfont class（直接指定）
  icon: { type: String, default: '' },
  // 图标颜色
  color: { type: String, default: '' },
  // 自定义 class
  customClass: { type: String, default: '' },
  fallback: { type: [Object, Function], default: null }
})

const iconCandidates = {
  dashboard: ['icon-gongzuotai', 'icon-shouye', 'icon-home', 'icon-dashboard'],
  materialEntry: ['icon-sucailuru', 'icon-shangchuan', 'icon-bianji', 'icon-edit'],
  materialList: ['icon-sucailiebiao', 'icon-sucai', 'icon-wenjian', 'icon-file'],
  materialType: ['icon-fenlei', 'icon-leixing', 'icon-category', 'icon-grid'],
  calendar: ['icon-rili', 'icon-calendar', 'icon-paiqi'],
  publishPlan: ['icon-fabujihua', 'icon-jihua', 'icon-list', 'icon-renwu'],
  ledger: ['icon-taizhang', 'icon-zhangdan', 'icon-mingxi', 'icon-tickets'],
  cityBoard: ['icon-chengshikanban', 'icon-kanban', 'icon-monitor', 'icon-chengshi'],
  cityManage: ['icon-chengshiguanli', 'icon-chengshi', 'icon-dingwei', 'icon-location'],
  data: ['icon-shuju', 'icon-tongji', 'icon-fenxi', 'icon-data'],
  ai: ['icon-ai', 'icon-zhineng', 'icon-jiqiren', 'icon-magic'],
  hqAccount: ['icon-zongbuzhanghao', 'icon-zongbu', 'icon-gongsi', 'icon-zhanghao'],
  cityAccount: ['icon-chengshizhanghao', 'icon-chengshi', 'icon-dingwei', 'icon-zhanghao'],
  otherAccount: ['icon-qitazhanghao', 'icon-qita', 'icon-collection', 'icon-zhanghao'],
  search: ['icon-sousuo', 'icon-search'],
  notice: ['icon-tongzhi', 'icon-xiaoxi', 'icon-bell'],
  user: ['icon-yonghu', 'icon-user'],
  add: ['icon-xinzeng', 'icon-add', 'icon-plus'],
  edit: ['icon-bianji', 'icon-edit'],
  delete: ['icon-shanchu', 'icon-delete'],
  close: ['icon-guanbi', 'icon-close'],
  link: ['icon-lianjie', 'icon-link'],
  settings: ['icon-xitongshezhi', 'icon-shezhi', 'icon-setting', 'icon-system'],
  brand: ['icon-logo', 'icon-pinpaiguanli', 'icon-pinpai', 'icon-brand'],
  text: ['icon-wenzi', 'icon-biaoti', 'icon-text'],
  account: ['icon-zhanghao', 'icon-yonghu', 'icon-user'],
  fields: ['icon-ziduan', 'icon-liebiao', 'icon-list'],
  save: ['icon-baocun', 'icon-save'],
  reset: ['icon-zhongzhi', 'icon-shuaxin', 'icon-reset'],
  upload: ['icon-shangchuan'],
  uploadFolder: ['icon-shangchuanwenjianjia'],
  verified: ['icon-guanfangrenzheng']
}

const resolvedClass = computed(() => {
  // 优先级：platform > typeName > icon > name
  if (props.platform) return getPlatformIcon(props.platform)
  if (props.typeName) return getVideoTypeIcon(props.typeName)
  if (props.icon) return props.icon
  if (props.name) return iconCandidates[props.name] || [`icon-${props.name}`]
  return ''
})

const computedColor = computed(() => {
  if (props.color) return props.color
  return ''
})

const iconStyle = computed(() => {
  if (props.color) return { color: props.color }
  return {}
})
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.app-icon__font {
  font-size: 16px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
/* 平台图标默认稍大 */
.app-icon .icon-douyinzhanghao,
.app-icon .icon-ks,
.app-icon .icon-shipinhao,
.app-icon .icon-xiaohongshu {
  font-size: 17px;
}
/* 类型图标默认稍大 */
.app-icon .icon-zhaoshangjiameng,
.app-icon .icon-meinv,
.app-icon .icon-juqing,
.app-icon .icon-yangsheng,
.app-icon .icon-tiaowu,
.app-icon .icon-guanfangrenzheng {
  font-size: 18px;
}
</style>
