const fetchImpl = globalThis.fetch;

const VOLCANO_ARK_API_URL = process.env.VOLCANO_ARK_API_URL || 'https://ark.cn-beijing.volces.com/api/coding/v3';
const MODEL = process.env.VOLCANO_ARK_MODEL || 'deepseek-v4-flash';
const AI_TIMEOUT_MS = Number(process.env.VOLCANO_ARK_TIMEOUT_MS || 45000);
const PROMPT_VERSION = 'ai-report-v2-fullsite-20260614';

const requireFetch = () => {
  if (!fetchImpl) {
    throw new Error('当前 Node 版本不支持 fetch，请升级到 Node 18+ 或安装 fetch polyfill');
  }
  return fetchImpl;
};

const num = (value) => Number(value || 0);
const safeJson = (value) => JSON.stringify(value, null, 2);

const getReportTitle = (type) => ({
  daily: '运营日报',
  weekly: '运营周报',
  monthly: '运营月报'
}[type] || '运营报告');

const platformLabel = (value) => ({
  douyin: '抖音',
  kuaishou: '快手',
  weixin: '视频号',
  xiaohongshu: '小红书',
  other: '其他'
}[value] || value || '其他');

const splitTextLines = (value) => String(value || '')
  .split(/\n+/)
  .map(item => item.trim().replace(/^[-•\d、.\s]+/, '').trim())
  .filter(Boolean);

const isUsefulDailyNote = (value = '') => {
  const text = String(value).trim();
  if (!text) return false;
  if (/^(你好|您好|在吗|测试|收到|好的|ok|OK|哈喽|hello|hi)$/i.test(text)) return false;
  if (/^(优化语言表达|补充数据指标|生成明日计划|精简摘要)$/.test(text)) return false;
  return /[\d一二三四五六七八九十]|完成|发布|剪辑|拍摄|上传|对接|跟进|协调|未完成|问题|准备|安排|数据|账号|城市|明日|今日/.test(text);
};

class AIService {
  constructor() {
    this.apiUrl = VOLCANO_ARK_API_URL.replace(/\/$/, '');
    this.apiKey = process.env.VOLCANO_ARK_API_KEY || '';
    this.model = MODEL;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async chat(messages, temperature = 0.35) {
    if (!this.isConfigured()) {
      throw new Error('AI 服务未配置，请设置 VOLCANO_ARK_API_KEY');
    }

    const fetch = requireFetch();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        stream: false
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API 调用失败：${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  collectReportData(db, startDate, endDate, type = 'daily') {
    const params = [startDate, endDate];
    const reportTitle = getReportTitle(type);

    const production = db.prepare(`
      SELECT
        COALESCE(SUM(shoot_count), 0) as shoot_count,
        COALESCE(SUM(edit_count), 0) as edit_count,
        COALESCE(SUM(upload_count), 0) as upload_count,
        COUNT(*) as material_records,
        SUM(CASE WHEN completion_status = 'completed' THEN 1 ELSE 0 END) as completed_records,
        SUM(CASE WHEN completion_status = 'planned' THEN 1 ELSE 0 END) as planned_records
      FROM materials
      WHERE date >= ? AND date <= ?
    `).get(...params);

    const materialFiles = db.prepare(`
      SELECT
        COUNT(*) as file_count,
        COALESCE(SUM(size), 0) as total_size
      FROM material_files
      WHERE status != 'deleted' AND date >= ? AND date <= ?
    `).get(...params);

    const schedule = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM schedules
      WHERE date >= ? AND date <= ?
    `).get(...params);

    const cityDistribution = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status IN ('distributed', 'confirmed') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status IN ('distributed', 'confirmed') AND date < date('now', 'localtime') THEN 1 ELSE 0 END) as overdue
      FROM city_distributions
      WHERE date >= ? AND date <= ?
    `).get(...params);

    const dataSummary = db.prepare(`
      WITH all_tracks AS (
        SELECT
          dt.date,
          COALESCE(a.platform, 'other') as platform,
          COALESCE(a.name, '') as account_name,
          COALESCE(dt.play_count, 0) as play_count,
          COALESCE(dt.like_count, 0) as like_count,
          COALESCE(dt.comment_count, 0) as comment_count,
          COALESCE(dt.deal_count, 0) as deal_count,
          COALESCE(dt.deal_amount, 0) as deal_amount,
          0 as favorite_count,
          0 as share_count
        FROM data_tracks dt
        LEFT JOIN accounts a ON dt.account_id = a.id
        UNION ALL
        SELECT
          COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
          COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') as platform,
          COALESCE(NULLIF(cd.publish_account_name, ''), a.name, '') as account_name,
          COALESCE(cd.play_count, 0) as play_count,
          COALESCE(cd.like_count, 0) as like_count,
          COALESCE(cd.comment_count, 0) as comment_count,
          COALESCE(cd.deal_count, 0) as deal_count,
          COALESCE(cd.deal_amount, 0) as deal_amount,
          COALESCE(cd.favorite_count, 0) as favorite_count,
          COALESCE(cd.share_count, 0) as share_count
        FROM city_distributions cd
        LEFT JOIN accounts a ON cd.account_id = a.id
        WHERE cd.status = 'published'
      )
      SELECT
        COUNT(*) as video_count,
        COALESCE(SUM(play_count), 0) as play_count,
        COALESCE(SUM(like_count), 0) as like_count,
        COALESCE(SUM(comment_count), 0) as comment_count,
        COALESCE(SUM(favorite_count), 0) as favorite_count,
        COALESCE(SUM(share_count), 0) as share_count,
        COALESCE(SUM(deal_count), 0) as deal_count,
        COALESCE(SUM(deal_amount), 0) as deal_amount
      FROM all_tracks
      WHERE date >= ? AND date <= ?
    `).get(...params);

    const typeStats = db.prepare(`
      SELECT
        vt.name as type_name,
        COALESCE(SUM(m.shoot_count), 0) as shoot_count,
        COALESCE(SUM(m.edit_count), 0) as edit_count,
        COALESCE(SUM(m.upload_count), 0) as upload_count
      FROM video_types vt
      LEFT JOIN materials m ON m.video_type_id = vt.id AND m.date >= ? AND m.date <= ?
      WHERE vt.status = 'active'
      GROUP BY vt.id, vt.name, vt.sort_order
      ORDER BY vt.sort_order ASC
      LIMIT 20
    `).all(...params);

    const staffStats = db.prepare(`
      SELECT
        COALESCE(NULLIF(m.staff_name, ''), s.name, '未指定') as staff_name,
        COALESCE(SUM(m.shoot_count), 0) as shoot_count,
        COALESCE(SUM(m.edit_count), 0) as edit_count,
        COALESCE(SUM(m.upload_count), 0) as upload_count,
        COUNT(*) as records
      FROM materials m
      LEFT JOIN staffs s ON m.staff_id = s.id
      WHERE m.date >= ? AND m.date <= ?
      GROUP BY staff_name
      ORDER BY shoot_count DESC, edit_count DESC
      LIMIT 10
    `).all(...params);

    const platformStats = db.prepare(`
      WITH all_tracks AS (
        SELECT dt.date, COALESCE(a.platform, 'other') as platform, COALESCE(dt.play_count, 0) as play_count,
               COALESCE(dt.like_count, 0) as like_count, COALESCE(dt.comment_count, 0) as comment_count,
               COALESCE(dt.deal_count, 0) as deal_count, COALESCE(dt.deal_amount, 0) as deal_amount
        FROM data_tracks dt
        LEFT JOIN accounts a ON dt.account_id = a.id
        UNION ALL
        SELECT COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
               COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') as platform,
               COALESCE(cd.play_count, 0), COALESCE(cd.like_count, 0), COALESCE(cd.comment_count, 0),
               COALESCE(cd.deal_count, 0), COALESCE(cd.deal_amount, 0)
        FROM city_distributions cd
        LEFT JOIN accounts a ON cd.account_id = a.id
        WHERE cd.status = 'published'
      )
      SELECT
        platform,
        COUNT(*) as video_count,
        COALESCE(SUM(play_count), 0) as play_count,
        COALESCE(SUM(like_count), 0) as like_count,
        COALESCE(SUM(comment_count), 0) as comment_count,
        COALESCE(SUM(deal_count), 0) as deal_count,
        COALESCE(SUM(deal_amount), 0) as deal_amount
      FROM all_tracks
      WHERE date >= ? AND date <= ?
      GROUP BY platform
      ORDER BY play_count DESC
      LIMIT 10
    `).all(...params);

    const cityStats = db.prepare(`
      SELECT
        c.name as city_name,
        COUNT(cd.id) as task_count,
        SUM(CASE WHEN cd.status = 'published' THEN 1 ELSE 0 END) as published_count,
        SUM(CASE WHEN cd.status IN ('distributed', 'confirmed') THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN cd.status IN ('distributed', 'confirmed') AND cd.date < date('now', 'localtime') THEN 1 ELSE 0 END) as overdue_count,
        COALESCE(SUM(cd.play_count), 0) as play_count,
        COALESCE(SUM(cd.like_count), 0) as like_count,
        COALESCE(SUM(cd.comment_count), 0) as comment_count,
        COALESCE(SUM(cd.deal_count), 0) as deal_count,
        COALESCE(SUM(cd.deal_amount), 0) as deal_amount
      FROM cities c
      LEFT JOIN city_distributions cd ON cd.city_id = c.id AND cd.date >= ? AND cd.date <= ?
      WHERE c.status = 'active'
      GROUP BY c.id, c.name
      HAVING task_count > 0
      ORDER BY published_count DESC, play_count DESC
      LIMIT 20
    `).all(...params);

    const accountStats = db.prepare(`
      WITH all_tracks AS (
        SELECT dt.date, a.id, a.name, a.platform, a.type,
               COALESCE(dt.play_count, 0) as play_count, COALESCE(dt.like_count, 0) as like_count,
               COALESCE(dt.comment_count, 0) as comment_count, COALESCE(dt.deal_count, 0) as deal_count,
               COALESCE(dt.deal_amount, 0) as deal_amount
        FROM data_tracks dt
        LEFT JOIN accounts a ON dt.account_id = a.id
        UNION ALL
        SELECT COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
               a.id, COALESCE(NULLIF(cd.publish_account_name, ''), a.name) as name,
               COALESCE(NULLIF(cd.publish_platform, ''), a.platform) as platform, a.type,
               COALESCE(cd.play_count, 0), COALESCE(cd.like_count, 0), COALESCE(cd.comment_count, 0),
               COALESCE(cd.deal_count, 0), COALESCE(cd.deal_amount, 0)
        FROM city_distributions cd
        LEFT JOIN accounts a ON cd.account_id = a.id
        WHERE cd.status = 'published'
      )
      SELECT
        COALESCE(name, '未指定账号') as account_name,
        COALESCE(platform, 'other') as platform,
        COALESCE(type, 'unknown') as type,
        COUNT(*) as video_count,
        COALESCE(SUM(play_count), 0) as play_count,
        COALESCE(SUM(like_count), 0) as like_count,
        COALESCE(SUM(comment_count), 0) as comment_count,
        COALESCE(SUM(deal_count), 0) as deal_count,
        COALESCE(SUM(deal_amount), 0) as deal_amount
      FROM all_tracks
      WHERE date >= ? AND date <= ?
      GROUP BY account_name, platform, type
      ORDER BY play_count DESC, deal_amount DESC
      LIMIT 15
    `).all(...params);

    const dailyTrend = db.prepare(`
      WITH date_rows AS (
        SELECT date FROM materials WHERE date >= ? AND date <= ?
        UNION
        SELECT date FROM schedules WHERE date >= ? AND date <= ?
        UNION
        SELECT date FROM city_distributions WHERE date >= ? AND date <= ?
        UNION
        SELECT date FROM data_tracks WHERE date >= ? AND date <= ?
      ),
      track_rows AS (
        SELECT date, play_count, like_count, comment_count, deal_count, deal_amount FROM data_tracks
        UNION ALL
        SELECT COALESCE(NULLIF(substr(actual_publish_time, 1, 10), ''), date) as date,
               play_count, like_count, comment_count, deal_count, deal_amount
        FROM city_distributions
        WHERE status = 'published'
      )
      SELECT
        d.date,
        COALESCE(m.shoot_count, 0) as shoot_count,
        COALESCE(s.publish_count, 0) as publish_count,
        COALESCE(cd.city_published, 0) as city_published,
        COALESCE(t.play_count, 0) as play_count,
        COALESCE(t.deal_count, 0) as deal_count,
        COALESCE(t.deal_amount, 0) as deal_amount
      FROM (SELECT DISTINCT date FROM date_rows) d
      LEFT JOIN (
        SELECT date, SUM(shoot_count) as shoot_count FROM materials GROUP BY date
      ) m ON m.date = d.date
      LEFT JOIN (
        SELECT date, COUNT(*) as publish_count FROM schedules WHERE status = 'published' GROUP BY date
      ) s ON s.date = d.date
      LEFT JOIN (
        SELECT date, COUNT(*) as city_published FROM city_distributions WHERE status = 'published' GROUP BY date
      ) cd ON cd.date = d.date
      LEFT JOIN (
        SELECT date, SUM(play_count) as play_count, SUM(deal_count) as deal_count, SUM(deal_amount) as deal_amount
        FROM track_rows
        GROUP BY date
      ) t ON t.date = d.date
      ORDER BY d.date
      LIMIT 45
    `).all(startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate);

    const accountOverview = db.prepare(`
      SELECT
        type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status != 'active' THEN 1 ELSE 0 END) as inactive
      FROM accounts
      GROUP BY type
    `).all();

    const operationLogs = db.prepare(`
      SELECT username, action, path, status_code, created_at
      FROM operation_logs
      WHERE created_at >= ? AND created_at <= datetime(?, '+1 day')
      ORDER BY created_at DESC
      LIMIT 20
    `).all(startDate, endDate);

    const derived = {
      publishCompletionRate: num(schedule.total) ? Number((num(schedule.published) / num(schedule.total) * 100).toFixed(1)) : 0,
      cityCompletionRate: num(cityDistribution.total) ? Number((num(cityDistribution.published) / num(cityDistribution.total) * 100).toFixed(1)) : 0,
      engagementRate: num(dataSummary.play_count)
        ? Number(((num(dataSummary.like_count) + num(dataSummary.comment_count) + num(dataSummary.favorite_count) + num(dataSummary.share_count)) / num(dataSummary.play_count) * 100).toFixed(2))
        : 0,
      dealRate: num(dataSummary.video_count) ? Number((num(dataSummary.deal_count) / num(dataSummary.video_count)).toFixed(2)) : 0
    };

    return {
      meta: {
        type,
        title: reportTitle,
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        promptVersion: PROMPT_VERSION,
        model: this.model,
        aiProvider: 'volcano-ark-openai-compatible'
      },
      summary: {
        production: {
          shootCount: num(production.shoot_count),
          editCount: num(production.edit_count),
          uploadCount: num(production.upload_count),
          materialRecords: num(production.material_records),
          completedRecords: num(production.completed_records),
          plannedRecords: num(production.planned_records),
          materialFileCount: num(materialFiles.file_count),
          materialFileSize: num(materialFiles.total_size)
        },
        schedule: {
          total: num(schedule.total),
          published: num(schedule.published),
          pending: num(schedule.pending),
          failed: num(schedule.failed)
        },
        cityDistribution: {
          total: num(cityDistribution.total),
          published: num(cityDistribution.published),
          pending: num(cityDistribution.pending),
          failed: num(cityDistribution.failed),
          overdue: num(cityDistribution.overdue)
        },
        performance: {
          videoCount: num(dataSummary.video_count),
          playCount: num(dataSummary.play_count),
          likeCount: num(dataSummary.like_count),
          commentCount: num(dataSummary.comment_count),
          favoriteCount: num(dataSummary.favorite_count),
          shareCount: num(dataSummary.share_count),
          dealCount: num(dataSummary.deal_count),
          dealAmount: Number(num(dataSummary.deal_amount).toFixed(2))
        },
        derived
      },
      details: {
        typeStats,
        staffStats,
        platformStats,
        cityStats,
        accountStats,
        dailyTrend,
        accountOverview,
        operationLogs
      }
    };
  }

  buildPrompt(data) {
    const context = data.meta.userContext || {};
    const isWorkSummary = context.reportStyle === 'work_summary';
    const contextText = [
      context.reportStyle ? `日报模板：${context.reportStyle === 'work_summary' ? '工作汇报型日报' : '数据复盘型报告'}` : '',
      context.department ? `所属部门：${context.department}` : '',
      context.project ? `关联项目：${context.project}` : '',
      context.tone ? `输出语气：${context.tone}` : '',
      context.length ? `篇幅要求：${context.length}` : '',
      Array.isArray(context.keywords) && context.keywords.length ? `关注关键词：${context.keywords.join('、')}` : '',
      context.notes ? `今日完成事项：\n${context.notes}` : '',
      context.unfinishedNotes ? `未完成工作：\n${context.unfinishedNotes}` : '',
      context.coordinationNotes ? `需协调工作：\n${context.coordinationNotes}` : '',
      Array.isArray(context.chatNotes) && context.chatNotes.length ? `对话补充内容：\n${context.chatNotes.filter(isUsefulDailyNote).map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
      Array.isArray(context.checkedItems) && context.checkedItems.length ? `用户确认需要覆盖的内容：${context.checkedItems.join('、')}` : ''
    ].filter(Boolean).join('\n\n');

    if (isWorkSummary) {
      return `请基于以下“全站运营数据”和“用户补充上下文”，生成一份可直接发送的中文工作汇报日报。

强制格式：
【${dayjs(data.meta.startDate).format('M月D日')}工作汇报】
1、...
2、...

【未完成工作】
...

【需协调工作】
无 或 具体事项

要求：
1. 必须是工作清单口吻，像员工每天发给负责人的日报，不要写“核心结论、分析、风险、建议”等报告化标题。
2. 每条尽量一行，简单直接，有具体数量就写数量。
3. 系统数据只用于补齐事实，不要编造不存在的城市、账号和数量。
4. 用户补充内容优先级最高，必须融合进对应条目。
5. 未完成工作和需协调工作如果用户没有明确提供，就根据待发布、城市待处理、超期和数据缺口谨慎生成；没有就写“无”。
6. 语气保持自然，可以使用顿号、括号和感叹号，但不要夸张。

用户补充上下文：
${contextText || '无'}

全站运营数据 JSON：
\`\`\`json
${safeJson(data)}
\`\`\``;
    }

    return `请基于以下“全站运营数据”生成一份专业的中文 ${data.meta.title}。

要求：
1. 输出 Markdown。
2. 先给 3-5 条“核心结论”，每条必须有数据依据。
3. 必须分析：素材生产、发布执行、城市下发与城市端填报、平台表现、账号表现、成交转化、异常风险。
4. 最后输出“下一步行动清单”，按优先级列出 5-8 条具体动作。
5. 不要编造不存在的数据。数据为 0 时要说明口径可能未填报或暂无数据。
6. 风格要像运营负责人写给管理层的日报，简洁、直接、可执行。
7. 如果用户补充了人工工作内容，请把它和系统数据融合，不要孤立罗列。
8. 不要把“你好、收到、测试、优化语言表达”等对话指令写进报告正文。

用户补充上下文：
${contextText || '无'}

全站运营数据 JSON：
\`\`\`json
${safeJson(data)}
\`\`\``;
  }

  localReport(data) {
    if (data.meta.userContext?.reportStyle === 'work_summary') {
      return this.localWorkSummaryReport(data);
    }

    const s = data.summary;
    const context = data.meta.userContext || {};
    const notes = [
      context.notes,
      ...(Array.isArray(context.chatNotes) ? context.chatNotes : [])
    ].filter(Boolean);
    const cityRisk = s.cityDistribution.overdue > 0
      ? `存在 **${s.cityDistribution.overdue}** 个城市下发任务超期未完成，需要立即跟进。`
      : '城市下发暂无超期任务，整体协同风险可控。';
    const performanceRisk = s.performance.videoCount === 0
      ? '周期内暂无发布数据或城市端尚未填报发布台账，数据总览口径不完整。'
      : `周期内共统计 **${s.performance.videoCount}** 条发布数据，总播放 **${s.performance.playCount}**，成交 **${s.performance.dealCount}** 单，成交金额 **¥${s.performance.dealAmount}**。`;

    const platformLines = data.details.platformStats.length
      ? data.details.platformStats.map(item => `- ${item.platform}：${item.video_count} 条，播放 ${item.play_count}，成交 ${item.deal_count} 单，金额 ¥${item.deal_amount}`).join('\n')
      : '- 暂无平台数据';

    const cityLines = data.details.cityStats.length
      ? data.details.cityStats.slice(0, 8).map(item => `- ${item.city_name}：任务 ${item.task_count}，已发布 ${item.published_count}，待处理 ${item.pending_count}，播放 ${item.play_count}，成交 ${item.deal_count} 单`).join('\n')
      : '- 暂无城市下发数据';

    return `# ${data.meta.startDate} 至 ${data.meta.endDate} ${data.meta.title}

## 核心结论
- 素材生产：拍摄 **${s.production.shootCount}** 条，剪辑 **${s.production.editCount}** 条，上传记录 **${s.production.uploadCount}** 条，素材文件 **${s.production.materialFileCount}** 个。
- 发布执行：总部排期共 **${s.schedule.total}** 条，已发布 **${s.schedule.published}** 条，完成率 **${s.derived.publishCompletionRate}%**。
- 城市协同：下发任务 **${s.cityDistribution.total}** 条，已发布 **${s.cityDistribution.published}** 条，完成率 **${s.derived.cityCompletionRate}%**。
- 数据表现：${performanceRisk}
${notes.length ? `- 人工补充：${notes[0]}` : ''}

${notes.length > 1 ? `## 今日人工补充\n${notes.map(item => `- ${item}`).join('\n')}\n` : ''}

## 素材生产分析
- 当前素材记录 **${s.production.materialRecords}** 条，已完成记录 **${s.production.completedRecords}** 条，待推进记录 **${s.production.plannedRecords}** 条。
- 如上传文件数低于拍摄/剪辑数量，需要核对素材是否已上传到系统。

## 发布执行分析
- 待发布 **${s.schedule.pending}** 条，失败 **${s.schedule.failed}** 条。
- 建议优先处理待发布和失败记录，避免素材积压。

## 城市下发与填报
${cityLines}

## 平台表现
${platformLines}

## 成交转化
- 成交单数 **${s.performance.dealCount}**，成交金额 **¥${s.performance.dealAmount}**，单视频平均成交 **${s.derived.dealRate}** 单。
- 互动率 **${s.derived.engagementRate}%**，建议结合高播放低成交账号做内容复盘。

## 异常风险
- ${cityRisk}
- 若播放、点赞、成交数据为 0，需检查城市端是否完成发布填报和数据录入。

## 下一步行动清单
1. 立即跟进超期城市下发任务，明确责任城市和截止时间。
2. 核对待发布排期，优先处理高优账号任务。
3. 要求城市端补齐发布链接、截图、播放量、成交金额。
4. 复盘播放靠前账号，提炼可复制选题。
5. 对高播放低成交内容补充成交转化动作。
6. 每日结束前统一核对素材、发布、数据三类口径。

> AI 服务未配置或不可用时，本报告由系统基于全站数据自动生成。`;
  }

  localWorkSummaryReport(data) {
    const s = data.summary;
    const details = data.details || {};
    const context = data.meta.userContext || {};
    const notes = [
      context.notes,
      ...(Array.isArray(context.chatNotes) ? context.chatNotes : [])
    ].filter(isUsefulDailyNote);
    const manualDone = splitTextLines(context.notes);
    const manualUnfinished = splitTextLines(context.unfinishedNotes);
    const manualCoordination = splitTextLines(context.coordinationNotes);
    const dayTitle = dayjs(data.meta.startDate).format('M月D日');
    const lines = [];

    const editCount = s.production.editCount || 0;
    const shootCount = s.production.shootCount || 0;
    const uploadCount = s.production.uploadCount || 0;
    if (editCount || shootCount || uploadCount) {
      const parts = [];
      if (shootCount) parts.push(`拍摄${shootCount}条`);
      if (editCount) parts.push(`信息流剪辑${editCount}条`);
      if (uploadCount) parts.push(`上传${uploadCount}条`);
      lines.push(`视频产出：${parts.join('、')}`);
    }

    const platformStats = details.platformStats || [];
    const published = s.schedule.published || 0;
    if (published || platformStats.length) {
      const platformText = platformStats
        .filter(item => Number(item.video_count || 0) > 0)
        .map(item => `${platformLabel(item.platform)}${item.video_count}条`)
        .join('、');
      lines.push(`发布总部运营账号视频${published || platformStats.reduce((n, item) => n + Number(item.video_count || 0), 0)}条${platformText ? `：${platformText}` : ''}`);
    }

    const cityStats = (details.cityStats || []).filter(item => Number(item.published_count || 0) || Number(item.task_count || 0));
    cityStats.forEach(item => {
      const count = Number(item.published_count || item.task_count || 0);
      lines.push(`对接${item.city_name}账号视频下发${count}条（发布）`);
    });

    manualDone.forEach(item => {
      if (!lines.includes(item)) lines.push(item);
    });

    notes.forEach(note => {
      splitTextLines(note).filter(isUsefulDailyNote).forEach(item => {
        if (!lines.includes(item)) lines.push(item);
      });
    });

    if (!lines.length) {
      lines.push('今日完成系统数据整理和运营日报梳理');
    }

    const unfinished = [];
    manualUnfinished.forEach(item => unfinished.push(item));
    if (s.schedule.pending) unfinished.push(`跟进总部待发布视频${s.schedule.pending}条`);
    if (s.cityDistribution.pending) unfinished.push(`跟进城市端待发布/待确认任务${s.cityDistribution.pending}条`);
    if (s.cityDistribution.overdue) unfinished.push(`跟进超期城市任务${s.cityDistribution.overdue}条`);
    if (!s.performance.videoCount) unfinished.push('关注发布视频的相关数据流量');

    const coordinate = [];
    manualCoordination.forEach(item => coordinate.push(item));
    if (s.schedule.failed) coordinate.push(`需协调处理总部发布失败${s.schedule.failed}条`);
    if (s.cityDistribution.failed) coordinate.push(`需协调处理城市发布失败${s.cityDistribution.failed}条`);

    return `【${dayTitle}工作汇报】
${lines.map((line, index) => `${index + 1}、${line}`).join('\n')}
【未完成工作】
${unfinished.length ? unfinished.join('\n') : '无'}
【需协调工作】
${coordinate.length ? coordinate.join('\n') : '无'}`;
  }

  localChatReply(message, context = {}) {
    const text = String(message || '').trim();
    if (!text) return '您可以直接输入今天完成的工作、未完成事项或需要协调的问题，我会帮您整理成日报口吻。';
    if (/^(你好|您好|在吗|哈喽|hello|hi)$/i.test(text)) {
      return '在的。您可以按“一行一件事”补充今天完成的工作，例如“对接西安账号视频下发8条（发布）”。这类内容会进入日报；普通聊天不会写进正文。';
    }
    if (/格式|整理|日报|工作汇报/.test(text)) {
      return '可以。我会按“【日期工作汇报】+ 编号事项 +【未完成工作】+【需协调工作】”的格式整理，尽量保留具体城市、账号和数量，不写空泛分析。';
    }
    if (/精简|简单/.test(text)) {
      return '收到，后续生成会保持简洁，每条尽量一行，只保留可汇报的具体事项和数量。';
    }
    if (/未完成|跟进/.test(text)) {
      return '收到，这类内容我会优先放到【未完成工作】里；如果涉及他人配合，会放到【需协调工作】。';
    }
    if (isUsefulDailyNote(text)) {
      return `收到，这条会作为日报素材处理：${text.slice(0, 80)}${text.length > 80 ? '...' : ''}。生成时我会把它放进完成、未完成或需协调的对应位置。`;
    }
    return '收到。这条更像普通对话，我不会直接写进日报正文。您可以继续补充具体数量、城市、账号或明日跟进事项。';
  }

  async generateChatReply(db, payload = {}) {
    const message = String(payload.message || '').trim();
    const context = payload.userContext || {};
    if (this.isConfigured()) {
      try {
        const periodStart = payload.periodStart || dayjs().format('YYYY-MM-DD');
        const periodEnd = payload.periodEnd || periodStart;
        const data = this.collectReportData(db, periodStart, periodEnd, payload.type || 'daily');
        data.meta.userContext = context;
        return await this.chat([
          {
            role: 'system',
            content: '你是短视频运营日报助手。回复必须简洁、具体、面向工作汇报，不要输出泛泛分析。'
          },
          {
            role: 'user',
            content: `当前用户输入：${message}\n\n当前日报配置：${safeJson(context)}\n\n系统数据摘要：${safeJson(data.summary)}\n\n请给出一段自然的对话回复。若输入是寒暄或无效指令，要提示用户补充具体工作事实；若输入包含数量、城市、账号、未完成或需协调事项，要说明会进入对应日报模块。`
          }
        ], 0.25);
      } catch {
        return this.localChatReply(message, context);
      }
    }
    return this.localChatReply(message, context);
  }

  async generateOperationalReport(db, type, startDate, endDate, options = {}) {
    const rawData = this.collectReportData(db, startDate, endDate, type);
    rawData.meta.userContext = options.userContext || {};
    const prompt = this.buildPrompt(rawData);
    let content;

    if (this.isConfigured()) {
      try {
        content = await this.chat([
          {
            role: 'system',
            content: '你是一名资深短视频运营负责人和数据分析师，擅长把生产、发布、城市协同、转化数据总结成管理层可执行的中文报告。'
          },
          { role: 'user', content: prompt }
        ]);
      } catch (err) {
        rawData.meta.aiFallback = true;
        rawData.meta.aiFallbackReason = err.name === 'AbortError'
          ? `AI 服务超过 ${AI_TIMEOUT_MS / 1000} 秒未响应`
          : err.message;
        content = this.localReport(rawData);
      }
    } else {
      rawData.meta.aiFallback = true;
      rawData.meta.aiFallbackReason = 'AI 服务未配置';
      content = this.localReport(rawData);
    }

    return {
      content,
      rawData,
      promptTemplate: PROMPT_VERSION
    };
  }

  async generateDailyReport(db, date, options = {}) {
    return this.generateOperationalReport(db, 'daily', date, date, options);
  }

  async generateWeeklyReport(db, weekStart, weekEnd, options = {}) {
    return this.generateOperationalReport(db, 'weekly', weekStart, weekEnd, options);
  }

  async generateMonthlyReport(db, monthStart, monthEnd, options = {}) {
    return this.generateOperationalReport(db, 'monthly', monthStart, monthEnd, options);
  }
}

module.exports = new AIService();
