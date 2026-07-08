const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('data-dashboard');

const app = require('../server');

const listen = () => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const requestJson = async (base, path, token, options = {}) => {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const payload = await res.json();
  return { res, payload };
};

const getAuthToken = async (base) => {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin_test', password: 'StrongTestPassword!123' })
  });
  const payload = await res.json();
  return payload.data.token;
};

test('data dashboard summarizes manual and city submitted metrics', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb();
  });

  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = await getAuthToken(base);

  const city = await requestJson(base, '/cities', token, {
    method: 'POST',
    body: JSON.stringify({ name: '测试城市', contact_name: '运营', contact_info: '13800000000' })
  });
  assert.equal(city.res.status, 200);
  const cityId = city.payload.data.id;

  const account = await requestJson(base, '/accounts', token, {
    method: 'POST',
    body: JSON.stringify({
      name: '测试城市账号',
      platform: 'douyin',
      type: 'city',
      city_id: cityId
    })
  });
  assert.equal(account.res.status, 200);
  const accountId = account.payload.data.id;

  const manual = await requestJson(base, '/data-tracks', token, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-06-21',
      account_id: accountId,
      play_count: 100,
      like_count: 10,
      comment_count: 3,
      deal_count: 1,
      deal_amount: 88
    })
  });
  assert.equal(manual.res.status, 200);

  const citySubmitted = await requestJson(base, '/city-distributions', token, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-06-21',
      actual_publish_time: '2026-06-21',
      city_id: cityId,
      account_id: accountId,
      video_title: '城市端填报视频',
      status: 'published',
      play_count: 200,
      like_count: 20,
      comment_count: 7,
      deal_count: 2,
      deal_amount: 188
    })
  });
  assert.equal(citySubmitted.res.status, 200);

  const hqPublished = await requestJson(base, '/schedules', token, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-06-21', time: '10:00', account_id: accountId,
      video_title: '总部发布视频', status: 'published'
    })
  });
  assert.equal(hqPublished.res.status, 200);

  const dashboard = await requestJson(base, '/data-dashboard?dateFrom=2026-06-21&dateTo=2026-06-21', token);
  assert.equal(dashboard.res.status, 200);
  assert.equal(dashboard.payload.data.summary.total_plays, 300);
  assert.equal(dashboard.payload.data.summary.total_likes, 30);
  assert.equal(dashboard.payload.data.summary.total_comments, 10);
  assert.equal(dashboard.payload.data.summary.total_deals, 3);
  assert.equal(dashboard.payload.data.summary.total_amount, 276);
  assert.equal(dashboard.payload.data.summary.total_videos, 2);
  assert.equal(dashboard.payload.data.summary.distributed_videos, 1);
  assert.equal(dashboard.payload.data.summary.published_hq_videos, 1);
  assert.equal(dashboard.payload.data.summary.published_city_videos, 1);
  assert.equal(dashboard.payload.data.summary.published_videos, 2);

  const trend = dashboard.payload.data.trend.find(item => item.date === '2026-06-21' && item.platform === 'douyin');
  assert.ok(trend);
  assert.equal(trend.plays, 300);
  assert.equal(trend.likes, 30);
  assert.equal(trend.comments, 10);

  const tracks = await requestJson(base, '/data-tracks?dateFrom=2026-06-21&dateTo=2026-06-21&pageSize=20', token);
  assert.equal(tracks.res.status, 200);
  assert.equal(tracks.payload.data.total, 2);

  const emptyPublished = await requestJson(base, '/city-distributions', token, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-06-21', actual_publish_time: '2026-06-21', city_id: cityId,
      account_id: accountId, video_title: '尚未录入数据的视频', status: 'published'
    })
  });
  assert.equal(emptyPublished.res.status, 200);
  const detailRows = await requestJson(base, '/data-report-details?dateFrom=2026-06-21&dateTo=2026-06-21&pageSize=20', token);
  assert.equal(detailRows.res.status, 200);
  assert.equal(detailRows.payload.data.total, 2);
  assert.ok(detailRows.payload.data.list.some(item => item.video_title === '城市端填报视频'));
  assert.ok(!detailRows.payload.data.list.some(item => item.video_title === '尚未录入数据的视频'));

  const rangePayload = {
    period_start: '2026-06-22',
    period_end: '2026-06-24',
    account_id: accountId,
    play_count: 1000,
    like_count: 10,
    comment_count: 2,
    deal_count: 1,
    deal_amount: 10.01
  };
  const firstRange = await requestJson(base, '/data-tracks/range-report', token, {
    method: 'POST', body: JSON.stringify(rangePayload)
  });
  assert.equal(firstRange.res.status, 200);
  assert.equal(firstRange.payload.data.replaced, false);

  const replacement = await requestJson(base, '/data-tracks/range-report', token, {
    method: 'POST', body: JSON.stringify({ ...rangePayload, play_count: 1200 })
  });
  assert.equal(replacement.res.status, 200);
  assert.equal(replacement.payload.data.replaced, true);

  const replacedDashboard = await requestJson(base, '/data-dashboard?dateFrom=2026-06-22&dateTo=2026-06-24', token);
  assert.equal(replacedDashboard.payload.data.summary.total_plays, 1200);
  assert.equal(replacedDashboard.payload.data.summary.total_deals, 1);
  assert.equal(replacedDashboard.payload.data.summary.total_amount, 10.01);
  assert.equal(replacedDashboard.payload.data.summary.total_videos, 1);

  const overlap = await requestJson(base, '/data-tracks/range-report', token, {
    method: 'POST',
    body: JSON.stringify({ ...rangePayload, period_start: '2026-06-24', period_end: '2026-06-26' })
  });
  assert.equal(overlap.res.status, 409);
  assert.equal(overlap.payload.data.overlaps.length, 1);
});
