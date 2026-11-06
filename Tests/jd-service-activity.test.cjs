// Synthetic task list and mocked requests. No live account or network access.
const assert = require('node:assert/strict');
const {JB_CONFIG, JS_KEYS, jsParams, runServiceActivity} = require('../Scripts/jd-signin.js');

const config = JB_CONFIG.service;
const cookie = 'pt_key=OFFLINE;pt_pin=offline;';
const headers = {Cookie: cookie, 'User-Agent': 'Offline'};
const template = {
  params: {appid: config.appid, client: 'apple', clientVersion: '1.0', x_app_key: 'offline'},
  body: {source: '38', supportNewChannel: '2', isJdApp: true, checkInTaskParamMap: {requestScene: 0}},
};
const profile = {pin: 'offline', headers, signing: {environment: 'offline', eidToken: 'offline'}, templates: {query: template}};
const crypto = {
  hash: () => 'offline',
  decodeEnvironment: () => ({pp: {p1: 'offline'}}),
  signOnline: async app => ['date', 'fp', app, 'token', 'hash', '5.3', 'time', 'env', 'hash', 'fields'].join(';'),
};

function item(id, status = 1) {
  return {itemId: id, status, url: 'https://pro.m.jd.com/mall/active/' + id + '/index.html'};
}

function row(id, items, seconds = 5) {
  return {
    assignmentName: '浏览频道领京豆', assignmentDesc: '计时浏览得京豆', encryptAssignmentId: id,
    assignmentType: 1, assignmentActionType: -1, subTaskType: null, appJumpType: '', timerId: 'offline',
    waitDuration: seconds, completionCnt: items.filter(entry => entry.status === 2).length,
    assignmentTimesLimit: items.length, completionFlag: false, canReceiveTimes: 0,
    rewardsList: [{rewardName: '京豆', manualReward: 1}], subTaskList: items,
  };
}

function fixture(rows, {verifyProgress = true, initialError = false} = {}) {
  const storage = new Map([[JS_KEYS.login, {pin: 'offline', cookie, headers}], [config.key, profile]]);
  const events = [], waits = [], logs = [];
  let started, failure;
  const host = {
    read: (key, fallback) => storage.has(key) ? structuredClone(storage.get(key)) : fallback,
    write: (key, value) => storage.set(key, structuredClone(value)),
    rawWrite: (_, key) => storage.delete(key),
    now: () => 1, day: () => '2026-11-06', random: () => 0.5,
    log: message => logs.push(message),
    sleep: async ms => {
      assert.equal(logs.at(-1), '浏览计时 ' + (ms / 1000) + ' 秒');
      waits.push(ms);
    },
    request: async (_, options) => {
      try {
        const params = jsParams(options);
        const map = JSON.parse(params.body).checkInTaskParamMap;
        const success = {status: 200, body: ''};
        const reply = (subCode, fields) => ({...success, body: JSON.stringify({code: '0', resultCode: '0', subCode, ...fields})});
        if (params.functionId === config.query) {
          assert.equal(logs.at(-1), '查询任务列表');
          return reply(null, {browseTaskList: rows});
        }
        const task = rows.find(entry => entry.encryptAssignmentId === map.encryptAssignmentId);
        assert(task);
        if (params.functionId === 'checkInTaskLuckyDraw') {
          assert.equal(logs.at(-1), '领取京豆');
          assert.equal(map.doReceiveRewards, 1);
          assert(task.canReceiveTimes > 0);
          task.canReceiveTimes--;
          events.push(['reward', task.encryptAssignmentId]);
          return reply('0', {doTaskJdList: [{rewardType: 3, rewardName: '京豆', quantity: 1}]});
        }
        assert.equal(params.functionId, config.claim);
        assert.equal(logs.at(-1), map.actionType === 1 ? '开始计时' : '提交浏览结果');
        const entry = task.subTaskList.find(candidate => candidate.itemId === map.itemId);
        assert.equal(map.jumpUrl, entry.url);
        assert.equal(entry.status, 1);
        events.push([map.actionType, task.encryptAssignmentId, entry.itemId]);
        if (initialError) return {status: 403, body: '{}'};
        if (map.actionType === 1) {
          started = [task.encryptAssignmentId, entry.itemId, waits.length];
          return reply('1');
        }
        assert.deepEqual(started, [task.encryptAssignmentId, entry.itemId, waits.length - 1]);
        assert.equal(waits.at(-1), task.waitDuration * 1000);
        if (verifyProgress) {
          entry.status = 2;
          task.completionFlag = ++task.completionCnt === task.assignmentTimesLimit;
          task.canReceiveTimes++;
        }
        return reply('0');
      } catch (error) {
        failure = error;
        throw error;
      }
    },
  };
  return {
    events, waits, logs,
    run: async () => {
      const report = await runServiceActivity(host, crypto);
      if (failure) throw failure;
      assert(!storage.has('JD_SERVICE_ACTIVITY_LOCK_V1'));
      return report;
    },
  };
}

(async () => {
  const external = {...item('external'), url: 'weixin://other-app'};
  const game = {...item('game'), title: '玩一玩小游戏'};
  const payment = {...item('payment'), url: 'https://ipay.jd.com/pages/bbf/index'};
  const eligible = row('fresh_group', [item('already', 2), item('today_a'), item('today_b'), external, game, payment]);
  const atLimit = row('same_title_different_id', [item('new_15_seconds')], 15);
  const unsupported = [
    row('too_long', [item('long')], 16),
    {...row('widget', [item('widget')]), assignmentType: 10338},
    {...row('untimed', [item('untimed')]), timerId: null},
    {...row('app_jump', [item('app_jump')]), appJumpType: 'miniProgram'},
  ];
  const activity = fixture([eligible, ...unsupported, atLimit]);
  const report = await activity.run();
  assert.deepEqual(activity.events, [
    [1, 'fresh_group', 'today_a'], [0, 'fresh_group', 'today_a'], ['reward', 'fresh_group'],
    [1, 'fresh_group', 'today_b'], [0, 'fresh_group', 'today_b'], ['reward', 'fresh_group'],
    [1, 'same_title_different_id', 'new_15_seconds'], [0, 'same_title_different_id', 'new_15_seconds'], ['reward', 'same_title_different_id'],
  ]);
  assert.deepEqual(activity.waits, [5000, 5000, 15000]);
  assert.deepEqual(activity.logs.slice(0, 3), ['开始执行，检查凭据', '查询任务列表', '任务列表返回 6 项']);
  assert(activity.logs.includes('浏览频道领京豆：第 2/6 项'));
  assert.match(report, /进度 3\/6，暂无可处理子项/);
  assert.equal((report.match(/已领 1 京豆/g) || []).length, 3);
  await activity.run();
  assert.equal(activity.events.length, 9);

  const unverified = fixture([row('unconfirmed', [item('first'), item('second')])], {verifyProgress: false});
  assert.match(await unverified.run(), /进度待确认/);
  assert.match(await unverified.run(), /已有提交记录/);
  assert.deepEqual(unverified.events, [[1, 'unconfirmed', 'first'], [0, 'unconfirmed', 'first']]);

  const rejected = fixture([row('rejected', [item('one')]), row('untouched', [item('two')])], {initialError: true});
  assert.match(await rejected.run(), /HTTP 403/);
  assert.deepEqual(rejected.events, [[1, 'rejected', 'one']]);
  console.log('JD service checks passed for rotating lists, grouped tasks, confirmed rewards, and rejected requests.');
})().catch(error => {console.error(error);process.exitCode = 1;});
