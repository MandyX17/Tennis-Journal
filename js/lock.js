/* 🦀 密码门 · 纯前端 SHA-256 校验
 * 密码 = BT-TL-LB（仅存哈希，不存明文）
 * 解锁后记住 30 天；https/localhost 下 SHA-256 生效，http 局域网预览降级放行
 */
(function () {
  'use strict';

  var PASS_HASH = 'afbaa0513fdce1280d6fe1a75a55ccdf984af2cda9fbe1c9209bb07b6b4409ca';
  var KEY = 'crab_unlock_until';
  var TTL = 30 * 24 * 60 * 60 * 1000; // 记住 30 天

  var lockEl = document.getElementById('lockScreen');
  var input = document.getElementById('lockPass');
  var btn = document.getElementById('lockBtn');
  var errEl = document.getElementById('lockErr');
  if (!lockEl || !input || !btn) return;

  function markUnlocked() {
    document.documentElement.classList.add('unlocked');
  }
  function alreadyUnlocked() {
    try { return Number(localStorage.getItem(KEY) || 0) > Date.now(); } catch (e) { return false; }
  }
  function enter() {
    try { localStorage.setItem(KEY, String(Date.now() + TTL)); } catch (e) {}
    markUnlocked();
  }
  function setErr(msg) { if (errEl) errEl.textContent = msg || ''; }

  function toHex(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return s;
  }
  async function sha256(str) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return toHex(buf);
  }

  // 已解锁过：直接进，不显示锁屏
  if (alreadyUnlocked()) { markUnlocked(); return; }

  var secure = !!(window.crypto && crypto.subtle && window.isSecureContext);

  async function submit() {
    var v = (input.value || '').trim();
    if (!v) { setErr('请输入密码'); input.focus(); return; }

    // 非安全上下文（局域网 http）：SHA-256 不可用，降级放行并提示
    if (!secure) {
      setErr('当前为 HTTP 预览，密码保护未生效（正式 HTTPS 访问时启用）');
      setTimeout(enter, 1000);
      return;
    }

    btn.disabled = true;
    try {
      var h = await sha256(v);
      if (h === PASS_HASH) {
        setErr('');
        enter();
      } else {
        setErr('密码不对，再试试');
        input.value = '';
        input.focus();
      }
    } catch (e) {
      setErr('校验出错，请重试');
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  setTimeout(function () { try { input.focus(); } catch (e) {} }, 250);
})();
