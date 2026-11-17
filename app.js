/* 大字電話簿：畫面
   localStorage 前綴 bdp.：contacts（聯絡人，含照片 dataURL）、cfg（字級、高對比、撥號前確認、朗讀、排序、緊急電話、整理密碼雜湊、範例旗標）、
   counts（每個人按「撥出」的次數，只用來排序）、tab、fold、warnSeen、marquee。電話與照片只存在這支手機，不上傳、不串 AI。 */
(function(){
'use strict';
var B = window.BDP, PFX = 'bdp.', ONLINE = 'https://m255525.github.io/big-dial-phonebook/';
var $ = function(id){ return document.getElementById(id); };
function lsGet(k){ try{ return localStorage.getItem(PFX + k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(PFX + k, v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(PFX + k); }catch(e){} }
function lsJson(k, d){ try{ var v = JSON.parse(lsGet(k)); return v == null ? d : v; }catch(e){ return d; } }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
var PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

/* ---------- 狀態 ---------- */
var CFG = Object.assign({fs:'m', hc:false, confirm:true, speak:true, sort:'manual', emgTab:true, hideEmg:[], pin:'', example:false}, lsJson('cfg', {}));
var LIST = lsJson('contacts', null);
if(!Array.isArray(LIST)){ LIST = B.EXAMPLE.map(B.clean); CFG.example = true; saveAll(); }
else LIST = LIST.map(B.clean);
var COUNTS = lsJson('counts', {});
var TAB = lsGet('tab') || 'all';
var EDIT = false;
function saveCfg(){ lsSet('cfg', JSON.stringify(CFG)); }
function saveList(){ if(!lsSet('contacts', JSON.stringify(LIST))){ toast('手機的空間不夠，剛剛的修改可能沒存到。請刪掉幾張照片再試一次。'); return false; } return true; }
function saveAll(){ saveCfg(); return saveList(); }

var toastT;
function toast(s){ var t = document.querySelector('.toast'); if(!t){ t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = s; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function(){ t.hidden = true; }, 3500); }
function openModal(h){ $('modalBox').innerHTML = h; $('modal').classList.add('show'); var f = $('modalBox').querySelector('input,button,a'); if(f) setTimeout(function(){ try{ f.focus(); }catch(e){} }, 30); }
function closeModal(){ $('modal').classList.remove('show'); }
function download(blob, name){ var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function copyText(t, msg){
  function fb(){ var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); }
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(fb); else fb();
  toast(msg || '已複製');
}
function speak(t){ if(!CFG.speak || !window.speechSynthesis) return; try{ speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = 'zh-TW'; u.rate = .9; speechSynthesis.speak(u); }catch(e){} }
function applyView(){ var r = document.documentElement; r.dataset.fs = CFG.fs === 'xl' || CFG.fs === 'xxl' ? CFG.fs : 'm'; r.dataset.hc = CFG.hc ? '1' : '0'; }

/* ---------- 頭像 ---------- */
function avHtml(c, cls){ return '<div class="av' + (cls ? ' ' + cls : '') + '" style="background:' + B.avatarColor(c.name || c.full) + '" aria-hidden="true">' + (c.photo ? '<img src="' + c.photo + '" alt="">' : esc(B.initial(c))) + '</div>'; }
function findAny(id){ var e = B.EMERGENCY.filter(function(x){ return x.id === id; })[0]; if(e) return {id:e.id, name:e.name, full:'', tels:[{t:'其他', n:e.n}], note:e.say, emg:e}; return LIST.filter(function(c){ return c.id === id; })[0] || null; }

/* ---------- 首頁 ---------- */
function cover(){
  return '<header class="cover"><div class="row"><h1><span class="ic" aria-hidden="true">☎</span>電話簿</h1>' +
    '<a class="cbtn" href="manual.html">📖<span> 說明</span></a><button class="cbtn" type="button" data-act="settings" aria-label="設定">⚙<span> 設定</span></button></div>' +
    '<div class="sos"><a href="tel:110" data-sos="110">110<small>警察</small></a><a href="tel:119" data-sos="119">119<small>救護車・火災</small></a></div>' +
    '<p class="warn-line">緊急時直接按上面的 110、119。電話只存在這支手機。<button type="button" data-act="warn">⚠ 使用警語</button></p></header>';
}
function tabsList(){
  var t = [['all', '全部', '#6A5A48']];
  B.CAT_ORDER.forEach(function(k){ if(k === 'emg'){ if(CFG.emgTab) t.push([k, B.CATS[k].n, B.CATS[k].c]); } else if(LIST.some(function(c){ return c.cat === k; })) t.push([k, B.CATS[k].n, B.CATS[k].c]); });
  return t;
}
function cardHtml(c){
  var t = c.tels[0];
  return '<button type="button" class="card" data-call="' + esc(c.id) + '" aria-label="打給' + esc(B.title(c)) + '">' + avHtml(c) +
    '<div class="nm">' + esc(c.name || c.full || '沒有名字') + (c.name && c.full ? '<small>' + esc(c.full) + '</small>' : '') + '</div>' +
    '<div class="num">' + esc(t ? B.fmtTel(t.n) : '') + '</div><span class="dial">' + PHONE + '打電話</span></button>';
}
function emgCard(e){
  return '<button type="button" class="card emg" data-call="' + e.id + '" aria-label="打給' + esc(e.name) + ' ' + e.n + '"><div class="av" style="background:' + (e.big ? '#C62828' : '#8B3A3A') + '">' + e.n + '</div>' +
    '<div class="nm">' + esc(e.name) + '</div><div class="say">' + esc(e.say) + '</div><span class="dial">' + PHONE + '打 ' + e.n + '</span></button>';
}
function homeHtml(){
  var tabs = tabsList();
  if(!tabs.some(function(t){ return t[0] === TAB; })) TAB = 'all';
  var h = '<div class="tabs" role="group" aria-label="分類">' + tabs.map(function(t){ return '<button type="button" class="tab" data-tab="' + t[0] + '" aria-pressed="' + (TAB === t[0]) + '" style="background:' + t[2] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  if(CFG.example) h += '<div class="banner"><b>📝 現在是範例（人名、號碼都是假的）。請家人按「⚙ 設定 → 整理電話簿」換成自己的家人。</b><button type="button" class="btn sm alt" data-act="settings">去整理</button></div>';
  if(TAB === 'emg'){
    h += '<div class="grid">' + B.EMERGENCY.filter(function(e){ return CFG.hideEmg.indexOf(e.id) < 0; }).map(emgCard).join('') + '</div><p class="small" style="margin-top:1rem">資料來源：內政部警政署、內政部消防署、衛生福利部公開資訊。</p>';
    return h;
  }
  var list = B.sortContacts(LIST, CFG.sort, COUNTS).filter(function(c){ return TAB === 'all' || c.cat === TAB; });
  if(!list.length) return h + '<div class="empty"><b>電話簿還是空的</b>請家人按右上角「⚙ 設定」→「整理電話簿」加入電話。</div>';
  return h + '<div class="grid">' + list.map(cardHtml).join('') + '</div>';
}
function footer(){
  return '<footer class="foot">👤 創作者 Mark Tsai（蔡豐全）<a href="mailto:tsaimark@gmail.com">tsaimark@gmail.com</a><br><a href="manual.html">📖 操作手冊</a><a href="manual.html#creator">👤 創作者資訊</a><a href="#" data-act="warn">⚠ 使用警語</a>' +
    (standalone ? '' : '<a href="#" data-act="install">📲 加入主畫面</a>') +
    '<br><img src="https://visitor-badge.laobi.icu/badge?page_id=m255525.bigdialphonebook" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle;margin-top:.4rem"></footer>';
}
function render(){
  $('app').innerHTML = cover() + '<section class="book"><div class="page" id="page">' + (EDIT ? editHtml() : homeHtml()) + '</div></section>' + footer();
}

/* ---------- 撥號確認 ---------- */
var CUR = null;
function telLabel(t, emg){ return emg ? '撥出' : '打' + t.t; }
function openCall(id){
  var c = findAny(id); if(!c || !c.tels.length) return;
  if(!CFG.confirm && c.tels.length === 1){ dialNow(c, c.tels[0]); return; }
  CUR = c;
  var who = esc(c.name || c.full || '這個號碼');
  var h = '<div class="cv">' + (c.emg ? '<div class="av" style="background:#C62828;font-family:var(--hei);font-weight:900;font-size:4.2rem">' + c.emg.n + '</div>' : avHtml(c)) +
    '<h2 id="cvTitle">要打給<br><span class="who">' + who + '</span> 嗎？</h2>' + (c.full && c.name ? '<div class="note">' + esc(c.full) + '</div>' : '') + (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') +
    c.tels.map(function(t){ return '<a class="go" href="' + esc(B.telHref(t.n)) + '" data-dial="' + esc(c.id) + '">' + PHONE + '<span>' + telLabel(t, c.emg) + '<small>' + esc(B.fmtTel(t.n)) + '</small></span></a>'; }).join('') +
    '<button type="button" class="nogo" data-act="closeCall">不要打，回電話簿</button>' +
    (c.tels.some(function(t){ return B.checkTel(t.n) === 'mobile'; }) ? '<a class="sms" href="' + esc(B.smsHref(c.tels.filter(function(t){ return B.checkTel(t.n) === 'mobile'; })[0].n)) + '">💬 改成傳簡訊</a>' : '') +
    '<p class="pc">用電腦或平板看的話可能撥不出去，請照著上面的號碼用電話撥。</p></div>';
  $('callView').innerHTML = h; $('callView').hidden = false; document.body.style.overflow = 'hidden';
  try{ history.pushState({call:1}, ''); }catch(e){}
  speak('要打給' + (c.name || c.full || '這個號碼') + '嗎？');
  var g = $('callView').querySelector('.go'); if(g) g.focus();
}
function closeCall(fromPop){
  if($('callView').hidden) return;
  $('callView').hidden = true; $('callView').innerHTML = ''; document.body.style.overflow = ''; CUR = null;
  try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){}
  if(!fromPop && history.state && history.state.call) history.back();
}
function count(id){ if(/^e\d/.test(id)) return; COUNTS[id] = (COUNTS[id] || 0) + 1; lsSet('counts', JSON.stringify(COUNTS)); }
function dialNow(c, t){ count(c.id); var a = document.createElement('a'); a.href = B.telHref(t.n); document.body.appendChild(a); a.click(); a.remove(); toast('撥給 ' + (c.name || c.full) + '：' + B.fmtTel(t.n)); }
window.addEventListener('popstate', function(){ closeCall(true); });

/* ---------- 整理模式（家人用） ---------- */
async function sha(s){ var b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bdp|' + s)); return Array.from(new Uint8Array(b)).map(function(x){ return x.toString(16).padStart(2, '0'); }).join(''); }
function unlock(){
  if(CFG.pin){ openModal('<h2>🔒 輸入整理密碼</h2><label class="fld">4 位數密碼<input id="pinIn" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></label><div class="stack"><button type="button" class="btn" data-act="pinOk">確定</button><button type="button" class="btn alt" data-act="close">取消</button></div><p class="small">忘記密碼：把這支手機的瀏覽器資料清掉後重新整理（電話簿也會清空，請先備份）。</p>'); return; }
  enterEdit();
}
function enterEdit(){ EDIT = true; closeModal(); render(); window.scrollTo(0, 0); }
function exitEdit(){ EDIT = false; render(); toast('整理好了'); }
function editHtml(){
  var h = '<div class="edit-head"><h2>📝 整理電話簿</h2>' +
    '<button type="button" class="btn green" data-act="add">＋ 新增聯絡人</button><button type="button" class="btn" data-act="lineShare">💬 用 LINE 傳給長輩</button><button type="button" class="btn alt" data-act="copyLink">🔗 複製連結</button>' +
    '<button type="button" class="btn alt" data-act="print">🖨 列印紙本</button><button type="button" class="btn alt" data-act="backup">💾 備份</button><label class="btn alt">📂 還原<input type="file" accept="application/json,.json" id="restoreIn" hidden></label>' +
    (CFG.example ? '<button type="button" class="btn red" data-act="clearEx">清掉範例</button>' : '') +
    '<button type="button" class="btn alt" data-act="pinSet">🔒 整理密碼' + (CFG.pin ? '（已設定）' : '') + '</button><button type="button" class="btn" data-act="exitEdit">✔ 整理好了</button></div>' +
    '<p class="small" style="margin-bottom:.7rem">在您自己的手機整理好後，按「用 LINE 傳給長輩」，長輩打開連結按「加入」就好（照片不會跟著傳，要在長輩手機上另外加）。</p>';
  if(!LIST.length) return h + '<div class="empty"><b>還沒有聯絡人</b>按「＋ 新增聯絡人」開始。</div>';
  return h + LIST.map(function(c, i){
    return '<div class="erow">' + avHtml(c) + '<div class="t"><b>' + esc(B.title(c)) + '</b><span>' + esc(B.CATS[c.cat].n + '・' + c.tels.map(function(t){ return B.fmtTel(t.n); }).join('、')) + '</span></div>' +
      '<button type="button" class="ib" data-up="' + i + '" aria-label="往上"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="ib" data-down="' + i + '" aria-label="往下"' + (i < LIST.length - 1 ? '' : ' disabled') + '>↓</button>' +
      '<button type="button" class="ib" data-edit="' + esc(c.id) + '" aria-label="修改 ' + esc(B.title(c)) + '" style="width:auto;padding:0 .6rem">修改</button><button type="button" class="ib" data-del="' + esc(c.id) + '" aria-label="刪除 ' + esc(B.title(c)) + '">🗑</button></div>';
  }).join('');
}
var FORM = null;
function openForm(id){
  var c = id ? LIST.filter(function(x){ return x.id === id; })[0] : null;
  FORM = c ? JSON.parse(JSON.stringify(c)) : {id:B.uid(), name:'', full:'', cat:TAB !== 'all' && TAB !== 'emg' ? TAB : 'fam', tels:[], note:'', photo:''};
  formHtml();
}
function formHtml(){
  var f = FORM, tels = f.tels.slice(); while(tels.length < 2) tels.push({t:tels.length ? '家裡' : '手機', n:''});
  openModal('<h2>' + (LIST.some(function(x){ return x.id === f.id; }) ? '📝 修改聯絡人' : '＋ 新增聯絡人') + '</h2>' +
    '<div style="display:flex;gap:.8rem;align-items:center">' + '<div style="width:6rem;flex:none">' + avHtml(f) + '</div><div class="stack"><label class="btn alt sm">📷 ' + (f.photo ? '換照片' : '加照片') + '<input type="file" accept="image/*" id="photoIn" hidden></label>' + (f.photo ? '<button type="button" class="btn alt sm" data-act="noPhoto">拿掉照片</button>' : '') + '</div></div>' +
    '<label class="fld">稱呼（大字顯示，例如：大兒子、女兒、王伯伯）<input id="fName" maxlength="12" value="' + esc(f.name) + '"></label>' +
    '<label class="fld">全名（選填）<input id="fFull" maxlength="20" value="' + esc(f.full) + '"></label>' +
    '<label class="fld">分類<select id="fCat">' + B.CAT_ORDER.filter(function(k){ return k !== 'emg'; }).map(function(k){ return '<option value="' + k + '"' + (f.cat === k ? ' selected' : '') + '>' + B.CATS[k].n + '</option>'; }).join('') + '</select></label>' +
    tels.map(function(t, i){ return '<div class="row2"><label class="fld">種類<select data-tl="' + i + '">' + B.TEL_LABELS.map(function(l){ return '<option' + (t.t === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label><label class="fld">電話 ' + (i + 1) + (i ? '（選填）' : '') + '<input data-tn="' + i + '" inputmode="tel" maxlength="30" placeholder="' + (i ? '例如 02-2345-6789#123' : '例如 0912-345-678') + '" value="' + esc(t.n ? B.fmtTel(t.n).replace(' 分機 ', '#') : '') + '"></label></div>'; }).join('') +
    (tels.length < 4 ? '<div><button type="button" class="btn alt sm" data-act="moreTel">＋ 再加一支電話</button></div>' : '') +
    '<label class="fld">備註（選填，顯示在撥號畫面）<input id="fNote" maxlength="40" value="' + esc(f.note) + '" placeholder="例如：每週三來看您"></label>' +
    '<p class="small" id="fMsg"></p><div class="stack"><button type="button" class="btn green" data-act="saveForm">儲存</button><button type="button" class="btn alt" data-act="close">取消</button></div>');
}
function readForm(){
  var f = FORM;
  f.name = ($('fName') || {}).value || ''; f.full = ($('fFull') || {}).value || ''; f.cat = ($('fCat') || {}).value || 'fam'; f.note = ($('fNote') || {}).value || '';
  var tels = [];
  document.querySelectorAll('[data-tn]').forEach(function(inp){ var i = inp.dataset.tn, l = document.querySelector('[data-tl="' + i + '"]'); tels.push({t:l ? l.value : '手機', n:inp.value}); });
  f.tels = tels;
}
function saveForm(){
  readForm();
  var f = FORM, bad = f.tels.filter(function(t){ return t.n.trim() && B.checkTel(t.n) === 'bad'; });
  var c = B.clean(f);
  if(!c.tels.length){ $('fMsg').textContent = '請至少填一支電話。'; $('fMsg').style.color = 'var(--red)'; return; }
  if(!c.name && !c.full){ $('fMsg').textContent = '請填稱呼，長輩才認得是誰。'; $('fMsg').style.color = 'var(--red)'; return; }
  if(bad.length && !f._ok){ f._ok = true; $('fMsg').textContent = '「' + bad[0].n + '」看起來不像台灣的電話號碼，請再檢查一次。確定沒錯的話再按一次「儲存」。'; $('fMsg').style.color = 'var(--red)'; return; }
  var i = LIST.findIndex(function(x){ return x.id === c.id; });
  if(i >= 0) LIST[i] = c; else LIST.push(c);
  if(saveList()){ closeModal(); render(); toast('已儲存「' + B.title(c) + '」'); }
}
function readPhoto(file){
  return new Promise(function(ok, no){
    if(!file || !/^image\//.test(file.type)) return no(new Error('請選一張照片'));
    var fr = new FileReader();
    fr.onload = function(){ var im = new Image(); im.onload = function(){ var s = Math.min(im.width, im.height), cv = document.createElement('canvas'); cv.width = cv.height = 320; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 320); x.drawImage(im, (im.width - s) / 2, (im.height - s) * .3, s, s, 0, 0, 320, 320); ok(cv.toDataURL('image/jpeg', .82)); }; im.onerror = function(){ no(new Error('這張照片打不開')); }; im.src = fr.result; };
    fr.onerror = function(){ no(new Error('讀檔失敗')); };
    fr.readAsDataURL(file);
  });
}

/* ---------- 分享與匯入 ---------- */
function shareUrl(){ return (location.protocol === 'file:' ? ONLINE : location.origin + location.pathname) + '#c=' + B.encodeShare(LIST); }
function shareText(){ return '【大字電話簿】幫您整理好 ' + LIST.length + ' 位聯絡人的電話了，打開這個連結，按「加入」就好：\n' + shareUrl(); }
function checkHash(){
  var m = location.hash.match(/^#c=([A-Za-z0-9_-]+)/);
  if(!m) return;
  var inc = B.decodeShare(m[1]);
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  if(!inc || !inc.length){ toast('這個連結不完整，請家人再傳一次'); return; }
  PENDING = inc;
  openModal('<h2>📒 家人幫您整理了 ' + inc.length + ' 位聯絡人</h2><ul>' + inc.slice(0, 12).map(function(c){ return '<li><b>' + esc(B.title(c)) + '</b>　' + esc(B.fmtTel(c.tels[0].n)) + '</li>'; }).join('') + (inc.length > 12 ? '<li>……還有 ' + (inc.length - 12) + ' 位</li>' : '') + '</ul>' +
    '<p style="font-size:1.3rem;margin:0">要加進電話簿嗎？</p><div class="stack"><button type="button" class="btn green" data-act="importOk" style="font-size:1.3rem;min-height:3.6rem">✔ 加入</button><button type="button" class="btn alt" data-act="close" style="min-height:3.6rem">不要</button></div><p class="small">同一支電話不會重複，已經有的照片會留著。</p>');
}
var PENDING = null;
function importOk(){
  if(!PENDING) return;
  var base = CFG.example ? [] : LIST, r = B.mergeContacts(base, PENDING);
  LIST = r.list; CFG.example = false; PENDING = null;
  if(saveAll()){ closeModal(); TAB = 'all'; render(); toast('加入 ' + r.added + ' 位' + (r.updated ? '，更新 ' + r.updated + ' 位' : '')); speak('電話簿更新好了'); }
}

/* ---------- 列印 ---------- */
function pav(c){ return '<div class="pav" style="background:' + B.avatarColor(c.name || c.full) + '">' + (c.photo ? '<img src="' + c.photo + '" alt="">' : esc(B.initial(c))) + '</div>'; }
function preparePrint(kind){
  var pa = $('printArea'), h = '';
  if(kind === 'wallet'){
    var fam = LIST.filter(function(c){ return c.cat === 'fam'; }).slice(0, 3), oth = LIST.filter(function(c){ return c.cat !== 'fam'; }).slice(0, 4);
    var c1 = '<div class="wcard"><h3>☎ 緊急聯絡卡</h3>' + fam.map(function(c){ return '<div class="wl"><span>' + esc(B.title(c)) + '</span><span>' + esc(B.fmtTel(c.tels[0].n)) + '</span></div>'; }).join('') + '<div class="wl big"><span>警察</span><span>110</span></div><div class="wl big"><span>救護車・火災</span><span>119</span></div></div>';
    var c2 = '<div class="wcard"><h3>☎ 常用電話</h3>' + oth.map(function(c){ return '<div class="wl"><span>' + esc(B.title(c)) + '</span><span>' + esc(B.fmtTel(c.tels[0].n)) + '</span></div>'; }).join('') + '<div class="wl"><span>反詐騙專線</span><span>165</span></div><div class="wl"><span>長照專線</span><span>1966</span></div></div>';
    h = '<div class="ppage"><div class="ph">皮夾小卡<small>沿虛線剪下，放進皮夾或貼在電話旁</small></div><div class="wgrid">' + c1 + c2 + c1 + c2 + '</div></div>';
  } else {
    for(var i = 0; i < Math.max(1, LIST.length); i += 6){
      h += '<div class="ppage"><div class="ph">☎ 大字電話簿<small>第 ' + (i / 6 + 1) + ' 頁・緊急 110／119</small></div><div class="pgrid">' + LIST.slice(i, i + 6).map(function(c){
        return '<div class="pc2">' + pav(c) + '<div><b>' + esc(B.title(c)) + '</b>' + c.tels.map(function(t){ return '<div class="pn"><span>' + esc(t.t) + '</span>' + esc(B.fmtTel(t.n)).replace(' 分機 ', '<br><i>分機 </i>') + '</div>'; }).join('') + (c.note ? '<div class="pnote">' + esc(c.note) + '</div>' : '') + '</div></div>';
      }).join('') + '</div></div>';
    }
  }
  pa.innerHTML = h;
  return Promise.all(Array.prototype.map.call(pa.querySelectorAll('img'), function(im){ return im.decode ? im.decode().catch(function(){}) : null; }));
}
function doPrint(kind){ closeModal(); preparePrint(kind).then(function(){ setTimeout(function(){ window.print(); }, 60); }); }
window.addEventListener('afterprint', function(){ $('printArea').innerHTML = ''; });

/* ---------- 警語與設定 ---------- */
var WARN_HTML = '<h2>⚠ 使用警語</h2><ul>' +
  '<li>這是<b>撥號捷徑，不是緊急救援服務</b>。遇到危險、有人受傷，請直接按上方的 <b>110</b> 或 <b>119</b>。</li>' +
  '<li>撥號是交給手機的電話 App 撥出；用電腦或沒有電話功能的平板看時撥不出去，請照著號碼用電話撥。</li>' +
  '<li>電話和照片<b>只存在這支手機的瀏覽器</b>，不會上傳；清除瀏覽器資料或換手機會不見，請家人在「整理電話簿」定期按「備份」。</li>' +
  '<li>放別人的照片前請先問過本人。內建的公共專線來自內政部、衛生福利部公開資訊，服務時間與內容以各機關公告為準。</li>' +
  '<li>範例裡的人名和號碼全部是假的，請換成自己的家人。</li></ul>';
function showWarn(){ openModal(WARN_HTML + '<div class="stack"><button type="button" class="btn" data-act="close">我知道了</button></div>'); }
function sec(id, title, val, body){ return '<details class="set-sec" data-sec="' + id + '"><summary><span class="sst">' + title + '</span><span class="ssv">' + esc(val) + '</span></summary><div class="set-body">' + body + '</div></details>'; }
function seg(key, opts){ return '<div class="seg">' + opts.map(function(o){ return '<button type="button" data-cfg="' + key + '" data-v="' + o[0] + '" aria-pressed="' + (String(CFG[key]) === String(o[0])) + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
var FS = {m:'大', xl:'特大', xxl:'超大'};
function openSettings(){
  var h = '<div class="stack" style="align-items:center"><h2 style="flex:1 1 auto">⚙ 設定</h2><button type="button" class="btn alt sm" data-act="foldall">全部展開／收合</button></div>' +
    sec('edit', '📝 整理電話簿（家人用）', LIST.length + ' 位', '<button type="button" class="btn hold" id="holdBtn"><span class="bar"></span>📝 按住 2 秒，進入整理</button><p class="small">要按住不放 2 秒才進得去，長輩不會不小心刪掉電話。' + (CFG.pin ? '已設定整理密碼。' : '') + '</p>') +
    sec('view', '字的大小', FS[CFG.fs] || '大', seg('fs', [['m', '大'], ['xl', '特大'], ['xxl', '超大']]) + '<label class="chk"><input type="checkbox" data-cfgc="hc"' + (CFG.hc ? ' checked' : '') + '>高對比（黑白分明）</label>') +
    sec('call', '撥號方式', CFG.confirm ? '先問一次再撥' : '一按就撥', seg('confirm', [['true', '先問一次再撥'], ['false', '一按就撥']]) + '<p class="small">「一按就撥」適合用得很熟的人；有兩支電話的人還是會先問要打哪一支。</p><label class="chk"><input type="checkbox" data-cfgc="speak"' + (CFG.speak ? ' checked' : '') + '>撥號前唸出「要打給誰」</label>') +
    sec('sort', '排列順序', CFG.sort === 'freq' ? '常按的在前' : '照家人排的順序', seg('sort', [['manual', '照家人排的順序'], ['freq', '常按的在前']])) +
    sec('emg', '緊急與公共專線', CFG.emgTab ? '顯示' : '不顯示', '<label class="chk"><input type="checkbox" data-cfgc="emgTab"' + (CFG.emgTab ? ' checked' : '') + '>顯示「緊急」分頁</label>' +
      B.EMERGENCY.filter(function(e){ return !e.big; }).map(function(e){ return '<label class="chk"><input type="checkbox" data-emg="' + e.id + '"' + (CFG.hideEmg.indexOf(e.id) < 0 ? ' checked' : '') + '>' + e.n + ' ' + esc(e.name) + '</label>'; }).join('') + '<p class="small">110、119 一直放在最上面，不能關。</p>') +
    sec('about', '關於本工具', '', '<p>👤 創作者 Mark Tsai（蔡豐全）<br><a href="mailto:tsaimark@gmail.com">tsaimark@gmail.com</a></p><div class="stack"><a class="btn alt" href="manual.html">📖 操作手冊</a><a class="btn alt" href="manual.html#creator">👤 創作者資訊</a><button type="button" class="btn alt" data-act="warn">⚠ 使用警語</button>' +
      (standalone ? '' : '<button type="button" class="btn alt" data-act="install">📲 加入主畫面</button>') + '</div><p class="small" style="margin-top:.5rem">訪客數 <img src="https://visitor-badge.laobi.icu/badge?page_id=m255525.bigdialphonebook" alt="訪客次數" height="20" loading="lazy" style="vertical-align:middle"></p>') +
    '<div class="stack"><button type="button" class="btn" data-act="close">關閉</button></div>';
  openModal(h);
  var open = lsJson('fold', ['edit']);
  document.querySelectorAll('.set-sec').forEach(function(d){ d.open = open.indexOf(d.dataset.sec) >= 0; d.addEventListener('toggle', saveFold); });
  bindHold($('holdBtn'));
}
function saveFold(){ var o = []; document.querySelectorAll('.set-sec').forEach(function(d){ if(d.open) o.push(d.dataset.sec); }); lsSet('fold', JSON.stringify(o)); }
function bindHold(el){
  if(!el) return;
  var t = null, kd = false;
  function start(e){ if(e && e.type === 'pointerdown' && e.button !== 0) return; el.classList.add('on'); clearTimeout(t); t = setTimeout(function(){ el.classList.remove('on'); unlock(); }, 2000); }
  function stop(){ if(t){ clearTimeout(t); t = null; } el.classList.remove('on'); }
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function(n){ el.addEventListener(n, stop); });
  el.addEventListener('keydown', function(e){ if((e.key === 'Enter' || e.key === ' ') && !kd){ kd = true; e.preventDefault(); start(); } });
  el.addEventListener('keyup', function(e){ if(e.key === 'Enter' || e.key === ' '){ kd = false; stop(); } });
  el.addEventListener('click', function(e){ e.preventDefault(); if(!el.classList.contains('on')) toast('要「按住不放」2 秒喔'); });
  el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
}
function install(){
  if(window._dp){ window._dp.prompt(); window._dp = null; return; }
  openModal('<h2>📲 加入主畫面</h2><p>加到手機桌面後，長輩點圖示就能打開電話簿。</p><ul><li><b>iPhone（Safari）</b>：按下面的「分享」→「加入主畫面」。</li><li><b>Android（Chrome）</b>：右上角「⋮」→「加到主畫面」或「安裝應用程式」。</li></ul><div class="stack"><button type="button" class="btn" data-act="close">知道了</button></div>');
}

/* ---------- 動作 ---------- */
var ACT = {
  close:closeModal, warn:showWarn, settings:openSettings, install:install, closeCall:function(){ closeCall(); },
  foldall:function(){ var ds = document.querySelectorAll('.set-sec'), any = Array.prototype.some.call(ds, function(d){ return !d.open; }); ds.forEach(function(d){ d.open = any; }); saveFold(); },
  pinOk:async function(){ var v = ($('pinIn') || {}).value || ''; if(await sha(v) === CFG.pin) enterEdit(); else { toast('密碼不對'); $('pinIn').value = ''; } },
  exitEdit:exitEdit, add:function(){ openForm(null); }, saveForm:saveForm,
  moreTel:function(){ readForm(); FORM.tels = FORM.tels.filter(function(t, i){ return t.n.trim() || i < 2; }); if(FORM.tels.length < 4) FORM.tels.push({t:'其他', n:''}); formHtml(); },
  noPhoto:function(){ readForm(); FORM.photo = ''; formHtml(); },
  clearEx:function(){ LIST = []; CFG.example = false; COUNTS = {}; lsSet('counts', '{}'); saveAll(); render(); toast('範例清掉了，請按「＋ 新增聯絡人」'); },
  lineShare:function(){ if(!LIST.length){ toast('還沒有聯絡人可以傳'); return; } var a = document.createElement('a'); a.href = 'https://line.me/R/share?text=' + encodeURIComponent(shareText()); a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); },
  copyLink:function(){ if(!LIST.length){ toast('還沒有聯絡人可以傳'); return; } copyText(shareText(), '已複製，可以貼到 LINE 或簡訊傳給長輩'); },
  print:function(){ openModal('<h2>🖨 列印紙本</h2><p class="small">印出來貼在家裡電話旁，手機沒電也找得到電話。</p><div class="stack"><button type="button" class="btn" data-act="printBook">大字電話簿（一頁 6 位）</button><button type="button" class="btn alt" data-act="printWallet">皮夾小卡</button><button type="button" class="btn alt" data-act="close">取消</button></div>'); },
  printBook:function(){ doPrint('book'); }, printWallet:function(){ doPrint('wallet'); },
  backup:function(){ var d = new Date(), n = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); download(new Blob([B.backup(LIST, {fs:CFG.fs, hc:CFG.hc, confirm:CFG.confirm, speak:CFG.speak, sort:CFG.sort, emgTab:CFG.emgTab, hideEmg:CFG.hideEmg})], {type:'application/json'}), '大字電話簿備份_' + n + '.json'); toast('已下載備份檔，請存到雲端或傳給自己'); },
  restoreAll:function(){ if(!RESTORE) return; LIST = RESTORE.contacts; Object.assign(CFG, RESTORE.cfg, {example:false, pin:CFG.pin}); RESTORE = null; applyView(); if(saveAll()){ closeModal(); render(); toast('已還原 ' + LIST.length + ' 位'); } },
  restoreMerge:function(){ if(!RESTORE) return; var base = CFG.example ? [] : LIST, r = B.mergeContacts(base, RESTORE.contacts); LIST = r.list; CFG.example = false; RESTORE = null; if(saveAll()){ closeModal(); render(); toast('加入 ' + r.added + ' 位，更新 ' + r.updated + ' 位'); } },
  importOk:importOk,
  pinSet:function(){ openModal('<h2>🔒 整理密碼</h2><p class="small">設了之後，進入「整理電話簿」要輸入密碼。請家人自己記住，不要告訴長輩。</p><label class="fld">4 位數字<input id="pinNew" type="password" inputmode="numeric" maxlength="4" autocomplete="off"></label><div class="stack"><button type="button" class="btn" data-act="pinSave">儲存密碼</button>' + (CFG.pin ? '<button type="button" class="btn red" data-act="pinClear">取消密碼</button>' : '') + '<button type="button" class="btn alt" data-act="close">關閉</button></div>'); },
  pinSave:async function(){ var v = ($('pinNew') || {}).value || ''; if(!/^\d{4}$/.test(v)){ toast('請輸入 4 位數字'); return; } CFG.pin = await sha(v); saveCfg(); closeModal(); render(); toast('整理密碼設定好了'); },
  pinClear:function(){ CFG.pin = ''; saveCfg(); closeModal(); render(); toast('已取消整理密碼'); },
};
var RESTORE = null;
var delArm = null;
document.addEventListener('click', function(e){
  var t = e.target.closest('[data-act],[data-call],[data-tab],[data-dial],[data-sos],[data-cfg],[data-up],[data-down],[data-edit],[data-del]');
  if(!t) return;
  var d = t.dataset;
  if(t.id === 'holdBtn') return;
  if(d.act && ACT[d.act]){ if(t.tagName === 'A' && t.getAttribute('href') === '#') e.preventDefault(); ACT[d.act](); return; }
  if(d.call){ openCall(d.call); return; }
  if(d.tab){ TAB = d.tab; lsSet('tab', TAB); render(); return; }
  if(d.dial){ count(d.dial); setTimeout(function(){ closeCall(); }, 400); return; } // 讓 tel: 連結照常打開電話 App
  if(d.sos) return;
  if(d.cfg){ var v = d.v; CFG[d.cfg] = v === 'true' ? true : v === 'false' ? false : v; saveCfg(); applyView(); render(); openSettings(); return; }
  if(d.up || d.down){ var i = +(d.up || d.down), j = d.up ? i - 1 : i + 1; if(j < 0 || j >= LIST.length) return; var x = LIST[i]; LIST[i] = LIST[j]; LIST[j] = x; saveList(); render(); var b = document.querySelector('[data-' + (d.up ? 'up' : 'down') + '="' + j + '"]'); if(b && !b.disabled) b.focus(); return; }
  if(d.edit){ openForm(d.edit); return; }
  if(d.del){
    if(delArm !== d.del){ delArm = d.del; t.textContent = '確定?'; t.style.background = 'var(--red)'; t.style.color = '#fff'; t.style.width = '4.2rem'; t.style.fontSize = '.85rem'; toast('再按一次「確定?」才會刪除'); setTimeout(function(){ if(delArm === d.del){ delArm = null; render(); } }, 4000); return; }
    var c = LIST.filter(function(z){ return z.id === d.del; })[0]; LIST = LIST.filter(function(z){ return z.id !== d.del; }); delete COUNTS[d.del]; delArm = null; saveList(); lsSet('counts', JSON.stringify(COUNTS)); render(); toast('已刪除「' + (c ? B.title(c) : '') + '」'); return;
  }
});
document.addEventListener('change', function(e){
  var t = e.target;
  if(t.dataset.cfgc){ CFG[t.dataset.cfgc] = t.checked; saveCfg(); applyView(); render(); return; }
  if(t.dataset.emg){ var id = t.dataset.emg; CFG.hideEmg = CFG.hideEmg.filter(function(x){ return x !== id; }); if(!t.checked) CFG.hideEmg.push(id); saveCfg(); render(); return; }
  if(t.id === 'photoIn' && t.files && t.files[0]){ readForm(); readPhoto(t.files[0]).then(function(u){ FORM.photo = u; formHtml(); }).catch(function(err){ toast(err.message); }); return; }
  if(t.id === 'restoreIn' && t.files && t.files[0]){
    var fr = new FileReader();
    fr.onload = function(){ var r = B.restore(String(fr.result)); t.value = ''; if(!r){ toast('這不是大字電話簿的備份檔'); return; } RESTORE = r; openModal('<h2>📂 還原備份</h2><p>備份裡有 <b>' + r.contacts.length + '</b> 位聯絡人。</p><div class="stack"><button type="button" class="btn" data-act="restoreAll">取代目前的電話簿</button><button type="button" class="btn alt" data-act="restoreMerge">加進目前的電話簿</button><button type="button" class="btn alt" data-act="close">取消</button></div>'); };
    fr.readAsText(t.files[0]);
  }
});
$('modal').addEventListener('click', function(e){ if(e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  if(!$('callView').hidden) closeCall(); else if($('modal').classList.contains('show')) closeModal();
});
document.addEventListener('keydown', function(e){ if(e.key === 'Enter' && e.target && e.target.id === 'pinIn') ACT.pinOk(); });

/* ---------- 跑馬燈（工作區共用公告，不可關） ---------- */
function initMarquee(){
  var URL_ = "https://script.google.com/macros/s/AKfycbwKX0DNNbY8y4nf90BFTHtxgfqJcHHcZasRrgycl4QAe52_hkjMWSkYk4xOsqU-JPCROw/exec";
  var REFRESH = 20 * 60 * 1000, bar = $('marqueeBar'), track = $('marqueeTrack'), lastKey = null;
  function appendText(c, text){ var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, li = 0, m; while((m = re.exec(text))){ if(m.index > li) c.appendChild(document.createTextNode(text.slice(li, m.index))); var a = document.createElement('a'); a.href = m[2]; a.textContent = m[1]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.color = 'inherit'; a.style.textDecoration = 'underline'; c.appendChild(a); li = re.lastIndex; } if(li < text.length) c.appendChild(document.createTextNode(text.slice(li))); }
  function renderM(items){
    if(!items || !items.length) return;
    var k = JSON.stringify(items); if(k === lastKey) return; lastKey = k; track.innerHTML = '';
    var fr = document.createDocumentFragment();
    function pass(){ items.forEach(function(it, i){ if(i > 0) fr.appendChild(document.createTextNode('　★　')); appendText(fr, String(it)); }); }
    pass(); fr.appendChild(document.createTextNode('　★　')); pass(); track.appendChild(fr);
    bar.classList.add('show'); document.body.classList.add('has-marquee');
    track.style.animationDuration = Math.max(track.scrollWidth / 2 / 60, 12) + 's';
  }
  function fetchM(){ fetch(URL_, {method:'POST', body:JSON.stringify({serial:''})}).then(function(r){ return r.json(); }).then(function(d){ if(d && Array.isArray(d.marquee) && d.marquee.length){ lsSet('marquee', JSON.stringify(d.marquee)); renderM(d.marquee); } }).catch(function(){}); }
  renderM(lsJson('marquee', [])); fetchM(); setInterval(fetchM, REFRESH);
}

window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window._dp = e; });
if('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(function(){});
window.addEventListener('hashchange', checkHash);

applyView(); render(); initMarquee();
var hasImport = /^#c=/.test(location.hash);
if(!lsGet('warnSeen') && !hasImport){ showWarn(); lsSet('warnSeen', '1'); }
checkHash();
window._bdp = {get LIST(){ return LIST; }, get CFG(){ return CFG; }, get COUNTS(){ return COUNTS; }, get EDIT(){ return EDIT; }, openCall:openCall, preparePrint:preparePrint, shareUrl:shareUrl, ACT:ACT};
})();
