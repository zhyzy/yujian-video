import * as XLSX from 'xlsx'

/**
 * 导出数据为 Excel 文件
 * @param {Array} data - 数据数组，每个元素是一个对象
 * @param {Array} columns - 列配置 [{key: 'field', label: '标题', width: 15}]
 * @param {string} filename - 文件名（不含扩展名）
 * @param {string} sheetName - 工作表名称
 */
export const exportToExcel = (data, columns, filename = '导出数据', sheetName = 'Sheet1') => {
  if (!data || !data.length) {
    throw new Error('没有数据可导出')
  }

  // 构建表头
  const headers = columns.map(col => col.label || col.key)

  // 构建数据行
  const rows = data.map(item => {
    return columns.map(col => {
      const value = getNestedValue(item, col.key)

      // 格式化日期
      if (col.type === 'date' && value) {
        return formatDate(value, col.format || 'YYYY-MM-DD')
      }

      // 格式化布尔值
      if (col.type === 'boolean') {
        return value ? '是' : '否'
      }

      // 格式化枚举
      if (col.enum && col.key) {
        return col.enum[value] || value || ''
      }

      return value ?? ''
    })
  })

  // 合并表头和数据
  const exportData = [headers, ...rows]

  // 创建工作簿
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(exportData)

  // 设置列宽
  if (columns.some(col => col.width)) {
    ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }))
  }

  // 添加工作表
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // 导出文件
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * 导入 Excel 文件
 * @param {File} file - 文件对象
 * @param {Object} options - 配置选项
 * @returns {Promise<Array>} 解析后的数据数组
 */
export const importFromExcel = (file, options = {}) => {
  const {
    header = 0, // 表头行索引
    skipEmpty = true, // 跳过空行
    parseDate = true, // 解析日期
    dateFormat = 'YYYY-MM-DD' // 日期格式
  } = options

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        // 获取第一个工作表
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        // 转换为 JSON
        let jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          header,
          skipBlankRows: skipEmpty
        })

        // 处理表头
        if (header === 0 && jsonData.length > 0) {
          const headers = jsonData[0]
          jsonData = jsonData.slice(1).map(row => {
            const obj = {}
            headers.forEach((header, index) => {
              let value = row[index]

              // 解析日期
              if (parseDate && isExcelDate(value)) {
                value = parseExcelDate(value)
              }

              obj[header] = value
            })
            return obj
          })
        }

        // 移除空行
        if (skipEmpty) {
          jsonData = jsonData.filter(row =>
            Object.values(row).some(v => v !== '' && v !== null && v !== undefined)
          )
        }

        resolve(jsonData)
      } catch (error) {
        reject(new Error(`解析 Excel 文件失败: ${error.message}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('读取文件失败'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * 导出多个 sheet 的 Excel
 * @param {Array} sheets - [{name: 'Sheet1', data: [], columns: []}]
 * @param {string} filename - 文件名
 */
export const exportMultiSheetExcel = (sheets, filename = '导出数据') => {
  const wb = XLSX.utils.book_new()

  sheets.forEach(sheet => {
    const { name, data, columns } = sheet
    if (!data || !data.length) return

    const headers = columns.map(col => col.label || col.key)
    const rows = data.map(item =>
      columns.map(col => getNestedValue(item, col.key))
    )

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    if (columns.some(col => col.width)) {
      ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }))
    }

    XLSX.utils.book_append_sheet(wb, ws, name)
  })

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ==================== 辅助函数 ====================

/**
 * 获取嵌套对象属性值
 */
const getNestedValue = (obj, path) => {
  if (!path) return obj
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj)
}

/**
 * 格式化日期
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return ''

  const d = new Date(date)
  if (isNaN(d.getTime())) return date

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 判断是否是 Excel 日期序列号
 */
const isExcelDate = (value) => {
  return typeof value === 'number' && value > 25569 && value < 2958465
}

/**
 * 解析 Excel 日期序列号
 */
const parseExcelDate = (serial) => {
  const utcDays = serial - 25569
  const utcValue = utcDays * 86400
  const dateInfo = new Date(utcValue * 1000)
  return dateInfo.toISOString().slice(0, 10)
}

// 导出工具函数
export default {
  exportToExcel,
  importFromExcel,
  exportMultiSheetExcel
}
