/* ============ 数据层：状态 / 预置 / 计算 / IndexedDB ============ */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'crabTennis.v1';
  const DATA_VERSION = 2;

  /* ---------- 小工具 ---------- */
  let _seq = 0;
  function uid(prefix) {
    _seq++;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + _seq.toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function monthKey(s) { return (s || '').slice(0, 7); }
  function fmtMoney(n) {
    n = Number(n) || 0;
    const neg = n < 0;
    const v = Math.abs(Math.round(n * 100) / 100);
    const str = v % 1 === 0 ? v.toLocaleString('zh-CN') : v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? '-' : '') + str;
  }
  function fmtHours(n) {
    n = Number(n) || 0;
    return (Math.round(n * 10) / 10) + 'h';
  }
  function fmtMonth(mk) {
    if (!mk) return '';
    const p = mk.split('-');
    return p[0] + '年' + Number(p[1]) + '月';
  }
  function fmtDateShort(s) {
    if (!s) return '';
    const p = s.split('-');
    return Number(p[1]) + '.' + Number(p[2]);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* ---------- 分类与类型 ---------- */
  const CATEGORIES = {
    equipment: { label: '装备', icon: '🎒' },
    package: { label: '课程课包', icon: '🎾' },
    alacarte: { label: '散买课程', icon: '🎫' },
    consumable: { label: '耗材配件', icon: '🧴' },
    venue: { label: '场地', icon: '📍' },
    other: { label: '其他', icon: '📦' }
  };

  const LESSON_TYPES = {
    class: { label: '上课', counts: 'class', tone: 'green' },
    partner: { label: '陪练', counts: 'class', tone: 'orange' },
    machine: { label: '发球机', counts: 'self', tone: 'blue' },
    sparring: { label: '找搭子', counts: 'self', tone: 'gold' },
    solo: { label: '自己练习', counts: 'self', tone: 'rose' }
  };

  const VENUE_TYPES = ['室内', '室外', '风雨棚'];

  const TECH_PRESETS = ['正手', '反手', '发球', '网前截击', '高压球', '步伐', '找点', '小场', '动作纠正'];

  const UNITS = ['双', '个', '节', '条', '次', '桶', '包'];

  /* 装备种类：每类的「追加采购」明细字段不同 */
  const EQUIP_KINDS = {
    shoe:    { label: '网球鞋', fields: [['brand', '牌子'], ['size', '球鞋大小'], ['price', '价格 ¥']] },
    racket:  { label: '网球拍', fields: [['spec', '型号 / 规格'], ['price', '价格 ¥']] },
    hat:     { label: '网球帽', fields: [['brand', '品牌'], ['detail', '明细'], ['price', '价格 ¥']] },
    clothes: { label: '网球服', fields: [['brand', '品牌'], ['detail', '明细'], ['price', '价格 ¥']] },
    string:  { label: '网球线', fields: [['spec', '型号 / 磅数'], ['detail', '明细'], ['price', '价格 ¥']] },
    otherEq: { label: '其他装备', fields: [['brand', '品牌'], ['detail', '明细'], ['price', '价格 ¥']] }
  };
  const EQUIP_KIND_KEYS = Object.keys(EQUIP_KINDS);

  /* ---------- 预置数据（按用户手工账本，2026-10） ---------- */
  function seed() {
    const V_DF = 'v-dongfeng', V_XC = 'v-xingcan', V_GC = 'v-guangcai';

    const venues = [
      {
        id: V_DF, name: '东风9号球场', note: '9# Tennis Center', address: '',
        types: ['室外'], fee: 0, rating: 4, review: '', photos: [], createdAt: Date.now()
      },
      {
        id: V_XC, name: '星灿耀', note: '原「星星璀璨」', address: '',
        types: ['室内'], fee: 0, rating: 4, review: '', photos: [], createdAt: Date.now() + 1
      },
      {
        id: V_GC, name: '光彩网球', address: '',
        types: ['室外'], fee: 0, rating: 4, review: '', photos: [], createdAt: Date.now() + 2
      }
    ];

    const expenses = [
      /* ① 网球鞋：装备·采购实例 */
      {
        id: uid('e'), category: 'equipment', equipKind: 'shoe', name: '网球鞋',
        brand: '', amount: 750, dateMonth: '2026-10',
        createdAt: Date.now() + 1, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', brand: 'wilson intrigue pro', size: '38 2/3', price: 750, note: '' }
        ]
      },
      /* ② 网球袜：耗材配件（独立条目，数量仅展示） */
      {
        id: uid('e'), category: 'consumable', name: '网球袜',
        brand: '', amount: 57, dateMonth: '2026-10',
        unit: '双', qty: 3,
        createdAt: Date.now() + 2, subs: [], note: ''
      },
      /* ③ 课包 */
      {
        id: uid('e'), category: 'package', name: '网球课 9# tennis center',
        brand: '', amount: 6000, dateMonth: '2026-10',
        isPackage: true, totalLessons: 14, totalPrice: 6000,
        club: '东风9号球场', coach: '龙晨硕',
        createdAt: Date.now() + 3, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-14', lessons: 1, note: '' },
          { id: uid('s'), date: '2026-10-18', lessons: 1, note: '' }
        ]
      },
      /* ④ 散买课：按每次流水价格累加 */
      {
        id: uid('e'), category: 'alacarte', name: '星灿耀 体验课',
        brand: '教练 刘颜彰（网球国二）', amount: 394, dateMonth: '2026-10',
        club: '星灿耀', coach: '刘颜彰',
        createdAt: Date.now() + 4, note: '',
        subs: [{ id: uid('s'), date: '2026-10-20', lessons: 1, price: 394, note: '' }]
      },
      {
        id: uid('e'), category: 'alacarte', name: '刘晨同学 课程',
        brand: '光彩网球', amount: 500, dateMonth: '2026-10',
        club: '光彩网球', coach: '刘晨同学',
        createdAt: Date.now() + 5, note: '',
        subs: [{ id: uid('s'), date: '2026-10-21', lessons: 1, price: 500, note: '' }]
      },
      /* ⑤ 网球拍 */
      {
        id: uid('e'), category: 'equipment', equipKind: 'racket', name: '网球拍',
        brand: '', amount: 1515, dateMonth: '2026-10',
        createdAt: Date.now() + 6, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', spec: 'PD100 300g 2 号手柄', price: 1515, note: '' }
        ]
      },
      /* ⑥ 网球线：归入装备，不计入耗材累计 */
      {
        id: uid('e'), category: 'equipment', equipKind: 'string', name: '网球线',
        brand: '', amount: 29, dateMonth: '2026-10',
        createdAt: Date.now() + 7, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', spec: 'PD blast 1.25 50 磅', price: 29, note: '' }
        ]
      },
      /* ⑦ 手胶 */
      {
        id: uid('e'), category: 'consumable', name: '手胶',
        brand: '', amount: 72, dateMonth: '2026-10',
        unit: '个', qty: 20,
        createdAt: Date.now() + 8, subs: [], note: ''
      },
      /* ⑧ 网球帽（原空顶帽） */
      {
        id: uid('e'), category: 'equipment', equipKind: 'hat', name: '网球帽',
        brand: '', amount: 270, dateMonth: '2026-10',
        createdAt: Date.now() + 9, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', brand: 'wilson', detail: '', price: 270, note: '' }
        ]
      },
      /* ⑨ 网球服（原速干服） */
      {
        id: uid('e'), category: 'equipment', equipKind: 'clothes', name: '网球服',
        brand: '', amount: 580, dateMonth: '2026-10',
        createdAt: Date.now() + 10, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', brand: 'rulu lululemon', detail: '', price: 580, note: '' }
        ]
      },
      /* ⑩ 防汗贴 */
      {
        id: uid('e'), category: 'consumable', name: '防汗贴',
        brand: '', amount: 8, dateMonth: '2026-10',
        unit: '个', qty: 1,
        createdAt: Date.now() + 11, subs: [], note: ''
      }
    ];

    const lessons = [
      {
        id: uid('l'), date: '2026-10-14', type: 'class', person: '龙晨硕',
        venueId: V_DF, hours: 1, techPoints: ['正手'], gains: '', tips: '',
        attachments: [], cost: 0, createdAt: Date.now() + 1, note: ''
      },
      {
        id: uid('l'), date: '2026-10-18', type: 'class', person: '龙晨硕',
        venueId: V_DF, hours: 1, techPoints: ['正手', '反手'], gains: '', tips: '',
        attachments: [], cost: 0, createdAt: Date.now() + 2, note: ''
      },
      {
        id: uid('l'), date: '2026-10-20', type: 'class', person: '刘颜彰',
        venueId: V_XC, hours: 1, techPoints: ['正手', '反手', '找点'], gains: '', tips: '',
        attachments: [], cost: 0, createdAt: Date.now() + 3, note: ''
      },
      {
        id: uid('l'), date: '2026-10-21', type: 'class', person: '刘晨同学',
        venueId: V_GC, hours: 1, techPoints: ['正手', '小场'], gains: '', tips: '动作纠正',
        attachments: [], cost: 0, createdAt: Date.now() + 4, note: ''
      }
    ];

    return {
      version: DATA_VERSION,
      settings: { appName: '🦀的网球手账', techLevel: '1.0', createdAt: Date.now() },
      expenses, lessons, venues,
      installHintDismissed: false
    };
  }

  /* ---------- 状态 ---------- */
  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { state = seed(); save(); return state; }
      const obj = JSON.parse(raw);
      /* 版本不一致（模型已重构）→ 重铺预置数据 */
      if (!obj || obj.version !== DATA_VERSION) { state = seed(); save(); return state; }
      state = normalize(obj);
    } catch (e) {
      console.warn('load failed, re-seed', e);
      state = seed();
      save();
    }
    return state;
  }

  function normalize(obj) {
    const s = Object.assign(seed(), obj || {});
    s.settings = Object.assign({ appName: '🦀的网球手账', techLevel: '1.0' }, obj && obj.settings);
    s.expenses = Array.isArray(s.expenses) ? s.expenses : [];
    s.lessons = Array.isArray(s.lessons) ? s.lessons : [];
    s.venues = Array.isArray(s.venues) ? s.venues : [];
    s.venues.forEach(v => {
      if (!Array.isArray(v.photos)) v.photos = [];
      if (!Array.isArray(v.types)) v.types = [];
    });
    s.expenses.forEach(e => {
      if (!Array.isArray(e.subs)) e.subs = [];
      if (!e.dateMonth) e.dateMonth = '2026-10';
    });
    s.lessons.forEach(l => {
      if (!Array.isArray(l.attachments)) l.attachments = [];
      if (!Array.isArray(l.techPoints)) l.techPoints = [];
      l.hours = Number(l.hours) || 0;
      l.cost = Number(l.cost) || 0;
    });
    return s;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('save failed', e);
      if (global.UI && UI.toast) UI.toast('保存失败：本地存储空间可能已满');
    }
  }

  function getState() { return state; }

  function replaceState(obj) {
    state = normalize(obj);
    save();
    return state;
  }

  /* ---------- 计算 ---------- */
  function consumedLessons(e) {
    if (!e.isPackage) return 0;
    return (e.subs || []).reduce((a, s) => a + (Number(s.lessons) || 0), 0);
  }
  function remainingLessons(e) {
    return Math.max(0, (Number(e.totalLessons) || 0) - consumedLessons(e));
  }
  function packageUnitPrice(e) {
    const tl = Number(e.totalLessons) || 0;
    return tl > 0 ? (Number(e.totalPrice) || 0) / tl : 0;
  }
  /* 散买课：已上节数 = 流水条数累加 */
  function alacarteCount(e) {
    return (e.subs || []).reduce((a, s) => a + (Number(s.lessons) || 0), 0);
  }
  /* 散买课：总花费 = 每次课流水价格之和（每次价格可不同） */
  function alacarteTotal(e) {
    return (e.subs || []).reduce((a, s) => a + (Number(s.price) || Number(s.amount) || 0), 0);
  }
  /* 耗材配件：数量仅作静态展示，不再自动累加 */
  function consumableQty(e) {
    return Number(e.qty) || 0;
  }
  /* 装备：总价 = 各次采购实例价格之和 */
  function equipSum(e) {
    const subs = e.subs || [];
    if (subs.length) return subs.reduce((a, s) => a + (Number(s.price) || 0), 0);
    return Number(e.amount) || 0;
  }
  /* 采购实例摘要：牌子 / 大小 / 规格 / 明细 + 价格 */
  function subSummary(sb) {
    const parts = [];
    if (sb.brand) parts.push(sb.brand);
    if (sb.size) parts.push(sb.size);
    if (sb.spec) parts.push(sb.spec);
    if (sb.detail) parts.push(sb.detail);
    const head = parts.join(' · ') || '一次采购';
    const p = Number(sb.price) || 0;
    return p ? head + ' · ¥' + fmtMoney(p) : head;
  }

  function expenseTotal(e) {
    switch (e.category) {
      case 'package':
        return Number(e.totalPrice) || Number(e.amount) || 0;
      case 'alacarte':
        return alacarteTotal(e);
      case 'equipment':
        return equipSum(e);
      default:
        return Number(e.amount) || 0;
    }
  }

  function computeStats() {
    const st = { total: 0, coach: 0, equip: 0, consum: 0, venueFee: 0, other: 0, classH: 0, selfH: 0, totalH: 0, remaining: 0, equipCount: 0, packageCount: 0 };
    (state.expenses || []).forEach(e => {
      const t = expenseTotal(e);
      st.total += t;
      if (e.category === 'equipment') { st.equip += t; st.equipCount++; }
      else if (e.category === 'package') { st.coach += t; st.packageCount++; }
      else if (e.category === 'alacarte') { st.coach += t; }
      else if (e.category === 'consumable') { st.consum += t; }
      else if (e.category === 'venue') { st.venueFee += t; }
      else { st.other += t; }

      if (e.isPackage) st.remaining += remainingLessons(e);
    });
    (state.lessons || []).forEach(l => {
      const meta = LESSON_TYPES[l.type] || LESSON_TYPES.class;
      const h = Number(l.hours) || 0;
      if (meta.counts === 'class') st.classH += h; else st.selfH += h;
    });
    st.totalH = st.classH + st.selfH;
    return st;
  }

  function venueStats() {
    const map = {};
    (state.venues || []).forEach(v => {
      map[v.id] = { count: 0, hours: 0, cost: 0, last: '' };
    });
    (state.lessons || []).forEach(l => {
      if (!l.venueId || !map[l.venueId]) return;
      const m = map[l.venueId];
      m.count++;
      m.hours += Number(l.hours) || 0;
      m.cost += Number(l.cost) || 0;
      if (!m.last || l.date > m.last) m.last = l.date;
    });
    return map;
  }

  function lessonHoursByDay() {
    const map = {};
    (state.lessons || []).forEach(l => {
      if (!l.date) return;
      map[l.date] = (map[l.date] || 0) + (Number(l.hours) || 0);
    });
    return map;
  }

  /* ---------- 增删改 ---------- */
  function addExpense(payload) {
    const e = Object.assign({
      id: uid('e'), createdAt: Date.now(), subs: [], note: '',
      dateMonth: monthKey(todayStr())
    }, payload);
    state.expenses.push(e);
    save();
    return e;
  }
  function updateExpense(id, patch) {
    const e = state.expenses.find(x => x.id === id);
    if (!e) return;
    Object.assign(e, patch);
    save();
  }
  function removeExpense(id) {
    state.expenses = state.expenses.filter(x => x.id !== id);
    save();
  }
  function addSub(expenseId, sub) {
    const e = state.expenses.find(x => x.id === expenseId);
    if (!e) return;
    e.subs = e.subs || [];
    e.subs.push(Object.assign({ id: uid('s'), date: todayStr() }, sub));
    save();
  }
  function removeSub(expenseId, subId) {
    const e = state.expenses.find(x => x.id === expenseId);
    if (!e) return;
    e.subs = (e.subs || []).filter(s => s.id !== subId);
    save();
  }
  function updateSub(expenseId, subId, patch) {
    const e = state.expenses.find(x => x.id === expenseId);
    if (!e) return;
    const s = (e.subs || []).find(x => x.id === subId);
    if (!s) return;
    Object.assign(s, patch);
    save();
  }

  function addLesson(payload) {
    const l = Object.assign({
      id: uid('l'), createdAt: Date.now(), attachments: [], techPoints: [],
      date: todayStr(), hours: 1, type: 'class', person: '', venueId: '',
      gains: '', tips: '', cost: 0, note: ''
    }, payload);
    state.lessons.push(l);
    save();
    return l;
  }
  function updateLesson(id, patch) {
    const l = state.lessons.find(x => x.id === id);
    if (!l) return;
    Object.assign(l, patch);
    save();
  }
  async function removeLesson(id) {
    const l = state.lessons.find(x => x.id === id);
    if (l) {
      for (const a of (l.attachments || [])) { try { await media.del(a.id); } catch (e) {} }
    }
    state.lessons = state.lessons.filter(x => x.id !== id);
    save();
  }

  function addVenue(payload) {
    const v = Object.assign({
      id: uid('v'), createdAt: Date.now(), name: '', address: '',
      types: [], fee: 0, rating: 0, review: '', note: ''
    }, payload);
    state.venues.push(v);
    save();
    return v;
  }
  function updateVenue(id, patch) {
    const v = state.venues.find(x => x.id === id);
    if (!v) return;
    Object.assign(v, patch);
    save();
  }
  async function removeVenue(id) {
    const v = (state.venues || []).find(x => x.id === id);
    state.venues = (state.venues || []).filter(x => x.id !== id);
    (state.lessons || []).forEach(l => { if (l.venueId === id) l.venueId = ''; });
    if (v) {
      for (const p of (v.photos || [])) { try { await media.del(p.id); } catch (e) {} }
    }
    save();
  }

  /* ---------- IndexedDB 媒体 ---------- */
  const DB_NAME = 'crabTennisMedia';
  const STORE = 'files';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(mode) {
    const db = await openDB();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  const media = {
    async put(id, blob) {
      const store = await tx('readwrite');
      return new Promise((res, rej) => {
        const r = store.put(blob, id);
        r.onsuccess = () => res(id);
        r.onerror = () => rej(r.error);
      });
    },
    async get(id) {
      const store = await tx('readonly');
      return new Promise((res, rej) => {
        const r = store.get(id);
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => rej(r.error);
      });
    },
    async del(id) {
      const store = await tx('readwrite');
      return new Promise((res, rej) => {
        const r = store.delete(id);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
    },
    async clear() {
      const store = await tx('readwrite');
      return new Promise((res, rej) => {
        const r = store.clear();
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
    },
    async keys() {
      const store = await tx('readonly');
      return new Promise((res, rej) => {
        const r = store.getAllKeys();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => rej(r.error);
      });
    }
  };

  const _urlCache = new Map();
  function mediaURL(id) {
    if (_urlCache.has(id)) return Promise.resolve(_urlCache.get(id));
    return media.get(id).then(blob => {
      if (!blob) return '';
      const url = URL.createObjectURL(blob);
      _urlCache.set(id, url);
      return url;
    }).catch(() => '');
  }
  function revokeAllURLs() {
    _urlCache.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
    _urlCache.clear();
  }

  /* ---------- 重置 ---------- */
  async function resetAll() {
    state = seed();
    save();
    try { await media.clear(); } catch (e) {}
    revokeAllURLs();
  }

  global.DB = {
    STORAGE_KEY, CATEGORIES, LESSON_TYPES, VENUE_TYPES, TECH_PRESETS, UNITS,
    EQUIP_KINDS, EQUIP_KIND_KEYS,
    load, save, getState, resetAll, replaceState,
    seed,
    uid, pad2, todayStr, monthKey, fmtMoney, fmtHours, fmtMonth, fmtDateShort, esc, clamp,
    consumedLessons, remainingLessons, packageUnitPrice, alacarteCount, alacarteTotal,
    consumableQty, equipSum, subSummary, expenseTotal,
    computeStats, venueStats, lessonHoursByDay,
    addExpense, updateExpense, removeExpense, addSub, removeSub, updateSub,
    addLesson, updateLesson, removeLesson,
    addVenue, updateVenue, removeVenue,
    media, mediaURL, revokeAllURLs
  };
})(window);
