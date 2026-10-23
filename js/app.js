/* ============ 界面层 ============ */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const state = () => DB.getState();
  const esc = DB.esc;

  /* ---------------- 通用 ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
  }

  function openSheet(title, html, onMount) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = html;
    $('#sheet').classList.add('show');
    $('#sheetBackdrop').classList.add('show');
    document.body.style.overflow = 'hidden';
    $('#sheetBody').scrollTop = 0;
    if (onMount) onMount($('#sheetBody'));
  }
  function closeSheet() {
    $('#sheet').classList.remove('show');
    $('#sheetBackdrop').classList.remove('show');
    document.body.style.overflow = '';
  }

  function confirmSheet(title, msg, okText, onOk, danger) {
    openSheet(title, `
      <p class="confirm-msg">${msg}</p>
      <div class="form-actions">
        <button class="btn-lg ghost" data-close>取消</button>
        <button class="btn-lg ${danger ? 'danger' : 'primary'}" id="cfOk">${okText || '确定'}</button>
      </div>`, () => {
      $('#cfOk').addEventListener('click', () => { closeSheet(); onOk(); });
    });
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function stamp() {
    const d = new Date();
    return d.getFullYear() + DB.pad2(d.getMonth() + 1) + DB.pad2(d.getDate()) + '-' + DB.pad2(d.getHours()) + DB.pad2(d.getMinutes());
  }

  function extOf(name, mime) {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    if (m) return m[1].toLowerCase();
    if (!mime) return 'bin';
    if (mime.includes('jpeg')) return 'jpg';
    if (mime.includes('png')) return 'png';
    if (mime.includes('quicktime')) return 'mov';
    if (mime.includes('mp4')) return 'mp4';
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('heic')) return 'heic';
    return 'bin';
  }

  /* ---------------- 顶部 ---------------- */
  function renderHeader() {
    const s = state();
    const name = s.settings.appName || '🦀的网球手账';
    $('#appName').textContent = name;
    document.title = name;
    const crab = document.querySelector('.brand-crab');
    if (crab) crab.style.display = name.includes('🦀') ? 'none' : '';
  }

  function statCard(k, v, cls) {
    return `<div class="stat-card ${cls || ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  }

  function renderStats() {
    const st = DB.computeStats();
    const tech = state().settings.techLevel || '1.0';
    /* 第一排：总花费（左） + 技术等级（右）两张大卡 */
    $('#statGrid').innerHTML = `
      <div class="stat-card total" data-act="go-expense">
        <span class="k">总花费 · Total</span>
        <span class="v"><span class="cur">¥</span>${DB.fmtMoney(st.total)}</span>
        <span class="meta">课包剩余 <b>${st.remaining}</b> 节</span>
      </div>
      <div class="stat-card tech" data-act="edit-tech">
        <span class="k">技术等级</span>
        <span class="v">${esc(tech)}<span class="edit">›</span></span>
        <span class="meta">点击可修改</span>
      </div>
      ${statCard('上课时长', DB.fmtHours(st.classH))}
      ${statCard('自己练习', DB.fmtHours(st.selfH))}
      ${statCard('教练费', '¥' + DB.fmtMoney(st.coach), 'accent')}
      ${statCard('装备费', '¥' + DB.fmtMoney(st.equip))}
      ${statCard('场地费', '¥' + DB.fmtMoney(st.venueFee))}
      ${statCard('耗材费', '¥' + DB.fmtMoney(st.consum))}`;
  }

  /* ---------------- 记账 ---------------- */
  function subLine(label, extra) {
    return `<div class="sub-row"><span class="dot"></span><span class="d">${label}</span><span class="t">${extra || ''}</span></div>`;
  }

  function renderExpense() {
    const s = state();
    const st = DB.computeStats();
    $('#expenseMeta').textContent = `课包剩余 ${st.remaining} 节 · 共 ${s.expenses.length} 条`;

    const html = s.expenses.map((e, i) => {
      const cat = DB.CATEGORIES[e.category] || DB.CATEGORIES.other;
      const total = DB.expenseTotal(e);
      let amtSub = '';
      let chips = `<span class="chip sm">${cat.label}</span>`;

      if (e.category === 'package') {
        const rem = DB.remainingLessons(e);
        amtSub = `${e.totalLessons} 节 · 剩 ${rem} 节`;
        chips += `<span class="chip green sm">剩 ${rem} 节</span>`;
        if (e.coach) chips += `<span class="chip sm">${esc(e.coach)}</span>`;
      } else if (e.category === 'equipment') {
        const n = (e.subs || []).length;
        const kind = DB.EQUIP_KINDS[e.equipKind];
        amtSub = `总价 · ${n} 次采购`;
        if (kind && kind.label !== e.name) chips += `<span class="chip blue sm">${esc(kind.label)}</span>`;
      } else if (e.category === 'consumable') {
        const q = DB.consumableQty(e);
        if (q) amtSub = `${q} ${esc(e.unit || '')}`;
      } else if (e.category === 'alacarte') {
        const c = DB.alacarteCount(e);
        amtSub = `已上 ${c} 节`;
        chips += `<span class="chip gold sm">已上 ${c} 节</span>`;
        if (e.coach) chips += `<span class="chip sm">${esc(e.coach)}</span>`;
      } else if (e.category === 'venue') {
        amtSub = '场地费';
      }

      /* 子流水：课包=耗课 / 装备=采购实例 / 散买=每次上课 */
      let subsHTML = '';
      if (e.subs && e.subs.length) {
        const chrono = [...e.subs].sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
        let accL = 0;
        const map = {};
        chrono.forEach(sb => {
          accL += Number(sb.lessons) || 0;
          map[sb.id] = { rem: (Number(e.totalLessons) || 0) - accL };
        });
        const editable = e.category === 'equipment' || e.category === 'alacarte';
        subsHTML = `<div class="subs">` + [...chrono].reverse().map(sb => {
          const m = map[sb.id];
          let txt = '';
          if (e.category === 'package') txt = `耗 ${sb.lessons || 0} 节 · 剩 ${Math.max(0, m.rem)} 节`;
          else if (e.category === 'equipment') txt = DB.subSummary(sb);
          else if (e.category === 'alacarte') {
            txt = `一节课 · ¥${DB.fmtMoney(Number(sb.price) || 0)}`;
            if (sb.note) txt += ' · ' + esc(sb.note);
          } else txt = sb.note || '记录';
          return `<div class="sub-row">
            <span class="dot"></span>
            <span class="d">${sb.date ? DB.fmtDateShort(sb.date) : '—'}</span>
            <span class="t">${txt}</span>
            ${editable ? `<button class="ed" data-act="edit-sub" data-id="${e.id}" data-sub="${sb.id}">✎</button>` : ''}
            <button class="del" data-act="del-sub" data-id="${e.id}" data-sub="${sb.id}">✕</button>
          </div>`;
        }).join('') + `</div>`;
      }

      const canAppend = ['equipment', 'package', 'alacarte'].includes(e.category);
      const appendLabel = e.category === 'alacarte' ? '＋ 追加一节课'
        : e.category === 'equipment' ? '＋ 追加' : '＋ 追加';

      return `<div class="card item">
        <div class="item-top">
          <span class="seq">${i + 1}</span>
          <div class="item-main">
            <div class="item-name">${esc(e.name)}</div>
            ${e.brand ? `<div class="item-brand">${esc(e.brand)}</div>` : ''}
            <div class="tech-row">${chips}</div>
          </div>
          <div class="item-right">
            <div class="item-amt">¥${DB.fmtMoney(total)}</div>
            ${amtSub ? `<small>${amtSub}</small>` : ''}
          </div>
        </div>
        ${subsHTML}
        <div class="item-actions">
          ${canAppend ? `<button class="mini-btn primary" data-act="append" data-id="${e.id}">${appendLabel}</button>` : ''}
          <button class="mini-btn" data-act="edit-expense" data-id="${e.id}">编辑</button>
          <button class="mini-btn danger" data-act="del-expense" data-id="${e.id}">删除</button>
        </div>
      </div>`;
    }).join('');

    $('#expenseList').innerHTML = html || `<div class="empty"><span class="big">🎾</span>还没有记录，点右上角新增一笔</div>`;
  }

  /* ------- 记账表单 ------- */
  function openExpenseForm(editId) {
    const e = editId ? state().expenses.find(x => x.id === editId) : null;
    let cat = e ? e.category : 'equipment';
    let kind = (e && e.equipKind) || 'shoe';

    const catBtns = Object.entries(DB.CATEGORIES).map(([k, v]) =>
      `<button type="button" data-cat="${k}" class="${k === cat ? 'on' : ''}">${v.icon} ${v.label}</button>`).join('');

    openSheet(editId ? '编辑花费' : '新增一笔花费', `
      <div class="field">
        <label>类别</label>
        <div class="segmented" id="fCat">${catBtns}</div>
      </div>
      <div class="field"><label id="fNameLabel">名称</label>
        <input class="input" id="fName" placeholder="如：网球鞋 / 网球课课包" value="${e ? esc(e.name) : ''}"></div>
      <div id="fExtra"></div>
      <div class="field"><label>购买月份</label>
        <input type="month" class="input" id="fMonth" value="${e ? (e.dateMonth || '2026-10') : DB.monthKey(DB.todayStr())}"></div>
      <div class="field"><label>备注</label>
        <textarea class="input" id="fNote" placeholder="可选">${e ? esc(e.note || '') : ''}</textarea></div>
      <div class="form-actions">
        <button class="btn-lg ghost" data-close>取消</button>
        <button class="btn-lg primary" id="fSave">保存</button>
      </div>`, (root) => {

      const extra = root.querySelector('#fExtra');
      const nameLabel = root.querySelector('#fNameLabel');
      const val = id => { const el = root.querySelector('#' + id); return el ? el.value : ''; };

      /* 装备：按类型渲染「首次采购」的明细字段 */
      function renderKindFields() {
        const wrap = root.querySelector('#fKindFields');
        if (!wrap) return;
        const spec = DB.EQUIP_KINDS[kind] || DB.EQUIP_KINDS.otherEq;
        const first = editId && e && (e.subs || []).length ? e.subs[0] : null;
        wrap.innerHTML = spec.fields.map(([key, label]) => {
          const isNum = key === 'price';
          const v = first && first[key] != null ? first[key] : '';
          return `<div class="field"><label>${label}</label>
            <input ${isNum ? 'type="number" inputmode="decimal"' : ''} class="input" id="kf_${key}" placeholder="${isNum ? '0' : ''}" value="${esc(v)}"></div>`;
        }).join('');
      }

      function renderExtra() {
        if (cat === 'equipment') {
          nameLabel.textContent = '名称（装备总称，如网球鞋）';
          extra.innerHTML = `
            <div class="field"><label>装备类型</label>
              <div class="segmented" id="fKind">
                ${DB.EQUIP_KIND_KEYS.map(k => `<button type="button" data-k="${k}" class="${k === kind ? 'on' : ''}">${DB.EQUIP_KINDS[k].label}</button>`).join('')}
              </div></div>
            <div id="fKindFields"></div>
            <div class="hint" style="margin-bottom:12px">这里填的是<b>首次采购</b>的明细；以后又买了就在卡片上点「＋ 追加」，上方总价自动累加</div>`;
          root.querySelectorAll('#fKind button').forEach(b => {
            b.addEventListener('click', () => {
              kind = b.dataset.k;
              root.querySelectorAll('#fKind button').forEach(x => x.classList.toggle('on', x === b));
              renderKindFields();
            });
          });
          renderKindFields();

        } else if (cat === 'package') {
          nameLabel.textContent = '名称（课包）';
          extra.innerHTML = `
            <div class="field-row">
              <div class="field"><label>课包总价</label>
                <input type="number" inputmode="decimal" class="input" id="pTotal" placeholder="0" value="${e && e.totalPrice ? e.totalPrice : ''}"></div>
              <div class="field"><label>总节数</label>
                <input type="number" inputmode="numeric" class="input" id="pLessons" value="${e && e.totalLessons ? e.totalLessons : 14}"></div>
            </div>
            <div class="field"><label>俱乐部 / 机构</label>
              <input class="input" id="pClub" value="${e ? esc(e.club || '') : ''}"></div>
            <div class="field"><label>教练</label>
              <input class="input" id="pCoach" value="${e ? esc(e.coach || '') : ''}"></div>
            <div class="field"><label>单节成本</label>
              <div class="hint" id="pUnit">—</div></div>`;
          const up = () => {
            const tp = parseFloat(val('pTotal')) || 0;
            const tl = parseFloat(val('pLessons')) || 0;
            root.querySelector('#pUnit').textContent = tl > 0 ? `¥${DB.fmtMoney(tp / tl)} / 节（总价 ÷ 总节数自动计算）` : '填入总价与总节数后自动计算';
          };
          root.querySelector('#pTotal').addEventListener('input', up);
          root.querySelector('#pLessons').addEventListener('input', up);
          up();

        } else if (cat === 'alacarte') {
          nameLabel.textContent = '名称（散买课程）';
          extra.innerHTML = `
            <div class="field"><label>教练</label>
              <input class="input" id="pCoach" value="${e ? esc(e.coach || '') : ''}"></div>
            <div class="field"><label>俱乐部 / 场地</label>
              <input class="input" id="pClub" value="${e ? esc(e.club || '') : ''}"></div>
            <div class="hint" style="margin-bottom:12px">每次上课请在卡片上点「＋ 追加一节课」并填入<b>本次价格</b>；总花费按各次流水自动累加，每次价格可以不一样</div>`;

        } else if (cat === 'consumable') {
          nameLabel.textContent = '名称（每条耗材单独一条）';
          extra.innerHTML = `
            <div class="field-row">
              <div class="field"><label>价格 ¥</label>
                <input type="number" inputmode="decimal" class="input" id="cPrice" placeholder="0" value="${e && e.amount ? e.amount : ''}"></div>
              <div class="field"><label>数量（可选）</label>
                <input type="number" inputmode="decimal" class="input" id="cQty" placeholder="如 3" value="${e && e.qty ? e.qty : ''}"></div>
            </div>
            <div class="field"><label>单位（可选）</label>
              <select class="input" id="cUnit">
                <option value="">不填</option>
                ${DB.UNITS.map(u => `<option value="${u}" ${e && e.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
              </select></div>
            <div class="hint" style="margin-bottom:12px">耗材配件每条独立成行、各自填名称；这里的数量只作展示，不会再自动累加</div>`;

        } else if (cat === 'venue') {
          nameLabel.textContent = '名称（场地费）';
          extra.innerHTML = `
            <div class="field"><label>金额 ¥</label>
              <input type="number" inputmode="decimal" class="input" id="xAmount" placeholder="0" value="${e && e.amount ? e.amount : ''}"></div>`;

        } else {
          nameLabel.textContent = '名称';
          extra.innerHTML = `
            <div class="field-row">
              <div class="field"><label>金额 ¥</label>
                <input type="number" inputmode="decimal" class="input" id="xAmount" placeholder="0" value="${e && e.amount ? e.amount : ''}"></div>
              <div class="field"><label>品牌 / 型号（可选）</label>
                <input class="input" id="xBrand" value="${e ? esc(e.brand || '') : ''}"></div>
            </div>`;
        }
      }

      root.querySelectorAll('#fCat button').forEach(b => {
        b.addEventListener('click', () => {
          cat = b.dataset.cat;
          root.querySelectorAll('#fCat button').forEach(x => x.classList.toggle('on', x === b));
          renderExtra();
        });
      });
      renderExtra();

      root.querySelector('#fSave').addEventListener('click', () => {
        const name = root.querySelector('#fName').value.trim();
        if (!name) { toast('请填写名称'); return; }
        const dateMonth = root.querySelector('#fMonth').value || DB.monthKey(DB.todayStr());
        const note = root.querySelector('#fNote').value.trim();
        const payload = { category: cat, name, note, dateMonth };

        if (cat === 'equipment') {
          const spec = DB.EQUIP_KINDS[kind] || DB.EQUIP_KINDS.otherEq;
          const sub = { id: DB.uid('s'), date: dateMonth + '-01', note: '' };
          let price = 0;
          spec.fields.forEach(([k]) => {
            const v = val('kf_' + k);
            if (k === 'price') { price = parseFloat(v) || 0; sub.price = price; }
            else sub[k] = (v || '').trim();
          });
          if (price <= 0) { toast('请填写价格'); return; }
          payload.equipKind = kind;
          payload.brand = '';
          const old = (e && e.subs) || [];
          if (editId) {
            sub.id = old[0] ? old[0].id : sub.id;
            payload.subs = [sub].concat(old.slice(1));
          } else {
            payload.subs = [sub];
          }
          payload.amount = payload.subs.reduce((a, s2) => a + (Number(s2.price) || 0), 0);

        } else if (cat === 'package') {
          const tp = parseFloat(val('pTotal')) || 0;
          const tl = parseFloat(val('pLessons')) || 0;
          if (tl <= 0) { toast('请填写总节数'); return; }
          payload.isPackage = true;
          payload.totalLessons = tl;
          payload.totalPrice = tp;
          payload.amount = tp;
          payload.brand = '';
          payload.club = val('pClub');
          payload.coach = val('pCoach');

        } else if (cat === 'consumable') {
          payload.amount = parseFloat(val('cPrice')) || 0;
          payload.qty = parseFloat(val('cQty')) || 0;
          payload.unit = val('cUnit');
          payload.brand = '';

        } else if (cat === 'alacarte') {
          payload.brand = '';
          payload.coach = val('pCoach');
          payload.club = val('pClub');
          payload.amount = editId ? DB.alacarteTotal(e) : 0;

        } else if (cat === 'venue') {
          payload.amount = parseFloat(val('xAmount')) || 0;

        } else {
          payload.amount = parseFloat(val('xAmount')) || 0;
          payload.brand = val('xBrand');
        }

        if (editId) DB.updateExpense(editId, payload);
        else DB.addExpense(payload);

        closeSheet();
        refresh();
        toast(editId ? '已更新' : '已添加');
      });
    });
  }

  /* ------- 追加流水：装备采购 / 耗课 / 散买上课（支持编辑已有流水） ------- */
  function openAppendForm(id, subId) {
    const e = state().expenses.find(x => x.id === id);
    if (!e) return;
    const cat = e.category;
    const cur = subId ? (e.subs || []).find(s => s.id === subId) : null;
    const isEdit = !!cur;
    const today = DB.todayStr();

    /* 装备：追加一次采购 */
    if (cat === 'equipment') {
      const spec = DB.EQUIP_KINDS[e.equipKind] || DB.EQUIP_KINDS.otherEq;
      openSheet(isEdit ? '编辑采购记录' : '追加一次采购', `
        <div class="field"><label>日期</label>
          <input type="date" class="input" id="aDate" value="${cur ? (cur.date || today) : today}"></div>
        ${spec.fields.map(([k, lb]) => {
          const isNum = k === 'price';
          const v = cur && cur[k] != null ? cur[k] : '';
          return `<div class="field"><label>${lb}</label>
            <input ${isNum ? 'type="number" inputmode="decimal"' : ''} class="input" id="kf_${k}" placeholder="${isNum ? '0' : ''}" value="${esc(v)}"></div>`;
        }).join('')}
        <div class="hint" style="margin-bottom:14px">已有 <b style="color:#E0D9C6">${(e.subs || []).length}</b> 次采购，当前总价 <b style="color:#A9C77E">¥${DB.fmtMoney(DB.expenseTotal(e))}</b>，保存后自动累进</div>
        <div class="form-actions">
          <button class="btn-lg ghost" data-close>取消</button>
          <button class="btn-lg primary" id="aSave">${isEdit ? '保存修改' : '确认追加'}</button>
        </div>`, (root) => {
        root.querySelector('#aSave').addEventListener('click', () => {
          const patch = { date: root.querySelector('#aDate').value || today };
          let price = 0;
          spec.fields.forEach(([k]) => {
            const el = root.querySelector('#kf_' + k);
            const v = el ? el.value : '';
            if (k === 'price') { price = parseFloat(v) || 0; patch.price = price; }
            else patch[k] = (v || '').trim();
          });
          if (price <= 0) { toast('请填写价格'); return; }
          if (isEdit) DB.updateSub(e.id, cur.id, patch); else DB.addSub(e.id, patch);
          closeSheet(); refresh();
          toast(`已保存，本项总价 ¥${DB.fmtMoney(DB.expenseTotal(e))}`);
        });
      });
      return;
    }

    /* 课包：耗课（不填价格，课包已按总价计入） */
    if (cat === 'package') {
      const rem = DB.remainingLessons(e);
      openSheet('追加耗课', `
        <div class="field"><label>日期</label>
          <input type="date" class="input" id="aDate" value="${today}"></div>
        <div class="field"><label>本次消耗节数</label>
          <input type="number" inputmode="numeric" class="input" id="aLessons" value="1" min="1"></div>
        <div class="field"><label>备注</label>
          <input class="input" id="aNote" placeholder="可选，如：正手课"></div>
        <div class="hint" style="margin-bottom:14px">当前剩余 <b style="color:#A9C77E">${rem} 节</b>，保存后自动扣减（课包已按总价计入总花费，耗课无需再填价格）</div>
        <div class="form-actions">
          <button class="btn-lg ghost" data-close>取消</button>
          <button class="btn-lg primary" id="aSave">确认耗课</button>
        </div>`, (root) => {
        root.querySelector('#aSave').addEventListener('click', () => {
          const lessons = parseFloat(root.querySelector('#aLessons').value) || 1;
          if (lessons > DB.remainingLessons(e)) { toast('超出剩余节数'); return; }
          DB.addSub(e.id, {
            date: root.querySelector('#aDate').value || today,
            lessons, note: root.querySelector('#aNote').value.trim()
          });
          closeSheet(); refresh();
          toast(`已记录，本包还剩 ${DB.remainingLessons(e)} 节`);
        });
      });
      return;
    }

    /* 散买课：每次上课可不同价格 */
    if (cat === 'alacarte') {
      const cnt = DB.alacarteCount(e);
      openSheet(isEdit ? '编辑这次课' : '追加一节课', `
        <div class="field"><label>上课日期</label>
          <input type="date" class="input" id="aDate" value="${cur ? (cur.date || today) : today}"></div>
        <div class="field"><label>本次价格 ¥</label>
          <input type="number" inputmode="decimal" class="input" id="aPrice" placeholder="0" value="${cur && cur.price != null ? cur.price : ''}"></div>
        <div class="field"><label>备注</label>
          <input class="input" id="aNote" placeholder="可选，如：体验课 / 换了教练" value="${cur ? esc(cur.note || '') : ''}"></div>
        <div class="hint" style="margin-bottom:14px">已上 <b style="color:#E8C56A">${cnt}</b> 节，累计 <b style="color:#A9C77E">¥${DB.fmtMoney(DB.alacarteTotal(e))}</b>；每次价格可不同，自动累加</div>
        <div class="form-actions">
          <button class="btn-lg ghost" data-close>取消</button>
          <button class="btn-lg primary" id="aSave">${isEdit ? '保存修改' : '确认'}</button>
        </div>`, (root) => {
        root.querySelector('#aSave').addEventListener('click', () => {
          const price = parseFloat(root.querySelector('#aPrice').value) || 0;
          if (price <= 0) { toast('请填写本次价格'); return; }
          const patch = {
            date: root.querySelector('#aDate').value || today,
            lessons: 1, price,
            note: root.querySelector('#aNote').value.trim()
          };
          if (isEdit) DB.updateSub(e.id, cur.id, patch); else DB.addSub(e.id, patch);
          closeSheet(); refresh();
          toast(`已保存，共 ${DB.alacarteCount(e)} 节 · ¥${DB.fmtMoney(DB.alacarteTotal(e))}`);
        });
      });
      return;
    }
  }

  /* ---------------- 学习记录 ---------------- */
  function typeChip(t) {
    const m = DB.LESSON_TYPES[t] || DB.LESSON_TYPES.class;
    return `<span class="chip ${m.tone} sm">${m.label}</span>`;
  }

  function renderLearn() {
    const s = state();
    const st = DB.computeStats();
    $('#learnMeta').textContent = `累计网球时长 ${DB.fmtHours(st.totalH)} · 上课 ${DB.fmtHours(st.classH)} / 自练 ${DB.fmtHours(st.selfH)}`;

    const venueMap = {};
    s.venues.forEach(v => venueMap[v.id] = v.name);

    const list = [...s.lessons].sort((a, b) => {
      if (a.date === b.date) return (b.createdAt || 0) - (a.createdAt || 0);
      return (a.date || '') < (b.date || '') ? 1 : -1;
    });

    $('#lessonList').innerHTML = list.map(l => {
      const atts = l.attachments || [];
      return `<div class="card item lesson">
        <div class="l-head">
          <span class="l-date">${esc(l.date || '')}</span>
          ${typeChip(l.type)}
          <span class="l-hours">${DB.fmtHours(l.hours)}</span>
        </div>
        <div class="l-meta">
          ${l.person ? `<span>${esc(l.person)}</span>` : ''}
          ${l.person && l.venueId ? `<span class="sep">·</span>` : ''}
          ${l.venueId ? `<span>${esc(venueMap[l.venueId] || '')}</span>` : ''}
          ${l.cost ? `<span class="sep">·</span><span>¥${DB.fmtMoney(l.cost)}</span>` : ''}
        </div>
        ${(l.techPoints || []).length ? `<div class="tech-row">${l.techPoints.map(t => `<span class="chip green sm">${esc(t)}</span>`).join('')}</div>` : ''}
        ${l.gains ? `<div class="gain"><span class="ico">✅</span><span>${esc(l.gains)}</span></div>` : ''}
        ${l.tips ? `<div class="tips-box"><div class="tips-head" data-act="toggle-tips"><span>⚠️</span><span>Tips / 易错点</span><span class="arrow">›</span></div><div class="tips-body">${esc(l.tips)}</div></div>` : ''}
        ${atts.length ? `<div class="thumbs">${atts.map(a => `
          <div class="thumb" data-act="open-media" data-id="${a.id}">
            ${a.type === 'video' ? `<div class="play">▶</div><div class="vtag">视频</div>` : `<img alt="">`}
          </div>`).join('')}</div>` : ''}
        <div class="item-actions">
          <button class="mini-btn" data-act="edit-lesson" data-id="${l.id}">编辑</button>
          <button class="mini-btn danger" data-act="del-lesson" data-id="${l.id}">删除</button>
        </div>
      </div>`;
    }).join('') || `<div class="empty"><span class="big">🎾</span>还没有训练记录，点右上角记一次</div>`;

    hydrateThumbs();
  }

  function hydrateThumbs() {
    const s = state();
    const map = {};
    s.lessons.forEach(l => (l.attachments || []).forEach(a => map[a.id] = a));
    document.querySelectorAll('[data-act="open-media"]').forEach(node => {
      const att = map[node.dataset.id];
      if (!att || att.type === 'video') return;
      const img = node.querySelector('img');
      if (!img) return;
      DB.mediaURL(att.id).then(url => { if (url) img.src = url; });
    });
  }

  /* ------- 学习记录表单 ------- */
  let pendingFiles = [];
  function openLessonForm(editId) {
    const l = editId ? state().lessons.find(x => x.id === editId) : null;
    const s = state();
    pendingFiles = [];
    let techSel = l ? [...(l.techPoints || [])] : [];
    let type = l ? l.type : 'class';
    let atts = l ? [...(l.attachments || [])] : [];

    const venueOpts = [`<option value="">未指定</option>`]
      .concat(s.venues.map(v => `<option value="${v.id}" ${l && l.venueId === v.id ? 'selected' : ''}>${esc(v.name)}</option>`))
      .join('');

    const courseOpts = [`<option value="">不关联</option>`]
      .concat(s.expenses.filter(e => e.category === 'package' || e.category === 'alacarte')
        .map(e => `<option value="${e.id}" ${l && l.courseId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`))
      .join('');

    openSheet(editId ? '编辑训练记录' : '记一次训练', `
      <div class="field-row">
        <div class="field"><label>日期</label>
          <input type="date" class="input" id="lDate" value="${l ? l.date : DB.todayStr()}"></div>
        <div class="field"><label>时长（小时）</label>
          <input type="number" inputmode="decimal" step="0.5" class="input" id="lHours" value="${l ? l.hours : 1}"></div>
      </div>

      <div class="field"><label>训练类型</label>
        <div class="segmented" id="lType">
          ${Object.entries(DB.LESSON_TYPES).map(([k, v]) => `<button type="button" data-type="${k}" class="${k === type ? 'on' : ''}">${v.label}</button>`).join('')}
        </div>
      </div>

      <div class="field"><label id="lPersonLabel">对象 / 谁</label>
        <input class="input" id="lPerson" placeholder="教练 / 陪练 / 搭子姓名" value="${l ? esc(l.person || '') : ''}"></div>

      <div class="field"><label>场地</label>
        <select class="input" id="lVenue">${venueOpts}</select></div>

      <div class="field"><label>技术点</label>
        <div class="segmented" id="lTech"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input class="input" id="lTechNew" placeholder="自定义技术点" style="flex:1">
          <button class="btn-ghost" id="lTechAdd" type="button" style="min-height:44px">添加</button>
        </div>
      </div>

      <div class="field"><label>收获 / 进步</label>
        <textarea class="input" id="lGains" placeholder="一句话，比如：正手击球点更靠前了">${l ? esc(l.gains || '') : ''}</textarea></div>

      <div class="field"><label>Tips / 易错点 / 下次注意</label>
        <textarea class="input" id="lTips" placeholder="自由记录要点">${l ? esc(l.tips || '') : ''}</textarea></div>

      <div class="field-row">
        <div class="field"><label>本次费用（可选）</label>
          <input type="number" inputmode="decimal" class="input" id="lCost" placeholder="0" value="${l ? (l.cost || '') : ''}"></div>
        <div class="field"><label>关联课包 / 课程</label>
          <select class="input" id="lCourse">${courseOpts}</select></div>
      </div>

      <div class="field" id="lDeductWrap" style="display:none">
        <div class="switch-row" style="padding-top:0">
          <div><div class="t">同时扣 1 节</div><div class="d">并计入该课包花费流水</div></div>
          <div class="switch" id="lDeduct"></div>
        </div>
      </div>

      <div class="field"><label>照片 / 视频</label>
        <input type="file" class="input" id="lFiles" accept="image/*,video/*" multiple style="padding:9px">
        <div class="thumbs" id="lThumbs"></div>
        <div class="hint">iPhone 可直接从相册选择；视频较大时建议 1080p 或短片</div>
      </div>

      <div class="form-actions">
        <button class="btn-lg ghost" data-close>取消</button>
        <button class="btn-lg primary" id="lSave">保存</button>
      </div>`, (root) => {

      const techBox = root.querySelector('#lTech');
      function renderTech() {
        const all = Array.from(new Set([...DB.TECH_PRESETS, ...techSel]));
        techBox.innerHTML = all.map(t => `<button type="button" data-tech="${esc(t)}" class="${techSel.includes(t) ? 'on' : ''}">${esc(t)}</button>`).join('');
      }
      renderTech();
      techBox.addEventListener('click', ev => {
        const b = ev.target.closest('button[data-tech]');
        if (!b) return;
        const t = b.dataset.tech;
        if (techSel.includes(t)) techSel = techSel.filter(x => x !== t);
        else techSel.push(t);
        renderTech();
      });
      root.querySelector('#lTechAdd').addEventListener('click', () => {
        const inp = root.querySelector('#lTechNew');
        const v = inp.value.trim();
        if (!v) return;
        if (!techSel.includes(v)) techSel.push(v);
        inp.value = '';
        renderTech();
      });

      const personLabel = root.querySelector('#lPersonLabel');
      const personInput = root.querySelector('#lPerson');
      function syncPersonLabel() {
        const map = { class: '教练', partner: '陪练对象', machine: '—（发球机）', sparring: '搭子', solo: '—' };
        personLabel.textContent = '对象 / 谁';
        personInput.placeholder = map[type] ? map[type] : '姓名';
        personInput.disabled = (type === 'machine' || type === 'solo');
      }
      root.querySelectorAll('#lType button').forEach(b => {
        b.addEventListener('click', () => {
          type = b.dataset.type;
          root.querySelectorAll('#lType button').forEach(x => x.classList.toggle('on', x === b));
          syncPersonLabel();
        });
      });
      syncPersonLabel();

      function renderThumbs() {
        const box = root.querySelector('#lThumbs');
        box.innerHTML =
          atts.map(a => `<div class="thumb" data-act="open-media" data-id="${a.id}">
            ${a.type === 'video' ? `<div class="play">▶</div><div class="vtag">视频</div>` : `<img alt="">`}
            <button class="del" data-act="rm-att" data-id="${a.id}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);border-radius:50%;width:18px;height:18px;font-size:10px;color:#fff">✕</button>
          </div>`).join('') +
          pendingFiles.map((p, i) => `<div class="thumb">
            ${p.type === 'video' ? `<div class="play">▶</div><div class="vtag">视频</div>` : `<img src="${p.url}" alt="">`}
            <button data-act="rm-pending" data-i="${i}" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);border-radius:50%;width:18px;height:18px;font-size:10px;color:#fff">✕</button>
          </div>`).join('') +
          `<label class="thumb add">＋<input type="file" id="lFiles2" accept="image/*,video/*" multiple hidden></label>`;

        box.querySelectorAll('[data-act="rm-att"]').forEach(b => b.addEventListener('click', () => {
          const id = b.dataset.id;
          atts = atts.filter(a => a.id !== id);
          DB.media.del(id).catch(() => {});
          renderThumbs();
        }));
        box.querySelectorAll('[data-act="rm-pending"]').forEach(b => b.addEventListener('click', () => {
          const i = Number(b.dataset.i);
          URL.revokeObjectURL(pendingFiles[i].url);
          pendingFiles.splice(i, 1);
          renderThumbs();
        }));
        const f2 = box.querySelector('#lFiles2');
        if (f2) f2.addEventListener('change', () => { addFiles(f2.files); });
        hydrateIn(root);
      }

      function hydrateIn(root) {
        const map = {};
        atts.forEach(a => map[a.id] = a);
        root.querySelectorAll('#lThumbs [data-act="open-media"]').forEach(node => {
          const att = map[node.dataset.id];
          if (!att || att.type === 'video') return;
          const img = node.querySelector('img');
          if (!img) return;
          DB.mediaURL(att.id).then(u => { if (u) img.src = u; });
        });
      }

      function addFiles(fileList) {
        Array.from(fileList).forEach(f => {
          const isVideo = f.type.startsWith('video') || /\.(mov|mp4|m4v|webm)$/i.test(f.name);
          pendingFiles.push({ file: f, type: isVideo ? 'video' : 'image', url: isVideo ? '' : URL.createObjectURL(f) });
        });
        renderThumbs();
      }

      root.querySelector('#lFiles').addEventListener('change', function () { addFiles(this.files); this.value = ''; });
      renderThumbs();

      const courseSel = root.querySelector('#lCourse');
      const deductWrap = root.querySelector('#lDeductWrap');
      let deduct = false;
      function syncDeduct() {
        const e = state().expenses.find(x => x.id === courseSel.value);
        if (e && e.category === 'package') {
          deductWrap.style.display = '';
          deductWrap.querySelector('.d').textContent = `本包还剩 ${DB.remainingLessons(e)} 节`;
        } else {
          deductWrap.style.display = 'none';
          deduct = false;
          const sw = root.querySelector('#lDeduct');
          if (sw) sw.classList.remove('on');
        }
      }
      courseSel.addEventListener('change', syncDeduct);
      syncDeduct();
      const sw = root.querySelector('#lDeduct');
      if (sw) sw.addEventListener('click', function () { deduct = !deduct; this.classList.toggle('on', deduct); });

      root.querySelector('#lSave').addEventListener('click', async () => {
        const date = root.querySelector('#lDate').value || DB.todayStr();
        const hours = parseFloat(root.querySelector('#lHours').value) || 0;
        const person = personInput.disabled ? '' : personInput.value.trim();
        const venueId = root.querySelector('#lVenue').value;
        const gains = root.querySelector('#lGains').value.trim();
        const tips = root.querySelector('#lTips').value.trim();
        const cost = parseFloat(root.querySelector('#lCost').value) || 0;
        const courseId = courseSel.value;

        const btn = root.querySelector('#lSave');
        btn.disabled = true; btn.textContent = '保存中…';

        try {
          for (const p of pendingFiles) {
            const id = DB.uid('m');
            await DB.media.put(id, p.file);
            atts.push({ id, type: p.type, name: p.file.name, size: p.file.size, mime: p.file.type });
          }
        } catch (err) {
          console.error(err);
          toast('附件保存失败，可能空间不足');
        }
        pendingFiles = [];

        const payload = { date, hours, type, person, venueId, techPoints: techSel, gains, tips, cost, courseId, attachments: atts };
        if (editId) DB.updateLesson(editId, payload);
        else DB.addLesson(payload);

        if (courseId && deduct) {
          const e = state().expenses.find(x => x.id === courseId);
          if (e && e.category === 'package' && DB.remainingLessons(e) >= 1) {
            DB.addSub(e.id, { date, lessons: 1, note: '训练记录同步扣课' });
          } else if (e && e.category === 'alacarte') {
            /* 默认沿用上一次的课价，可在学费卡片里再改 */
            const last = (e.subs || []).slice(-1)[0];
            DB.addSub(e.id, { date, lessons: 1, price: Number(last && last.price) || 0, note: '训练记录同步' });
          }
        }

        closeSheet();
        refresh();
        toast(editId ? '已更新' : '已记录');
      });
    });
  }

  /* ---------------- 日历 ---------------- */
  let calCollapsed = false;
  function renderCalendar() {
    const year = new Date().getFullYear();
    $('#calYear').textContent = year;
    const box = $('#calendar');
    if (calCollapsed) { box.style.display = 'none'; return; }
    box.style.display = '';

    const hoursMap = DB.lessonHoursByDay();
    const today = DB.todayStr();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    let html = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(year, m, 1).getDay();
      const lastDay = new Date(year, m + 1, 0).getDate();
      let cells = '';
      for (let i = 0; i < first; i++) cells += `<span class="out"></span>`;
      for (let d = 1; d <= lastDay; d++) {
        const ds = `${year}-${DB.pad2(m + 1)}-${DB.pad2(d)}`;
        const h = hoursMap[ds] || 0;
        let lv = 'lv0';
        if (h > 0 && h <= 1) lv = 'lv1';
        else if (h > 1 && h <= 2) lv = 'lv2';
        else if (h > 2) lv = 'lv3';
        const cls = [lv, h > 0 ? 'has' : '', ds === today ? 'today' : ''].join(' ');
        cells += `<span class="${cls}" data-act="day" data-date="${ds}" title="${ds}${h ? ' · ' + h + 'h' : ''}"></span>`;
      }
      html += `<div class="cal-month">
        <div class="m-label">${monthNames[m]}</div>
        <div class="cal-grid">${cells}</div>
      </div>`;
    }
    box.innerHTML = html;
  }

  function openDaySheet(ds) {
    const s = state();
    const list = s.lessons.filter(l => l.date === ds);
    const venueMap = {}; s.venues.forEach(v => venueMap[v.id] = v.name);
    const total = list.reduce((a, l) => a + (Number(l.hours) || 0), 0);
    openSheet(`${ds} · ${DB.fmtHours(total)}`, list.length ? `
      <div class="list" style="padding:0">
        ${list.map(l => `<div class="card item lesson">
          <div class="l-head"><span class="l-date">${esc(l.date)}</span>${typeChip(l.type)}<span class="l-hours">${DB.fmtHours(l.hours)}</span></div>
          <div class="l-meta">${l.person ? esc(l.person) : ''}${l.venueId ? ' · ' + esc(venueMap[l.venueId] || '') : ''}</div>
          ${(l.techPoints || []).length ? `<div class="tech-row">${l.techPoints.map(t => `<span class="chip green sm">${esc(t)}</span>`).join('')}</div>` : ''}
          ${l.gains ? `<div class="gain"><span class="ico">✅</span><span>${esc(l.gains)}</span></div>` : ''}
          ${l.tips ? `<div class="tips-box open"><div class="tips-head"><span>⚠️</span><span>Tips</span></div><div class="tips-body">${esc(l.tips)}</div></div>` : ''}
        </div>`).join('')}
      </div>` : `<div class="empty"><span class="big">🌿</span>这天没有训练记录</div>`);
  }

  /* ---------------- 场地档案 ---------------- */
  function starsHTML(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += `<span class="${i <= n ? 'on' : 'off'}">★</span>`;
    return s;
  }

  function renderVenues() {
    const s = state();
    const vs = DB.venueStats();
    $('#venueMeta').textContent = `共 ${s.venues.length} 家 · 自动统计次数与时长`;

    $('#venueList').innerHTML = s.venues.map(v => {
      const st = vs[v.id] || { count: 0, hours: 0, cost: 0, last: '' };
      return `<div class="card item venue">
        <div class="v-head">
          <div style="flex:1;min-width:0">
            <div class="v-name">${esc(v.name)}</div>
            <div class="stars">${starsHTML(v.rating || 0)}</div>
          </div>
          <div class="item-right">
            <div class="item-amt">${st.count}<small style="display:inline;margin-left:2px">次</small></div>
          </div>
        </div>
        ${(v.types && v.types.length) ? `<div class="tech-row">${v.types.map(t => `<span class="chip blue sm">${esc(t)}</span>`).join('')}${v.fee ? `<span class="chip orange sm">¥${DB.fmtMoney(v.fee)}/次</span>` : ''}</div>` : (v.fee ? `<div class="tech-row"><span class="chip orange sm">¥${DB.fmtMoney(v.fee)}/次</span></div>` : '')}
        ${v.review ? `<div class="v-review">“${esc(v.review)}”</div>` : ''}
        ${v.address ? `<div class="item-brand">${esc(v.address)}</div>` : ''}
        <div class="v-stats">
          <span><b>${st.count}</b>次</span>
          <span><b>${DB.fmtHours(st.hours)}</b>累计</span>
          ${st.last ? `<span>最近 <b>${DB.fmtDateShort(st.last)}</b></span>` : ''}
        </div>
        <div class="thumbs v-thumbs">
          ${(v.photos || []).map(p => `<div class="thumb" data-act="open-media" data-id="${p.id}"><img alt=""></div>`).join('')}
          <div class="thumb add" data-act="add-venue-photo" data-id="${v.id}"><span style="text-align:center;line-height:1.15"><span style="font-size:19px">＋</span><br><span style="font-size:9px">照片</span></span></div>
        </div>
        <div class="item-actions">
          <button class="mini-btn" data-act="edit-venue" data-id="${v.id}">编辑</button>
          <button class="mini-btn danger" data-act="del-venue" data-id="${v.id}">删除</button>
        </div>
      </div>`;
    }).join('') || `<div class="empty"><span class="big">📍</span>还没有球场，点右上角添加</div>`;

    hydrateVenuePhotos();
  }

  function hydrateVenuePhotos() {
    const map = {};
    state().venues.forEach(v => (v.photos || []).forEach(p => map[p.id] = p));
    document.querySelectorAll('.v-thumbs [data-act="open-media"]').forEach(node => {
      const img = node.querySelector('img');
      if (!img || !map[node.dataset.id]) return;
      DB.mediaURL(node.dataset.id).then(u => { if (u) img.src = u; });
    });
  }

  /* 球场照片：从相册选择，存 IndexedDB */
  function pickVenuePhoto(venueId) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = true;
    inp.addEventListener('change', async () => {
      const files = Array.from(inp.files || []);
      if (!files.length) return;
      let n = 0;
      for (const f of files) {
        try {
          const id = DB.uid('m');
          await DB.media.put(id, f);
          const v = state().venues.find(x => x.id === venueId);
          if (!v) break;
          v.photos = v.photos || [];
          v.photos.push({ id, type: 'image', name: f.name, size: f.size, mime: f.type });
          n++;
        } catch (err) { console.error(err); }
      }
      DB.save();
      refresh();
      toast(n ? `已添加 ${n} 张照片` : '添加失败');
    });
    inp.click();
  }

  function openVenueForm(editId) {
    const v = editId ? state().venues.find(x => x.id === editId) : null;
    let rating = v ? (v.rating || 0) : 0;
    let types = v ? [...(v.types || [])] : [];

    openSheet(editId ? '编辑球场' : '新增球场', `
      <div class="field"><label>名称</label>
        <input class="input" id="vName" placeholder="如 东风9号球场" value="${v ? esc(v.name) : ''}"></div>
      <div class="field"><label>地址</label>
        <input class="input" id="vAddr" placeholder="可选" value="${v ? esc(v.address || '') : ''}"></div>
      <div class="field"><label>场地类型（可多选）</label>
        <div class="segmented" id="vTypes">
          ${DB.VENUE_TYPES.map(t => `<button type="button" data-t="${t}" class="${types.includes(t) ? 'on' : ''}">${t}</button>`).join('')}
        </div></div>
      <div class="field-row">
        <div class="field"><label>场地费（每次）</label>
          <input type="number" inputmode="decimal" class="input" id="vFee" placeholder="0" value="${v && v.fee ? v.fee : ''}"></div>
        <div class="field"><label>自评</label>
          <div class="segmented" id="vStars" style="gap:2px">
            ${[1, 2, 3, 4, 5].map(i => `<button type="button" data-r="${i}" style="padding:9px 8px;font-size:19px;color:${i <= rating ? '#E8C56A' : 'rgba(242,237,225,.2)'}">★</button>`).join('')}
          </div></div>
      </div>
      <div class="field"><label>一句点评</label>
        <textarea class="input" id="vReview" placeholder="如：灯光好但周末难约" style="min-height:60px">${v ? esc(v.review || '') : ''}</textarea></div>
      <div class="field"><label>备注</label>
        <input class="input" id="vNote" value="${v ? esc(v.note || '') : ''}"></div>
      <div class="form-actions">
        <button class="btn-lg ghost" data-close>取消</button>
        <button class="btn-lg primary" id="vSave">保存</button>
      </div>`, (root) => {
      root.querySelectorAll('#vTypes button').forEach(b => b.addEventListener('click', () => {
        const t = b.dataset.t;
        if (types.includes(t)) types = types.filter(x => x !== t); else types.push(t);
        b.classList.toggle('on', types.includes(t));
      }));
      root.querySelectorAll('#vStars button').forEach(b => b.addEventListener('click', () => {
        rating = Number(b.dataset.r);
        root.querySelectorAll('#vStars button').forEach(x => {
          x.style.color = Number(x.dataset.r) <= rating ? '#E8C56A' : 'rgba(242,237,225,.2)';
        });
      }));
      root.querySelector('#vSave').addEventListener('click', () => {
        const name = root.querySelector('#vName').value.trim();
        if (!name) { toast('请填写名称'); return; }
        const payload = {
          name,
          address: root.querySelector('#vAddr').value.trim(),
          types,
          fee: parseFloat(root.querySelector('#vFee').value) || 0,
          rating,
          review: root.querySelector('#vReview').value.trim(),
          note: root.querySelector('#vNote').value.trim()
        };
        if (editId) DB.updateVenue(editId, payload); else DB.addVenue(payload);
        closeSheet(); refresh(); toast(editId ? '已更新' : '已添加');
      });
    });
  }

  /* ---------------- 报告 ---------------- */
  let tipsFilter = '全部';

  function barRow(name, amount, pct, cls) {
    return `<div class="bar-row">
      <div class="bar-top"><span class="n">${name}</span><span class="v">¥${DB.fmtMoney(amount)} <small style="color:#8C9884;font-weight:500">${pct}%</small></span></div>
      <div class="bar-track"><div class="bar-fill ${cls || ''}" style="width:${Math.max(2, pct)}%"></div></div>
    </div>`;
  }

  function renderReport() {
    const s = state();
    const st = DB.computeStats();
    const venueStats = DB.venueStats();
    const venueMap = {}; s.venues.forEach(v => venueMap[v.id] = v.name);

    /* 花费构成 */
    const cats = [
      { k: '装备', v: st.equip, cls: '' },
      { k: '课程（课包+散买）', v: st.coach, cls: 'o' },
      { k: '耗材配件', v: st.consum, cls: 'b' },
      { k: '场地', v: st.venueFee, cls: '' },
      { k: '其他', v: st.other, cls: '' }
    ].filter(c => c.v > 0);
    const totalForPct = st.total || 1;

    /* 按月 */
    const months = {};
    s.expenses.forEach(e => {
      const mk = e.dateMonth || '';
      if (!months[mk]) months[mk] = { exp: 0, lessons: [] };
      months[mk].exp += DB.expenseTotal(e);
    });
    s.lessons.forEach(l => {
      const mk = DB.monthKey(l.date);
      if (!months[mk]) months[mk] = { exp: 0, lessons: [] };
      months[mk].lessons.push(l);
    });
    const monthKeys = Object.keys(months).filter(Boolean).sort().reverse();

    /* Tips */
    const tipLessons = s.lessons.filter(l => l.tips && l.tips.trim());
    const tipTechs = Array.from(new Set(tipLessons.flatMap(l => l.techPoints || [])));
    const filteredTips = tipLessons
      .filter(l => tipsFilter === '全部' || (l.techPoints || []).includes(tipsFilter))
      .sort((a, b) => (a.date || '') < (b.date || '') ? 1 : -1);

    /* 收获 */
    const gainLessons = s.lessons.filter(l => l.gains && l.gains.trim())
      .sort((a, b) => (a.date || '') < (b.date || '') ? 1 : -1);

    /* 装备 & 耗材 */
    const equips = s.expenses.filter(e => e.category === 'equipment');
    const consums = s.expenses.filter(e => e.category === 'consumable');

    $('#reportBody').innerHTML = `
      <div class="r-card">
        <div class="r-title">花费构成 <span class="tag">总 ¥${DB.fmtMoney(st.total)}</span></div>
        ${cats.map(c => barRow(c.k, c.v, Math.round(c.v / totalForPct * 100), c.cls)).join('') || '<div class="empty">暂无数据</div>'}
      </div>

      <div class="r-card">
        <div class="r-title">关键指标</div>
        <div class="kv-grid">
          <div class="kv"><div class="k">累计网球总时长</div><div class="v">${DB.fmtHours(st.totalH)}</div></div>
          <div class="kv"><div class="k">上课 / 自练</div><div class="v">${DB.fmtHours(st.classH)} <small>/ ${DB.fmtHours(st.selfH)}</small></div></div>
          <div class="kv"><div class="k">课包剩余</div><div class="v">${st.remaining} <small>节</small></div></div>
          <div class="kv"><div class="k">累计训练</div><div class="v">${s.lessons.length} <small>次</small></div></div>
        </div>
      </div>

      <div class="r-card">
        <div class="r-title">按月 <span class="tag">${monthKeys.length} 个月</span></div>
        ${monthKeys.map(mk => {
          const m = months[mk];
          const h = m.lessons.reduce((a, l) => a + (Number(l.hours) || 0), 0);
          return `<div class="month-group">
            <div class="month-head"><b>${DB.fmtMonth(mk)}</b><span>练习 ${DB.fmtHours(h)}</span><span class="sum">¥${DB.fmtMoney(m.exp)}</span></div>
            ${m.lessons.length ? m.lessons.sort((a, b) => (a.date || '') < (b.date || '') ? 1 : -1).map(l => `<div class="row-line">
              <span class="l">${DB.fmtDateShort(l.date)} · ${esc(l.person || (DB.LESSON_TYPES[l.type] || {}).label || '训练')}</span>
              <span class="r">${DB.fmtHours(l.hours)}</span>
            </div>`).join('') : ''}
          </div>`;
        }).join('') || '<div class="empty">暂无记录</div>'}
      </div>

      <div class="r-card">
        <div class="r-title">Tips 仓库 <span class="tag">${tipLessons.length} 条</span></div>
        ${tipTechs.length ? `<div class="filter-row">
          <span class="chip ${tipsFilter === '全部' ? 'on' : ''}" data-act="tip-filter" data-t="全部">全部</span>
          ${tipTechs.map(t => `<span class="chip ${tipsFilter === t ? 'on' : ''}" data-act="tip-filter" data-t="${esc(t)}">${esc(t)}</span>`).join('')}
        </div>` : ''}
        ${filteredTips.length ? filteredTips.map(l => `<div class="row-line" style="display:block">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:3px">
            <span class="l" style="font-size:11px">${DB.fmtDateShort(l.date)} · ${esc(l.person || '')}</span>
            ${(l.techPoints || []).map(t => `<span class="chip sm">${esc(t)}</span>`).join('')}
          </div>
          <div style="font-size:12.5px;line-height:1.55;color:#E0D9C6;white-space:pre-wrap">${esc(l.tips)}</div>
        </div>`).join('') : '<div class="empty" style="padding:10px">还没有 Tips，训练后随手记一句</div>'}
      </div>

      <div class="r-card">
        <div class="r-title">收获时间线 <span class="tag">${gainLessons.length} 条</span></div>
        ${gainLessons.length ? `<div class="timeline">
          ${gainLessons.map(l => `<div class="tl-item">
            <div class="tl-date">${esc(l.date)} · ${esc(l.person || '')}</div>
            <div class="tl-text">${esc(l.gains)}</div>
          </div>`).join('')}
        </div>` : '<div class="empty" style="padding:10px">每次记一条「收获」，这里会长出你的进步轨迹</div>'}
      </div>

      <div class="r-card">
        <div class="r-title">球场汇总 <span class="tag">${s.venues.length} 家</span></div>
        ${s.venues.map(v => {
          const vs2 = venueStats[v.id] || { count: 0, hours: 0 };
          return `<div class="row-line">
            <span class="l">${esc(v.name)} ${v.rating ? '· ' + '★'.repeat(v.rating) : ''}</span>
            <span class="r">${vs2.count} 次<small>${DB.fmtHours(vs2.hours)}</small></span>
          </div>`;
        }).join('') || '<div class="empty" style="padding:8px">暂无球场</div>'}
      </div>

      <div class="r-card">
        <div class="r-title">装备清单 <span class="tag">${equips.length} 类</span></div>
        ${equips.map(x => `<div class="row-line">
          <span class="l">${esc(x.name)}<small style="color:var(--dim)"> · ${(x.subs || []).length} 次采购</small></span>
          <span class="r">¥${DB.fmtMoney(DB.expenseTotal(x))}</span>
        </div>`).join('') || '<div class="empty" style="padding:8px">暂无装备</div>'}
      </div>

      <div class="r-card">
        <div class="r-title">耗材配件明细 <span class="tag">${consums.length} 条</span></div>
        ${consums.map(x => {
          const q = DB.consumableQty(x);
          return `<div class="row-line">
            <span class="l">${esc(x.name)}${x.note ? '<small style="color:var(--dim)"> · ' + esc(x.note) + '</small>' : ''}</span>
            <span class="r">${q ? q + ' ' + esc(x.unit || '') : '—'}<small>¥${DB.fmtMoney(DB.expenseTotal(x))}</small></span>
          </div>`;
        }).join('') || '<div class="empty" style="padding:8px">暂无耗材</div>'}
      </div>

      <div class="r-card">
        <div class="r-title">备份</div>
        <div class="set-list">
          <div class="set-item" data-act="export-json"><span class="ico">🗂</span><div class="txt">导出 JSON<div class="d">文字数据，不含照片视频</div></div><span class="chev">›</span></div>
          <div class="set-item" data-act="export-zip"><span class="ico">📦</span><div class="txt">导出 ZIP（含媒体）<div class="d">照片视频一起打包，换设备可完整恢复</div></div><span class="chev">›</span></div>
          <div class="set-item" data-act="import"><span class="ico">📥</span><div class="txt">导入备份<div class="d">支持 .json 或 .zip</div></div><span class="chev">›</span></div>
        </div>
      </div>
      <div style="height:6px"></div>`;
  }

  /* ---------------- 设置 ---------------- */
  function openSettings() {
    const s = state();
    openSheet('设置', `
      <div class="field"><label>工作台名称</label>
        <input class="input" id="sName" value="${esc(s.settings.appName || '')}">
        <div class="hint">会同步到首页标题与「添加到主屏幕」的图标名</div></div>
      <div class="field"><label>技术等级（手动）</label>
        <input class="input" id="sTech" value="${esc(s.settings.techLevel || '1.0')}" placeholder="如 1.0 / 2.5 / 3.0"></div>
      <div class="form-actions" style="margin-top:6px">
        <button class="btn-lg primary" id="sSave">保存</button>
      </div>

      <div class="r-title" style="margin:20px 0 9px">数据备份</div>
      <div class="set-list">
        <div class="set-item" data-act="export-json"><span class="ico">🗂</span><div class="txt">导出 JSON<div class="d">文字数据，不含照片视频</div></div><span class="chev">›</span></div>
        <div class="set-item" data-act="export-zip"><span class="ico">📦</span><div class="txt">导出 ZIP（含媒体）<div class="d">照片视频一起打包</div></div><span class="chev">›</span></div>
        <div class="set-item" data-act="import"><span class="ico">📥</span><div class="txt">导入备份<div class="d">支持 .json 或 .zip，会覆盖当前数据</div></div><span class="chev">›</span></div>
        <div class="set-item" data-act="install-guide"><span class="ico">📱</span><div class="txt">如何添加到主屏幕<div class="d">iPhone Safari：分享 → 添加到主屏幕</div></div><span class="chev">›</span></div>
        <div class="set-item" data-act="clear-all"><span class="ico">🗑</span><div class="txt" style="color:#E8A08C">清空所有数据<div class="d">不可恢复，请先导出备份</div></div><span class="chev">›</span></div>
      </div>
      <div class="hint" style="margin-top:14px;text-align:center">🦀 的网球手账 · 数据保存在本机</div>`, (root) => {
      root.querySelector('#sSave').addEventListener('click', () => {
        const name = root.querySelector('#sName').value.trim() || '🦀的网球手账';
        const tech = root.querySelector('#sTech').value.trim() || '1.0';
        s.settings.appName = name;
        s.settings.techLevel = tech;
        DB.save(); refresh(); closeSheet(); toast('已保存');
      });
    });
  }

  function openInstallGuide() {
    const standalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    openSheet('添加到主屏幕', `
      <p class="confirm-msg" style="margin-bottom:12px">
        ${standalone ? '你已经在「独立 App 模式」下运行啦 ✅' : '用 iPhone 的 <b>Safari</b> 打开本页，按下面 3 步操作：'}
      </p>
      <div class="set-list">
        <div class="set-item"><span class="ico">1</span><div class="txt">点底部「分享」按钮<div class="d">方框 + 向上箭头的图标</div></div></div>
        <div class="set-item"><span class="ico">2</span><div class="txt">选择「添加到主屏幕」<div class="d">若没有，点「编辑操作」把它加回来</div></div></div>
        <div class="set-item"><span class="ico">3</span><div class="txt">保持「以 Web App 打开」并点「添加」<div class="d">之后从主屏图标进入，全屏无地址栏</div></div></div>
      </div>
      <div class="hint" style="margin-top:14px">提示：需要部署在 https 地址才能安装；直接双击本地 html 文件无法添加。</div>`);
  }

  /* ---------------- 备份 ---------------- */
  async function exportJSON() {
    try {
      const data = JSON.stringify(state(), null, 2);
      download(new Blob([data], { type: 'application/json' }), `tennis-backup-${stamp()}.json`);
      toast('已导出 JSON');
    } catch (e) { toast('导出失败'); }
  }

  async function exportZip() {
    toast('正在打包，请稍候…');
    try {
      const s = state();
      const enc = new TextEncoder();
      const files = [{ name: 'data.json', data: enc.encode(JSON.stringify(s)) }];
      const allAtts = [];
      s.lessons.forEach(l => (l.attachments || []).forEach(a => allAtts.push(a)));
      s.venues.forEach(v => (v.photos || []).forEach(a => allAtts.push(a)));

      for (const a of allAtts) {
        const blob = await DB.media.get(a.id);
        if (!blob) continue;
        const buf = new Uint8Array(await blob.arrayBuffer());
        files.push({ name: `media/${a.id}.${extOf(a.name, a.mime)}`, data: buf });
      }

      const zip = MiniZip.create(files);
      download(zip, `tennis-backup-${stamp()}.zip`);
      toast(`已打包 ${allAtts.length} 个媒体文件`);
    } catch (e) {
      console.error(e);
      toast('打包失败');
    }
  }

  function pickImport() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,.zip,application/json,application/zip';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      await doImport(f);
    });
    inp.click();
  }

  async function doImport(file) {
    try {
      let data = null;
      const mediaEntries = [];

      if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
        const buf = await file.arrayBuffer();
        const entries = MiniZip.parse(buf);
        const de = entries.find(e => e.name === 'data.json' || e.name.endsWith('/data.json'));
        if (!de) throw new Error('zip 中缺少 data.json');
        data = JSON.parse(new TextDecoder('utf-8').decode(de.data));
        entries.forEach(e => {
          if (e.name.startsWith('media/') && e.name !== 'media/' && e.data && e.data.length) {
            mediaEntries.push(e);
          }
        });
      } else {
        data = JSON.parse(await file.text());
      }

      if (!data || !Array.isArray(data.expenses) || !Array.isArray(data.lessons)) {
        throw new Error('备份文件格式不正确');
      }

      await DB.replaceState(data);

      for (const e of mediaEntries) {
        const base = e.name.slice('media/'.length);
        const id = base.replace(/\.[^.]+$/, '');
        const blob = new Blob([e.data]);
        await DB.media.put(id, blob);
      }

      DB.revokeAllURLs();
      closeSheet();
      refresh();
      toast(`导入成功：${data.expenses.length} 条花费 / ${data.lessons.length} 条训练`);
    } catch (err) {
      console.error(err);
      toast('导入失败：' + (err.message || '文件无法识别'));
    }
  }

  /* ---------------- 媒体查看 ---------------- */
  async function openMedia(id) {
    const blob = await DB.media.get(id);
    if (!blob) { toast('文件已丢失'); return; }
    let meta = null;
    state().lessons.forEach(l => (l.attachments || []).forEach(a => { if (a.id === id) meta = a; }));
    if (!meta) state().venues.forEach(v => (v.photos || []).forEach(a => { if (a.id === id) meta = a; }));
    const isVideo = (meta && meta.type === 'video') ||
      (blob.type || '').startsWith('video') ||
      /\.(mov|mp4|m4v|webm)$/i.test((meta && meta.name) || '');
    const url = URL.createObjectURL(blob);
    $('#mediaInner').innerHTML = isVideo
      ? `<video src="${url}" controls playsinline autoplay></video>`
      : `<img src="${url}" alt="">`;
    $('#mediaModal').classList.add('show');
    $('#mediaModal').dataset.url = url;
  }
  function closeMedia() {
    const url = $('#mediaModal').dataset.url;
    if (url) { setTimeout(() => URL.revokeObjectURL(url), 300); }
    $('#mediaInner').innerHTML = '';
    $('#mediaModal').classList.remove('show');
  }

  /* ---------------- 刷新 ---------------- */
  function refresh() {
    renderHeader();
    renderStats();
    renderExpense();
    renderLearn();
    renderCalendar();
    renderVenues();
    renderReport();
    renderInstallHint();
  }

  function renderInstallHint() {
    const existing = document.querySelector('.install-hint');
    const standalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (standalone || state().installHintDismissed) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const div = document.createElement('div');
    div.className = 'install-hint';
    div.innerHTML = `<span>📱</span><div>用 iPhone Safari 打开后，点 <b>分享 → 添加到主屏幕</b>，就能像 App 一样用</div><button class="x" data-act="dismiss-hint">✕</button>`;
    const views = $('#views');
    views.parentNode.insertBefore(div, views);
  }

  /* ---------------- 路由 ---------------- */
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (tab) { switchTab(tab.dataset.tab); return; }

    const el = ev.target.closest('[data-act]');
    if (el) {
      const act = el.dataset.act;
      const id = el.dataset.id;
      switch (act) {
        case 'add-expense': openExpenseForm(); return;
        case 'add-lesson': openLessonForm(); return;
        case 'add-venue': openVenueForm(); return;
        case 'open-settings': openSettings(); return;
        case 'edit-expense': openExpenseForm(id); return;
        case 'del-expense': {
          const e = state().expenses.find(x => x.id === id);
          confirmSheet('删除这笔花费？', `「${esc(e ? e.name : '')}」及其全部流水记录都会被删除，且无法恢复。`, '删除', () => {
            DB.removeExpense(id); refresh(); toast('已删除');
          }, true);
          return;
        }
        case 'append': openAppendForm(id); return;
        case 'edit-sub': openAppendForm(id, el.dataset.sub); return;
        case 'add-venue-photo': pickVenuePhoto(id); return;
        case 'del-sub': {
          DB.removeSub(id, el.dataset.sub); refresh(); toast('已删除流水'); return;
        }
        case 'edit-lesson': openLessonForm(id); return;
        case 'del-lesson': {
          confirmSheet('删除这条训练记录？', '照片和视频附件也会一并删除。', '删除', async () => {
            await DB.removeLesson(id); refresh(); toast('已删除');
          }, true);
          return;
        }
        case 'edit-venue': openVenueForm(id); return;
        case 'del-venue': {
          const v = state().venues.find(x => x.id === id);
          confirmSheet('删除这个球场？', `「${esc(v ? v.name : '')}」将从档案移除，相关训练记录的场地会置空（记录本身保留），已上传的球场照片也会删除。`, '删除', async () => {
            await DB.removeVenue(id); refresh(); toast('已删除');
          }, true);
          return;
        }
        case 'open-media': ev.preventDefault(); openMedia(id); return;
        case 'edit-tech': {
          openSheet('技术等级', `
            <div class="field"><label>当前等级</label>
              <input class="input" id="tVal" value="${esc(state().settings.techLevel || '1.0')}" placeholder="如 1.0 / 2.5 / 3.0">
              <div class="hint">用于记录 NTRP 等自评等级，随时可改</div></div>
            <div class="form-actions">
              <button class="btn-lg ghost" data-close>取消</button>
              <button class="btn-lg primary" id="tSave">保存</button>
            </div>`, (root) => {
            root.querySelector('#tSave').addEventListener('click', () => {
              state().settings.techLevel = root.querySelector('#tVal').value.trim() || '1.0';
              DB.save(); refresh(); closeSheet(); toast('已更新');
            });
          });
          return;
        }
        case 'day': openDaySheet(el.dataset.date); return;
        case 'toggle-tips': {
          const box = el.closest('.tips-box');
          if (box) box.classList.toggle('open');
          return;
        }
        case 'tip-filter': tipsFilter = el.dataset.t; renderReport(); return;
        case 'export-json': exportJSON(); return;
        case 'export-zip': exportZip(); return;
        case 'import': pickImport(); return;
        case 'install-guide': openInstallGuide(); return;
        case 'dismiss-hint': {
          state().installHintDismissed = true; DB.save();
          const h = document.querySelector('.install-hint'); if (h) h.remove();
          return;
        }
        case 'clear-all': {
          confirmSheet('清空所有数据？', '所有花费、训练记录、球场档案和照片视频都会被删除，<b>无法恢复</b>。建议先导出 ZIP 备份。', '继续', () => {
            confirmSheet('再确认一次', '真的要清空吗？此操作不可撤销。', '确认清空', async () => {
              await DB.resetAll();
              refresh();
              toast('已恢复为初始数据');
            }, true);
          }, true);
          return;
        }
        case 'go-expense': switchTab('expense'); return;
      }
    }

    if (ev.target.closest('[data-close]')) { closeSheet(); return; }
  });

  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', closeSheet);
  $('#mediaClose').addEventListener('click', closeMedia);
  $('#mediaModal').addEventListener('click', (ev) => {
    if (ev.target.id === 'mediaModal') closeMedia();
  });
  $('#calToggle').addEventListener('click', function () {
    calCollapsed = !calCollapsed;
    this.textContent = calCollapsed ? '展开' : '收起';
    renderCalendar();
  });
  $('#btnSettings').addEventListener('click', openSettings);

  /* ---------------- 启动 ---------------- */
  DB.load();
  refresh();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW 注册失败', err));
    });
  }

  window.UI = { toast, refresh, openSettings };
})();
