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
    return `请基于以下“全站运营数据”生成一份专业的中文 ${data.meta.title}。

要求：
1. 输出 Markdown。
2. 先给 3-5 条“核心结论”，每条必须有数据依据。
3. 必须分析：素材生产、发布执行、城市下发与城市端填报、平台表现、账号表现、成交转化、异常风险。
4. 最后输出“下一步行动清单”，按优先级列出 5-8 条具体动作。
5. 不要编造不存在的数据。数据为 0 时要说明口径可能未填报或暂无数据。
6. 风格要像运营负责人写给管理层的日报，简洁、直接、可执行。

全站运营数据 JSON：
\`\`\`json
${safeJson(data)}
\`\`\``;
  }

  localReport(data) {
    const s = data.summary;
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

  async generateOperationalReport(db, type, startDate, endDate) {
    const rawData = this.collectReportData(db, startDate, endDate, type);
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

  async generateDailyReport(db, date) {
    return this.generateOperationalReport(db, 'daily', date, date);
  }

  async generateWeeklyReport(db, weekStart, weekEnd) {
    return this.generateOperationalReport(db, 'weekly', weekStart, weekEnd);
  }

  async generateMonthlyReport(db, monthStart, monthEnd) {
    return this.generateOperationalReport(db, 'monthly', monthStart, monthEnd);
  }
}

module.exports = new AIService();
