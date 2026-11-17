// node tools/test_engine.mjs —— 大字電話簿引擎測試
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
const B = require('../engine.js');
let n = 0, bad = 0;
function ok(c, msg){ n++; if(!c){ bad++; console.log('✗ ' + msg); } }
function eq(a, b, msg){ ok(JSON.stringify(a) === JSON.stringify(b), msg + '：得到 ' + JSON.stringify(a) + '，應為 ' + JSON.stringify(b)); }

// 號碼整理
eq(B.normTel('0912-345-678'), '0912345678', '手機去破折號');
eq(B.normTel('０９１２ ３４５ ６７８'), '0912345678', '全形數字與空白');
eq(B.normTel('(02)2345-6789'), '0223456789', '括號區碼');
eq(B.normTel('02-2345-6789#123'), '0223456789,123', '分機 #');
eq(B.normTel('02-2345-6789 轉 123'), '0223456789,123', '分機 轉');
eq(B.normTel('02-2345-6789分機123'), '0223456789,123', '分機 分機');
eq(B.normTel('02 2345 6789 ext. 45'), '0223456789,45', '分機 ext');
eq(B.normTel('+886 912 345 678'), '+886912345678', '國際碼保留 +');
eq(B.normTel('＋８８６９１２３４５６７８'), '+886912345678', '全形 +');
eq(B.normTel(''), '', '空白');
eq(B.normTel(B.normTel('02-2345-6789#123')), '0223456789,123', '整理兩次分機不會黏進號碼');
eq(B.normTel('02-2345-6789，123'), '0223456789,123', '全形逗號分機');
eq(B.normTel('沒有號碼'), '', '沒有數字');

// 分類
eq(B.checkTel('0912345678'), 'mobile', '手機');
eq(B.checkTel('+886912345678'), 'mobile', '+886 手機');
eq(B.checkTel('0223456789'), 'land', '台北市話');
eq(B.checkTel('037123456'), 'land', '苗栗市話');
eq(B.checkTel('083612345'), 'land', '馬祖市話');
eq(B.checkTel('110'), 'short', '短碼 110');
eq(B.checkTel('1966'), 'short', '短碼 1966');
eq(B.checkTel('+81312345678'), 'intl', '國際');
eq(B.checkTel('12345'), 'bad', '看不懂');
eq(B.checkTel('091234567'), 'bad', '手機少一碼');
eq(B.checkTel('02-2345-6789#9'), 'land', '有分機也是市話');

// 顯示格式
eq(B.fmtTel('0912345678'), '0912-345-678', '手機格式');
eq(B.fmtTel('+886912345678'), '0912-345-678', '+886 顯示成 09');
eq(B.fmtTel('0223456789'), '02-2345-6789', '台北');
eq(B.fmtTel('0422345678'), '04-2234-5678', '台中 8 碼');
eq(B.fmtTel('062345678'), '06-234-5678', '台南 7 碼');
eq(B.fmtTel('037123456'), '037-123-456', '苗栗 037');
eq(B.fmtTel('0492345678'), '049-234-5678', '南投 049 7 碼');
eq(B.fmtTel('082312345'), '082-312-345', '金門 082');
eq(B.fmtTel('083612345'), '0836-12345', '馬祖 0836');
eq(B.fmtTel('02-2345-6789#123'), '02-2345-6789 分機 123', '分機顯示');
eq(B.fmtTel('110'), '110', '短碼原樣');
eq(B.fmtTel(''), '', '空白');

// 連結
eq(B.telHref('0912-345-678'), 'tel:0912345678', 'tel 連結');
eq(B.telHref('02-2345-6789#123'), 'tel:0223456789,123', 'tel 分機暫停');
eq(B.telHref('+886 912 345 678'), 'tel:+886912345678', 'tel 國際');
eq(B.smsHref('02-2345-6789#123'), 'sms:0223456789', 'sms 不帶分機');
eq(B.telHref(''), '', '沒號碼不給連結');
ok(B.sameTel('0912-345-678', '+886912345678'), '+886 與 09 視為同一支');
ok(!B.sameTel('0912345678', '0912345679'), '不同號碼');

// clean
const c1 = B.clean({name:'　大兒子很長很長很長很長很長', cat:'emg', tels:[{t:'亂寫', n:'0912 345 678'}, {t:'家裡', n:''}], photo:'javascript:alert(1)', id:'<x>'});
eq(c1.name.length <= 12, true, '稱呼截斷');
eq(c1.cat, 'fam', '不能自己存成緊急分類');
eq(c1.tels, [{t:'手機', n:'0912345678'}], '號碼整理、空號碼去掉、標籤修正');
eq(c1.photo, '', '照片只收 data:image');
ok(/^c/.test(c1.id) && c1.id !== '<x>', 'id 不合法時重新產生');
eq(B.clean({tels:[1, 2, 3, 4, 5, 6].map((i) => ({t:'手機', n:'091234567' + i}))}).tels.length, 4, '最多 4 支電話');
eq(B.initial({name:'大兒子'}), '兒', '頭像字去掉「大」');
eq(B.initial({name:'王伯伯'}), '王', '頭像字');
eq(B.initial({name:'', full:''}), '☎', '沒名字用話筒');
eq(B.avatarColor('女兒'), B.avatarColor('女兒'), '同名同色');
eq(B.title({name:'', full:'', tels:[{n:'0912345678'}]}), '0912-345-678', '沒名字顯示號碼');

// 排序
const L = [{id:'a'}, {id:'b'}, {id:'c'}];
eq(B.sortContacts(L, 'manual', {c:9}).map((x) => x.id), ['a', 'b', 'c'], '照順序');
eq(B.sortContacts(L, 'freq', {c:9, b:2}).map((x) => x.id), ['c', 'b', 'a'], '常按的在前');
eq(B.sortContacts(L, 'freq', {}).map((x) => x.id), ['a', 'b', 'c'], '沒按過照原順序');

// 合併
const base = [B.clean({id:'x1', name:'大兒子', tels:[{t:'手機', n:'0912000101'}], photo:'data:image/jpeg;base64,AAAA'})];
const r = B.mergeContacts(base, [{name:'阿明', tels:[{t:'手機', n:'+886912000101'}, {t:'家裡', n:'0212340000'}]}, {name:'女兒', tels:[{t:'手機', n:'0912000102'}]}, {name:'', tels:[]}]);
eq([r.added, r.updated], [1, 1], '新增 1 更新 1、空的忽略');
eq(r.list[0].photo, 'data:image/jpeg;base64,AAAA', '更新時保留照片');
eq(r.list[0].name, '阿明', '更新稱呼');
eq(r.list[0].tels.length, 2, '加上新的家裡電話、同號不重複');
eq(base[0].name, '大兒子', '不改到原本的陣列');

// 分享連結
const ex = B.EXAMPLE.map(B.clean);
ex[0].photo = 'data:image/jpeg;base64,' + 'A'.repeat(500);
const code = B.encodeShare(ex);
ok(/^[A-Za-z0-9_-]+$/.test(code), '分享碼是網址安全字元');
ok(code.length < 2500, '10 位的分享碼不會太長：' + code.length);
const back = B.decodeShare(code);
eq(back.length, ex.length, '人數一樣');
eq(back.map((c) => [c.name, c.full, c.cat, c.note, c.tels]), ex.map((c) => [c.name, c.full, c.cat, c.note, c.tels]), '內容一樣');
ok(back.every((c) => !c.photo), '照片不跟著傳');
eq(B.decodeShare('壞掉!!'), null, '壞掉的分享碼');
eq(B.decodeShare(Buffer.from('{"v":2}').toString('base64')), null, '版本不對');

// 備份
const bk = B.backup(ex, {fs:'xl'});
const rs = B.restore(bk);
eq(rs.contacts.length, ex.length, '備份還原人數');
eq(rs.contacts[0].photo, ex[0].photo, '備份含照片');
eq(rs.cfg.fs, 'xl', '備份含設定');
eq(B.restore('{"app":"別的"}'), null, '不是電話簿的備份');
eq(B.restore('not json'), null, '壞檔');

// 緊急
eq(B.EMERGENCY.map((e) => e.n), ['110', '119', '165', '1966', '1925', '113', '1957'], '公共專線清單');
ok(B.EMERGENCY.every((e) => B.checkTel(e.n) === 'short' && e.src && e.say), '每支都有用途與來源');
eq(B.EMERGENCY.filter((e) => e.big).map((e) => e.n), ['110', '119'], '110、119 放最上面');

// 範例全是假號碼
ok(B.EXAMPLE.every((c) => c.tels.every((t) => /^0912000|^021234/.test(B.normTel(t.n)))), '範例都是 0912-000-xxx 或 02-1234-xxxx 假號碼');
ok(B.EXAMPLE.map(B.clean).every((c) => c.tels.length && c.name), '範例完整');

console.log((bad ? '✗ ' : '✓ ') + (n - bad) + '/' + n + ' 項通過');
process.exit(bad ? 1 : 0);
