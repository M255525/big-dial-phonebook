/* 大字電話簿：純函式引擎（不碰 DOM，node 也能 require 測試）
   電話號碼整理／顯示格式／分類、撥號與簡訊連結、分享連結（不含照片）、匯入合併、排序、頭像底色、緊急電話、範例。 */
(function(root){
'use strict';

const cut = (s, n) => Array.from(String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ')).slice(0, n).join('').trim();
const FW = (s) => String(s == null ? '' : s).replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');

/* ---------- 分類 ---------- */
const CATS = {
  fam:   {n:'家人', c:'#C8553D'},
  friend:{n:'朋友', c:'#3A7CA5'},
  med:   {n:'看病', c:'#2E8B57'},
  life:  {n:'生活', c:'#B8860B'},
  emg:   {n:'緊急', c:'#B22222'},
};
const CAT_ORDER = ['fam', 'friend', 'med', 'life', 'emg'];
const TEL_LABELS = ['手機', '家裡', '公司', '其他'];

/* ---------- 緊急與常用公共專線（內建，不能刪，可隱藏）。來源：內政部警政署、內政部消防署、衛生福利部公開資訊 ---------- */
const EMERGENCY = [
  {id:'e110', n:'110', name:'警察', say:'遇到搶劫、車禍、有人闖進家裡', src:'內政部警政署', big:true},
  {id:'e119', n:'119', name:'救護車・火災', say:'有人昏倒、受傷、失火', src:'內政部消防署', big:true},
  {id:'e165', n:'165', name:'反詐騙專線', say:'懷疑被騙、接到奇怪的電話或簡訊', src:'內政部警政署'},
  {id:'e1966', n:'1966', name:'長照專線', say:'想申請居家照顧、日間照顧、輔具', src:'衛生福利部'},
  {id:'e1925', n:'1925', name:'安心專線', say:'心情很差、想找人說說話（24 小時）', src:'衛生福利部'},
  {id:'e113', n:'113', name:'保護專線', say:'被家人打罵、照顧疏忽', src:'衛生福利部'},
  {id:'e1957', n:'1957', name:'福利諮詢專線', say:'想問社會福利、補助怎麼申請', src:'衛生福利部'},
];

/* ---------- 號碼 ---------- */
// 全形轉半形、去掉空白破折號括號點；分機（#123、轉123、分機123、ext 123）改成「,123」讓手機接通後自動按
function normTel(s){
  let t = FW(s).trim();
  if(!t) return '';
  let ext = '';
  const m = t.match(/(?:#|,|，|轉|分機|ext\.?|x)\s*(\d{1,6})\s*$/i); // 「,」是已經整理過的分機，再整理一次要保留
  if(m){ ext = m[1]; t = t.slice(0, m.index); }
  const plus = /^\s*\+/.test(t);
  t = t.replace(/[^\d]/g, '');
  if(!t) return '';
  return (plus ? '+' : '') + t + (ext ? ',' + ext : '');
}
function splitExt(n){ const i = String(n).indexOf(','); return i < 0 ? [String(n), ''] : [String(n).slice(0, i), String(n).slice(i + 1)]; }
// +886 9xx → 09xx（只用在顯示與比對）
function local(n){ return /^\+886\d{8,9}$/.test(n) ? '0' + n.slice(4) : n; }
function checkTel(s){
  const [n] = splitExt(normTel(s));
  if(!n) return '';
  const l = local(n);
  if(/^09\d{8}$/.test(l)) return 'mobile';
  if(/^0[2-8]\d{6,8}$/.test(l)) return 'land';
  if(/^\d{3,4}$/.test(l)) return 'short';
  if(/^\+\d{8,15}$/.test(l)) return 'intl';
  return 'bad';
}
const AREA4 = ['0826', '0836'], AREA3 = ['037', '049', '082', '089'];
function fmtTel(s){
  const [n0, ext] = splitExt(normTel(s));
  if(!n0) return '';
  const n = local(n0);
  let o = n;
  if(/^09\d{8}$/.test(n)) o = n.slice(0, 4) + '-' + n.slice(4, 7) + '-' + n.slice(7);
  else if(/^0/.test(n) && n.length >= 8){
    const a = AREA4.find((x) => n.startsWith(x)) || AREA3.find((x) => n.startsWith(x)) || n.slice(0, 2);
    const r = n.slice(a.length);
    o = a + '-' + (r.length === 8 ? r.slice(0, 4) + '-' + r.slice(4) : r.length === 7 ? r.slice(0, 3) + '-' + r.slice(3) : r.length === 6 ? r.slice(0, 3) + '-' + r.slice(3) : r);
  }
  return o + (ext ? ' 分機 ' + ext : '');
}
function telHref(s){ const n = normTel(s); return n ? 'tel:' + n : ''; }
function smsHref(s){ const [n] = splitExt(normTel(s)); return n ? 'sms:' + n : ''; }
function sameTel(a, b){ const x = local(splitExt(normTel(a))[0]), y = local(splitExt(normTel(b))[0]); return !!x && x === y; }

/* ---------- 聯絡人 ---------- */
function uid(){ return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
// 整理成乾淨的聯絡人（擋掉奇怪欄位、長度）
function clean(c){
  c = c && typeof c === 'object' ? c : {};
  const tels = (Array.isArray(c.tels) ? c.tels : []).map((t) => ({t:TEL_LABELS.indexOf(t && t.t) >= 0 ? t.t : '手機', n:normTel(t && t.n)})).filter((t) => t.n).slice(0, 4);
  return {id:typeof c.id === 'string' && /^[\w-]{1,40}$/.test(c.id) ? c.id : uid(), name:cut(c.name, 12), full:cut(c.full, 20), cat:CATS[c.cat] && c.cat !== 'emg' ? c.cat : 'fam',
    tels, note:cut(c.note, 40), photo:typeof c.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(c.photo) ? c.photo : ''};
}
function title(c){ return c.name || c.full || fmtTel(c.tels && c.tels[0] && c.tels[0].n) || '沒有名字'; }
function initial(c){ const s = (c.name || c.full || '').replace(/^(大|小|老|阿)(?=.)/, ''); return Array.from(s || '☎')[0]; }
const AV = ['#C8553D', '#2F6FA8', '#2E8B57', '#8E5BA6', '#A8790C', '#1F7A8C', '#5E7F1F', '#A23E5C'];
function avatarColor(name){ let h = 0; Array.from(String(name || '')).forEach((ch) => { h = (h * 31 + ch.codePointAt(0)) >>> 0; }); return AV[h % AV.length]; }

// 排序：manual＝照清單順序；freq＝常按的在前（同次數照原順序）
function sortContacts(list, mode, counts){
  const idx = new Map(list.map((c, i) => [c.id, i]));
  if(mode !== 'freq') return list.slice();
  counts = counts || {};
  return list.slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || idx.get(a.id) - idx.get(b.id));
}
// 匯入合併：任一支號碼相同就當同一個人，更新名字分類號碼，但保留原本的照片；回傳 {list, added, updated}
function mergeContacts(list, incoming){
  const out = list.map((c) => Object.assign({}, c, {tels:c.tels.slice()}));
  let added = 0, updated = 0;
  (incoming || []).map(clean).forEach((n) => {
    if(!n.tels.length && !n.name) return;
    const hit = out.find((c) => c.tels.some((a) => n.tels.some((b) => sameTel(a.n, b.n))) || (!n.tels.length && c.name === n.name));
    if(hit){
      const photo = hit.photo || n.photo;
      const tels = hit.tels.slice();
      n.tels.forEach((t) => { if(!tels.some((x) => sameTel(x.n, t.n))) tels.push(t); });
      Object.assign(hit, {name:n.name || hit.name, full:n.full || hit.full, cat:n.cat, note:n.note || hit.note, tels:tels.slice(0, 4), photo});
      updated++;
    } else { out.push(n); added++; }
  });
  return {list:out, added, updated};
}

/* ---------- 分享連結（不含照片） ---------- */
function b64e(s){ if(typeof Buffer !== 'undefined') return Buffer.from(s, 'utf-8').toString('base64'); const b = new TextEncoder().encode(s); let t = ''; b.forEach((x) => { t += String.fromCharCode(x); }); return btoa(t); }
function b64d(s){ if(typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf-8'); const t = atob(s); return new TextDecoder().decode(Uint8Array.from(t, (ch) => ch.charCodeAt(0))); }
function encodeShare(list){
  const o = {v:1, c:list.map((c) => { const r = {n:c.name, t:c.tels.map((t) => [t.t, t.n])}; if(c.full) r.f = c.full; if(c.cat !== 'fam') r.k = c.cat; if(c.note) r.o = c.note; return r; })};
  return b64e(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeShare(s){
  try{
    const o = JSON.parse(b64d(String(s).replace(/-/g, '+').replace(/_/g, '/')));
    if(!o || o.v !== 1 || !Array.isArray(o.c)) return null;
    return o.c.slice(0, 200).map((r) => clean({name:r.n, full:r.f, cat:r.k || 'fam', note:r.o, tels:(Array.isArray(r.t) ? r.t : []).map((x) => ({t:x[0], n:x[1]}))})).filter((c) => c.tels.length);
  }catch(e){ return null; }
}

/* ---------- 備份檔 ---------- */
function backup(list, cfg){ return JSON.stringify({app:'big-dial-phonebook', v:1, saved:new Date().toISOString(), contacts:list, cfg:cfg || {}}); }
function restore(text){
  try{
    const o = JSON.parse(text);
    if(!o || o.app !== 'big-dial-phonebook' || !Array.isArray(o.contacts)) return null;
    return {contacts:o.contacts.slice(0, 300).map(clean).filter((c) => c.tels.length || c.name), cfg:o.cfg && typeof o.cfg === 'object' ? o.cfg : {}};
  }catch(e){ return null; }
}

/* ---------- 範例（全部虛構；0912-000-xxx、(02)1234-xxxx 都是假號碼） ---------- */
const EXAMPLE = [
  {name:'大兒子', full:'林志明', cat:'fam', tels:[{t:'手機', n:'0912000101'}, {t:'公司', n:'0212340102#215'}], note:'每週日回家吃飯'},
  {name:'女兒', full:'林小芳', cat:'fam', tels:[{t:'手機', n:'0912000102'}], note:''},
  {name:'孫子', full:'林宇翔', cat:'fam', tels:[{t:'手機', n:'0912000103'}], note:'會修手機'},
  {name:'老伴', full:'陳美玉', cat:'fam', tels:[{t:'手機', n:'0912000104'}], note:''},
  {name:'王伯伯', full:'王大同', cat:'friend', tels:[{t:'手機', n:'0912000201'}], note:'公園下棋'},
  {name:'里長', full:'', cat:'friend', tels:[{t:'手機', n:'0912000202'}], note:''},
  {name:'家醫科', full:'示範家庭醫學科診所', cat:'med', tels:[{t:'其他', n:'0212340301'}], note:'掛號、拿慢性病藥'},
  {name:'藥局', full:'示範社區藥局', cat:'med', tels:[{t:'其他', n:'0212340302'}], note:''},
  {name:'管理室', full:'', cat:'life', tels:[{t:'其他', n:'0212340401'}], note:'收包裹、修水電'},
  {name:'叫計程車', full:'', cat:'life', tels:[{t:'其他', n:'0212340402'}], note:''},
];

const API = {CATS, CAT_ORDER, TEL_LABELS, EMERGENCY, normTel, splitExt, checkTel, fmtTel, telHref, smsHref, sameTel, clean, title, initial, avatarColor, sortContacts, mergeContacts, encodeShare, decodeShare, backup, restore, EXAMPLE, uid, cut};
if(typeof module === 'object' && module.exports) module.exports = API;
root.BDP = API;
})(typeof window !== 'undefined' ? window : globalThis);
