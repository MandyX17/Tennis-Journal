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
    partner: { label: '陪练费', icon: '🤝' },
    venue: { label: '场地', icon: '📍' },
    other: { label: '其他', icon: '📦' }
  };

  const LESSON_TYPES = {
    class: { label: '上课', counts: 'class', tone: 'green' },
    partner: { label: '陪练', counts: 'partner', tone: 'orange' },
    machine: { label: '发球机', counts: 'machine', tone: 'blue' },
    sparring: { label: '找搭子', counts: 'sparring', tone: 'gold' }
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
      /* ② 课包 */
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
      /* ③ 散买课：按每次流水价格累加 */
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
      /* ④ 网球拍 */
      {
        id: uid('e'), category: 'equipment', equipKind: 'racket', name: '网球拍',
        brand: '', amount: 1515, dateMonth: '2026-10',
        createdAt: Date.now() + 6, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', spec: 'PD100 300g 2 号手柄', price: 1515, note: '' }
        ]
      },
      /* ⑤ 网球线：归入装备，不计入耗材累计 */
      {
        id: uid('e'), category: 'equipment', equipKind: 'string', name: '网球线',
        brand: '', amount: 29, dateMonth: '2026-10',
        createdAt: Date.now() + 7, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', spec: 'PD blast 1.25 50 磅', price: 29, note: '' }
        ]
      },
      /* ⑥ 网球帽（原空顶帽） */
      {
        id: uid('e'), category: 'equipment', equipKind: 'hat', name: '网球帽',
        brand: '', amount: 270, dateMonth: '2026-10',
        createdAt: Date.now() + 9, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', brand: 'wilson', detail: '', price: 270, note: '' }
        ]
      },
      /* ⑦ 网球服（原速干服） */
      {
        id: uid('e'), category: 'equipment', equipKind: 'clothes', name: '网球服',
        brand: '', amount: 580, dateMonth: '2026-10',
        createdAt: Date.now() + 10, note: '',
        subs: [
          { id: uid('s'), date: '2026-10-01', brand: 'rulu lululemon', detail: '', price: 580, note: '' }
        ]
      },
      /* ⑧ 耗材配件：合并为单一「耗材配件」条目，明细用 subs 记录（袜/手胶/防汗贴） */
      {
        id: uid('e'), category: 'consumable', name: '耗材配件',
        brand: '', amount: 137, dateMonth: '2026-10',
        createdAt: Date.now() + 12, note: '',
        subs: [
          { id: uid('s'), name: '网球袜', qty: 3, unit: '双', price: 57, date: '2026-10-01', note: '' },
          { id: uid('s'), name: '手胶', qty: 20, unit: '个', price: 72, date: '2026-10-01', note: '' },
          { id: uid('s'), name: '防汗贴', qty: 1, unit: '个', price: 8, date: '2026-10-01', note: '' }
        ]
      }
    ];

    const lessons = [
      {
        id: uid('l'), date: '2026-10-14', type: 'class', person: '龙晨硕',
        venueId: V_DF, hours: 1, techPoints: ['正手'], gains: '', tips: [],
        attachments: [], cost: 0, createdAt: Date.now() + 1, note: ''
      },
      {
        id: uid('l'), date: '2026-10-18', type: 'class', person: '龙晨硕',
        venueId: V_DF, hours: 1, techPoints: ['正手', '反手'], gains: '', tips: [],
        attachments: [], cost: 0, createdAt: Date.now() + 2, note: ''
      },
      {
        id: uid('l'), date: '2026-10-20', type: 'class', person: '刘颜彰',
        venueId: V_XC, hours: 1, techPoints: ['正手', '反手', '找点'], gains: '', tips: [],
        attachments: [], cost: 0, createdAt: Date.now() + 3, note: ''
      },
      {
        id: uid('l'), date: '2026-10-21', type: 'class', person: '刘晨同学',
        venueId: V_GC, hours: 1, techPoints: ['正手', '小场'], gains: '', tips: [{ id: uid('t'), text: '动作纠正', stars: 0 }],
        attachments: [], cost: 0, createdAt: Date.now() + 4, note: ''
      }
    ];

    return {
      version: DATA_VERSION,
      settings: { appName: '🦀的网球手账', techLevel: '1.0', createdAt: Date.now() },
      expenses, lessons, venues,
      reminders: [],
      learnNote: '',
      starredTech: [],
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
      save(); /* 确保迁移（如耗材合并）被持久化 */
      return state;
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
    s.reminders = Array.isArray(s.reminders) ? s.reminders : [];
    if (typeof s.learnNote !== 'string') s.learnNote = '';
    if (!Array.isArray(s.starredTech)) s.starredTech = [];
    s.venues.forEach(v => {
      if (!Array.isArray(v.photos)) v.photos = [];
      if (!Array.isArray(v.types)) v.types = [];
      /* 城市字段归一：名称里已有的【xx】剥离进 city，避免重复前缀 */
      if (!v.city && v.name) {
        const m = (v.name || '').match(/^【(.+?)】/);
        if (m) { v.city = m[1]; v.name = v.name.slice(m[0].length).trim(); }
      }
    });
    s.expenses.forEach(e => {
      if (!Array.isArray(e.subs)) e.subs = [];
      /* 发球机包归并：名称含「发球机」的场地类支出自动标记为 machine，并入发球机统计 */
      if (e.category === 'venue' && e.venueKind !== 'machine' && /发球机/.test(e.name || '')) {
        e.venueKind = 'machine';
      }
      if (!e.dateMonth) e.dateMonth = '2026-10';
      if (!e.date) {
        /* Y：装备缺日期默认统一写当月 15 号（10.15）；其余兜底月初 */
        if (e.category === 'equipment') e.date = (e.dateMonth || '2026-10') + '-15';
        else e.date = (e.dateMonth || '2026-10') + '-01';
      }
      if (e.isPackage) {
        if (e.totalUnits == null) e.totalUnits = e.totalLessons || 0;
        if (!e.packUnit) e.packUnit = '节';
        (e.subs || []).forEach(s => {
          if (s.units == null) s.units = (s.lessons != null ? s.lessons : 0);
          if (!s.date) s.date = (e.dateMonth || '2026-10') + '-01';
        });
      } else {
        (e.subs || []).forEach(s => { if (!s.date) s.date = e.date; });
      }
    });
    s.lessons.forEach(l => {
      if (!Array.isArray(l.attachments)) l.attachments = [];
      if (!Array.isArray(l.techPoints)) l.techPoints = [];
      l.hours = Number(l.hours) || 0;
      l.cost = Number(l.cost) || 0;
      if (typeof l.tips === 'string') {
        l.tips = l.tips.trim() ? [{ id: uid('t'), text: l.tips, stars: 0 }] : [];
      } else if (!Array.isArray(l.tips)) {
        l.tips = [];
      } else {
        l.tips.forEach(t => { if (!t.id) t.id = uid('t'); t.stars = Number(t.stars) || 0; if (typeof t.text !== 'string') t.text = ''; });
      }
    });
    s.reminders.forEach(r => {
      if (!r.id) r.id = uid('r');
      r.date = r.date || '';
      r.time = r.time || '';
      r.venueId = r.venueId || '';
      r.note = r.note || '';
    });
    /* 旧格式迁移：多条独立耗材(无 subs)合并为单一耗材条目 + subs 明细 */
    migrateConsumables(s);
    return s;
  }

  /* 把历史的多条独立「耗材配件」合并成一条，明细写入 subs（仅一次） */
  function migrateConsumables(s) {
    if (s.settings && s.settings._consumMerged) return;
    const oldCons = s.expenses.filter(e => e.category === 'consumable' && (!e.subs || e.subs.length === 0));
    if (oldCons.length <= 1) {
      if (s.settings) s.settings._consumMerged = true;
      return;
    }
    const newSubs = oldCons.map(e => ({
      id: uid('s'),
      name: e.name || '耗材',
      qty: Number(e.qty) || 0,
      unit: e.unit || '',
      price: Number(e.amount) || 0,
      date: (e.dateMonth || '2026-10') + '-01',
      note: ''
    }));
    s.expenses = s.expenses.filter(e => !(e.category === 'consumable' && (!e.subs || e.subs.length === 0)));
    s.expenses.push({
      id: uid('e'), category: 'consumable', name: '耗材配件',
      brand: '', amount: newSubs.reduce((a, b) => a + (Number(b.price) || 0), 0),
      dateMonth: '2026-10', note: '', createdAt: Date.now() + 12, subs: newSubs
    });
    if (s.settings) s.settings._consumMerged = true;
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
  /* 包的「剩余单位」：总单位 − 已消耗单位（课包/场地包/机包通用，按 units/lessons 兜底） */
  function remainingUnits(e) {
    return Math.max(0, packTotalUnits(e) - consumedUnits(e));
  }
  function packageUnitPrice(e) {
    const tl = packTotalUnits(e);
    return tl > 0 ? (Number(e.totalPrice) || 0) / tl : 0;
  }
  /* 包的「总单位数」：课包用总节数，场地/发球机包用总时长/次数（新字段，旧数据兜底总节数） */
  function packTotalUnits(e) {
    if (e.totalUnits != null) return Number(e.totalUnits) || 0;
    return Number(e.totalLessons) || 0;
  }
  /* 单次消耗的单位数：场地/机包用 units，旧课包用 lessons 兜底 */
  function subUnits(s) {
    if (s.units != null) return Number(s.units) || 0;
    if (s.lessons != null) return Number(s.lessons) || 0;
    return 0;
  }
  /* 已消耗（实耗）单位数：仅统计 date ≤ 今天 的消耗（未来的不算实耗） */
  function consumedUnits(e) {
    const today = todayStr();
    return (e.subs || []).reduce((a, s) => a + (s.date && s.date <= today ? subUnits(s) : 0), 0);
  }
  /* 已预约（未来）单位数：date > 今天 */
  function bookedUnits(e) {
    const today = todayStr();
    return (e.subs || []).reduce((a, s) => a + (s.date && s.date > today ? subUnits(s) : 0), 0);
  }
  /* 散买课：已上节数 = 流水条数累加 */
  function alacarteCount(e) {
    return (e.subs || []).reduce((a, s) => a + (Number(s.lessons) || 0), 0);
  }
  /* 散买课：总花费 = 每次课流水价格之和（每次价格可不同） */
  function alacarteTotal(e) {
    return (e.subs || []).reduce((a, s) => a + (Number(s.price) || Number(s.amount) || 0), 0);
  }
  /* 耗材配件：总件数 = 各明细数量之和（qty 缺省按 1） */
  function consumableQty(e) {
    return (e.subs || []).reduce((a, s) => a + (Number(s.qty) || 0), 0);
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
      case 'consumable':
        return (e.subs && e.subs.length)
          ? e.subs.reduce((a, s) => a + (Number(s.qty) || 0) * (Number(s.price) || 0), 0)
          : (Number(e.amount) || 0);
      default:
        return Number(e.amount) || 0;
    }
  }

  /* 实耗（已实际发生的花费）：仅统计 date ≤ 今天的消耗 / 支出
     - 预付包（课包/场地包/机包）：已消耗单位 × 单价
     - 散课：已上且 date≤今天 的每次价格
     - 单次场地费/装备/耗材/陪练/其他：购买日期 ≤ 今天 即全额计入 */
  function expenseConsumedValue(e, today) {
    today = today || todayStr();
    if (e.category === 'package') {
      return consumedUnits(e) * packageUnitPrice(e);
    }
    if (e.category === 'alacarte') {
      return (e.subs || []).reduce((a, s) => a + (s.date && s.date <= today ? (Number(s.price) || Number(s.amount) || 0) : 0), 0);
    }
    if (e.category === 'venue') {
      if (e.isPackage) return consumedUnits(e) * packageUnitPrice(e);
      return (e.date && e.date <= today) ? (Number(e.amount) || 0) : 0;
    }
    if (e.category === 'consumable') {
      /* 实耗按每条明细日期：仅 date ≤ 今天的 数量×单价 计入 */
      return (e.subs || []).reduce((a, s) =>
        a + ((s.date && s.date <= today) ? (Number(s.qty) || 0) * (Number(s.price) || 0) : 0), 0);
    }
    return (e.date && e.date <= today) ? expenseTotal(e) : 0;
  }

  function computeStats() {
    const today = todayStr();
    const st = {
      total: 0, coach: 0, equip: 0, consum: 0, partnerFee: 0, venueFee: 0, venueFeeCourt: 0, venueFeeMachine: 0,
      other: 0, classH: 0, partnerH: 0, machineH: 0, sparringH: 0, totalH: 0, remaining: 0,
      equipCount: 0, packageCount: 0, consumed: 0
    };
    (state.expenses || []).forEach(e => {
      const t = expenseTotal(e);
      st.total += t;
      st.consumed += expenseConsumedValue(e, today);
      if (e.category === 'equipment') { st.equip += t; st.equipCount++; }
      else if (e.category === 'package') { st.coach += t; st.packageCount++; }
      else if (e.category === 'alacarte') { st.coach += t; }
      else if (e.category === 'consumable') { st.consum += t; }
      else if (e.category === 'partner') { st.partnerFee += t; }
      else if (e.category === 'venue') {
        st.venueFee += t;
        if (e.venueKind === 'machine') st.venueFeeMachine += t; else st.venueFeeCourt += t;
      }
      else { st.other += t; }

      if (e.isPackage) st.remaining += remainingLessons(e);
    });
    (state.lessons || []).forEach(l => {
      const h = Number(l.hours) || 0;
      if (l.type === 'class') st.classH += h;
      else if (l.type === 'partner') st.partnerH += h;
      else if (l.type === 'machine') st.machineH += h;
      else if (l.type === 'sparring') st.sparringH += h;
    });
    st.totalH = st.classH + st.partnerH + st.machineH + st.sparringH;
    return st;
  }

  function typeDistribution() {
    const map = { class: 0, partner: 0, machine: 0, sparring: 0 };
    (state.lessons || []).forEach(l => { if (map[l.type] != null) map[l.type] += Number(l.hours) || 0; });
    return map;
  }
  function monthlyLessonStats() {
    const map = {};
    (state.lessons || []).forEach(l => {
      const mk = monthKey(l.date);
      if (!map[mk]) map[mk] = { count: 0, hours: 0 };
      map[mk].count++;
      map[mk].hours += Number(l.hours) || 0;
    });
    return map;
  }
  function techPointStats() {
    const map = {};
    (state.lessons || []).forEach(l => {
      (l.techPoints || []).forEach(tp => {
        if (!map[tp]) map[tp] = { count: 0, last: '' };
        map[tp].count++;
        if (!map[tp].last || l.date > map[tp].last) map[tp].last = l.date;
      });
    });
    return map;
  }
  function flatTips() {
    const out = [];
    (state.lessons || []).forEach(l => {
      (l.tips || []).forEach(t => out.push({
        lid: l.id, tid: t.id, text: t.text, stars: Number(t.stars) || 0, date: l.date, type: l.type
      }));
    });
    return out;
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

  /* 按天聚合各类型训练时长（日历上色用） */
  function lessonTypeHoursByDay() {
    const map = {};
    (state.lessons || []).forEach(l => {
      if (!l.date) return;
      if (!map[l.date]) map[l.date] = { class: 0, partner: 0, machine: 0, sparring: 0 };
      if (l.type === 'class' || l.type === 'partner' || l.type === 'machine' || l.type === 'sparring') {
        map[l.date][l.type] += Number(l.hours) || 0;
      }
    });
    return map;
  }

  /* ---------- 提醒 ---------- */
  function addReminder(payload) {
    const r = Object.assign({
      id: uid('r'), createdAt: Date.now(), date: '', time: '', venueId: '', note: ''
    }, payload);
    state.reminders = state.reminders || [];
    state.reminders.push(r);
    save();
    return r;
  }
  function removeReminder(id) {
    state.reminders = (state.reminders || []).filter(r => r.id !== id);
    save();
  }
  /* X：过期手动提醒自动删除（date < 今天），不动训练/记账等其他记录 */
  function pruneExpiredReminders() {
    const today = todayStr();
    const before = (state.reminders || []).length;
    state.reminders = (state.reminders || []).filter(r => !r.date || r.date >= today);
    if (state.reminders.length !== before) save();
  }

  /* T：整库导出 / 导入（备份防丢） */
  function exportState() { return JSON.stringify(state); }
  function importState(json) {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    state = normalize(obj);
    save();
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
      gains: '', tips: [], cost: 0, note: ''
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
      id: uid('v'), createdAt: Date.now(), name: '', address: '', city: '',
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
    consumedLessons, remainingLessons, remainingUnits, packageUnitPrice, packTotalUnits, subUnits,
    consumedUnits, bookedUnits, alacarteCount, alacarteTotal,
    consumableQty, equipSum, subSummary, expenseTotal, expenseConsumedValue,
    computeStats, venueStats, lessonHoursByDay, lessonTypeHoursByDay,
    typeDistribution, monthlyLessonStats, techPointStats, flatTips,
    addExpense, updateExpense, removeExpense, addSub, removeSub, updateSub,
    addLesson, updateLesson, removeLesson,
    addVenue, updateVenue, removeVenue,
    addReminder, removeReminder, pruneExpiredReminders, exportState, importState,
    media, mediaURL, revokeAllURLs
  };
})(window);
