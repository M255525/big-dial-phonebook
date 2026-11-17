# 端對端測試：python tools/e2e_phone.py [輸出資料夾]（需先開 8891；線上版設 BDP_BASE）
import os, sys, io, json, asyncio
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
from playwright.async_api import async_playwright

BASE = os.environ.get('BDP_BASE', 'http://localhost:8891/')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('TEMP', '.'), 'bdp_e2e')
os.makedirs(OUT, exist_ok=True)
fails = []
def check(c, msg):
    print(('✓ ' if c else '✗ ') + msg)
    if not c: fails.append(msg)
# 攔下 tel:／sms: 連結，不讓桌面瀏覽器真的去開電話程式；記下最後一個被點的號碼
NOTEL = '''window.__tel=[];window.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href^='tel:'],a[href^='sms:']");if(a){e.preventDefault();window.__tel.push(a.getAttribute("href"));}},true);'''
async def ready(pg):
    await pg.wait_for_function('window._bdp')
    await pg.evaluate(NOTEL)
async def hold(pg, ms):
    b = await pg.query_selector('#holdBtn'); box = await b.bounding_box()
    await pg.mouse.move(box['x'] + 20, box['y'] + 10); await pg.mouse.down(); await pg.wait_for_timeout(ms); await pg.mouse.up(); await pg.wait_for_timeout(150)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1200, 'height': 900}, accept_downloads=True)
        pg = await ctx.new_page()
        errs = []
        def watch(page):
            page.on('pageerror', lambda e: errs.append(str(e)))
            page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'visitor-badge' not in m.text and 'script.google' not in m.text else None)
        watch(pg)
        await pg.goto(BASE); await ready(pg)
        check(await pg.is_visible('#modal.show') and '撥號捷徑，不是緊急救援服務' in await pg.text_content('#modalBox'), '首訪跳出使用警語（不是緊急救援服務）')
        await pg.click('#modal [data-act=close]')
        n0 = await pg.evaluate('window._bdp.LIST.length')
        check(n0 == 10 and await pg.is_visible('.banner'), '第一次打開放 10 位範例＋範例提示')
        check(await pg.get_attribute('[data-sos="110"]', 'href') == 'tel:110' and await pg.get_attribute('[data-sos="119"]', 'href') == 'tel:119', '110、119 常駐在最上面')
        check(await pg.is_visible('a[href="manual.html"]') and await pg.is_visible('.foot a[href="manual.html#creator"]') and await pg.is_visible('.foot [data-act=install]') and await pg.locator('.foot img[src*="bigdialphonebook"]').count() == 1 and await pg.is_visible('.warn-line [data-act=warn]'), '五件套入口：手冊、創作者、警語、加入主畫面、訪客數')
        check(await pg.locator('#page .card').count() == 10, '全部分頁 10 張卡片')
        await pg.evaluate('window._bdp.preparePrint("book")')
        try:
            import fitz
            d = fitz.open(stream=await pg.pdf(print_background=True, prefer_css_page_size=True), filetype='pdf')
            check(d.page_count == 2, '範例 10 位列印剛好 2 頁（一頁 6 位，%d 頁）' % d.page_count)
        except ImportError: pass
        await pg.evaluate('document.getElementById("printArea").innerHTML=""')
        await pg.click('[data-tab=med]')
        check(await pg.locator('#page .card').count() == 2, '看病分頁 2 張')
        await pg.click('[data-tab=emg]')
        check(await pg.locator('#page .card.emg').count() == 7 and '衛生福利部' in await pg.text_content('#page'), '緊急分頁 7 支公共專線＋來源')
        await pg.click('[data-tab=all]')

        # 撥號確認
        await pg.click('.card[aria-label="打給大兒子"]')
        check(await pg.is_visible('#callView') and '要打給' in await pg.text_content('#callView'), '點卡片出現「要打給大兒子嗎？」')
        hrefs = await pg.evaluate('[...document.querySelectorAll("#callView .go")].map(a=>a.getAttribute("href"))')
        check(hrefs == ['tel:0912000101', 'tel:0212340102,215'], '兩支電話的撥號連結（分機用逗號暫停）' + str(hrefs))
        check(await pg.locator('#callView a.sms').get_attribute('href') == 'sms:0912000101', '傳簡訊用手機號碼')
        await pg.screenshot(path=os.path.join(OUT, 'call.png'))
        await pg.click('#callView .nogo')
        check(await pg.is_hidden('#callView'), '「不要打」關掉')
        await pg.click('.card[aria-label="打給管理室"]')
        await pg.click('#callView .go')
        await pg.wait_for_timeout(600)
        mid = await pg.evaluate('window._bdp.LIST.find(c=>c.name==="管理室").id')
        check(await pg.evaluate('window.__tel.slice(-1)[0]') == 'tel:0212340401' and await pg.evaluate(f'window._bdp.COUNTS["{mid}"]') == 1 and await pg.is_hidden('#callView'), '按撥出：打出 tel、記一次、畫面收起')
        await pg.click('.card[aria-label="打給管理室"]'); await pg.keyboard.press('Escape')
        check(await pg.is_hidden('#callView'), 'Esc 關掉撥號畫面')

        # 設定：常按的在前、一按就撥、字級、高對比
        await pg.click('.cover [data-act=settings]')
        await pg.click('.set-sec[data-sec=sort] summary'); await pg.click('[data-cfg=sort][data-v=freq]')
        await pg.click('#modal [data-act=close]')
        check(await pg.get_attribute('#page .card >> nth=0', 'aria-label') == '打給管理室', '常按的在前：管理室排第一')
        await pg.click('.cover [data-act=settings]')
        await pg.click('.set-sec[data-sec=call] summary'); await pg.click('[data-cfg=confirm][data-v=false]')
        await pg.click('#modal [data-act=close]')
        await pg.click('.card[aria-label="打給女兒"]')
        await pg.wait_for_timeout(200)
        check(await pg.is_hidden('#callView') and await pg.evaluate('window.__tel.slice(-1)[0]') == 'tel:0912000102', '一按就撥：不跳確認直接撥')
        await pg.click('.card[aria-label="打給大兒子"]')
        check(await pg.is_visible('#callView'), '一按就撥但有兩支電話：仍先問要打哪支')
        await pg.click('#callView .nogo')
        await pg.click('.cover [data-act=settings]')
        await pg.click('.set-sec[data-sec=call] summary') if not await pg.is_visible('[data-cfg=confirm][data-v=true]') else None
        await pg.click('[data-cfg=confirm][data-v=true]')
        await pg.click('.set-sec[data-sec=view] summary') if not await pg.is_visible('[data-cfg=fs][data-v=xxl]') else None
        await pg.click('[data-cfg=fs][data-v=xxl]')
        check(await pg.evaluate('document.documentElement.dataset.fs') == 'xxl', '字級超大')
        await pg.click('[data-cfg=fs][data-v=m]')
        await pg.check('[data-cfgc=hc]')
        check(await pg.evaluate('document.documentElement.dataset.hc') == '1', '高對比')
        await pg.uncheck('[data-cfgc=hc]')
        await pg.click('.set-sec[data-sec=emg] summary') if not await pg.is_visible('[data-emg=e113]') else None
        await pg.uncheck('[data-emg=e113]')

        # 按住 2 秒才進整理
        await pg.click('#holdBtn')
        check(not await pg.evaluate('window._bdp.EDIT'), '短按進不去整理模式')
        await hold(pg, 900)
        check(not await pg.evaluate('window._bdp.EDIT'), '按 0.9 秒放開進不去')
        await hold(pg, 2300)
        check(await pg.evaluate('window._bdp.EDIT') and await pg.is_visible('[data-act=add]'), '按住 2 秒進入整理模式')
        await pg.click('[data-act=clearEx]')
        check(await pg.evaluate('window._bdp.LIST.length') == 0 and not await pg.evaluate('window._bdp.CFG.example'), '清掉範例')

        # 新增（含照片）
        from PIL import Image
        ph = os.path.join(OUT, 'face.jpg'); Image.new('RGB', (900, 1200), (210, 160, 130)).save(ph)
        await pg.click('[data-act=add]')
        await pg.fill('#fName', '阿明'); await pg.fill('#fFull', '測試阿明'); await pg.fill('[data-tn="0"]', '０９１２－１１１－２２２')
        await pg.set_input_files('#photoIn', ph); await pg.wait_for_timeout(400)
        check(await pg.input_value('#fName') == '阿明', '上傳照片後表單內容還在')
        await pg.click('[data-act=saveForm]')
        c = await pg.evaluate('window._bdp.LIST[0]')
        check(c['tels'][0]['n'] == '0912111222' and c['photo'].startswith('data:image/jpeg'), '新增：全形號碼整理好、照片存成 JPEG')
        dim = await pg.evaluate('new Promise(r=>{const i=new Image();i.onload=()=>r([i.width,i.height]);i.src=window._bdp.LIST[0].photo})')
        check(dim == [320, 320], '照片裁成 320×320 正方形')
        await pg.click('[data-act=add]')
        await pg.fill('#fName', '奇怪號碼'); await pg.fill('[data-tn="0"]', '12345')
        await pg.click('[data-act=saveForm]')
        check('不像台灣的電話號碼' in await pg.text_content('#fMsg') and await pg.evaluate('window._bdp.LIST.length') == 1, '看不懂的號碼先提醒')
        await pg.click('[data-act=saveForm]')
        check(await pg.evaluate('window._bdp.LIST.length') == 2, '確定沒錯再按一次可以存')
        await pg.click('[data-act=add]')
        await pg.fill('#fName', '女兒'); await pg.select_option('#fCat', 'fam'); await pg.fill('[data-tn="0"]', '0912333444'); await pg.fill('[data-tn="1"]', '02-2345-6789轉88')
        await pg.click('[data-act=saveForm]')
        check(await pg.evaluate('window._bdp.LIST[2].tels[1].n') == '0223456789,88', '第二支電話含分機')
        await pg.click('[data-act=add]')
        await pg.click('[data-act=saveForm]')
        check('至少填一支電話' in await pg.text_content('#fMsg'), '沒填電話不能存')
        await pg.click('#modal [data-act=close]')
        # 修改、排序、刪除
        await pg.click('[data-edit="' + await pg.evaluate('window._bdp.LIST[1].id') + '"]')
        await pg.fill('#fName', '王伯伯'); await pg.fill('[data-tn="0"]', '0912555666')
        await pg.click('[data-act=saveForm]')
        check(await pg.evaluate('window._bdp.LIST[1].name') == '王伯伯' and await pg.evaluate('window._bdp.LIST[1].tels[0].n') == '0912555666', '修改聯絡人')
        await pg.click('[data-up="2"]')
        check(await pg.evaluate('window._bdp.LIST.map(c=>c.name)') == ['阿明', '女兒', '王伯伯'], '往上移')
        await pg.click('[data-del="' + await pg.evaluate('window._bdp.LIST[2].id') + '"]')
        check(await pg.evaluate('window._bdp.LIST.length') == 3, '刪除第一次只是確認')
        await pg.click('[data-del="' + await pg.evaluate('window._bdp.LIST[2].id') + '"]')
        check(await pg.evaluate('window._bdp.LIST.length') == 2, '再按一次才刪掉')
        await pg.screenshot(path=os.path.join(OUT, 'edit.png'), full_page=True)

        # 整理密碼
        await pg.click('[data-act=pinSet]'); await pg.fill('#pinNew', '1234'); await pg.click('[data-act=pinSave]')
        await pg.click('[data-act=exitEdit]')
        await pg.click('.cover [data-act=settings]')
        await hold(pg, 2300)
        check(await pg.is_visible('#pinIn') and not await pg.evaluate('window._bdp.EDIT'), '設了密碼：按住後要輸入密碼')
        await pg.fill('#pinIn', '0000'); await pg.click('[data-act=pinOk]'); await pg.wait_for_timeout(200)
        check(not await pg.evaluate('window._bdp.EDIT'), '密碼錯進不去')
        await pg.fill('#pinIn', '1234'); await pg.click('[data-act=pinOk]'); await pg.wait_for_timeout(200)
        check(await pg.evaluate('window._bdp.EDIT'), '密碼對才進去')
        check(len(await pg.evaluate('window._bdp.CFG.pin')) == 64, '密碼只存雜湊')

        # 列印
        await pg.evaluate('window._bdp.preparePrint("book")')
        pdf = await pg.pdf(print_background=True, prefer_css_page_size=True)
        open(os.path.join(OUT, 'book.pdf'), 'wb').write(pdf)
        try:
            import fitz
            d = fitz.open(stream=pdf, filetype='pdf'); check(d.page_count == 1, '列印電話簿 2 位 → 1 頁'); d[0].get_pixmap(dpi=55).save(os.path.join(OUT, 'book.png'))
        except ImportError: pass
        await pg.evaluate('window._bdp.preparePrint("wallet")')
        check(await pg.locator('#printArea .wcard').count() == 4, '皮夾小卡 4 張')
        pdf = await pg.pdf(print_background=True, prefer_css_page_size=True)
        try:
            import fitz
            d = fitz.open(stream=pdf, filetype='pdf'); check(d.page_count == 1, '皮夾小卡 1 頁'); d[0].get_pixmap(dpi=55).save(os.path.join(OUT, 'wallet.png'))
        except ImportError: pass
        await pg.evaluate('document.getElementById("printArea").innerHTML=""')

        # 備份
        async with pg.expect_download() as dl:
            await pg.click('[data-act=backup]')
        dd = await dl.value; bk = os.path.join(OUT, 'backup.json'); await dd.save_as(bk)
        j = json.load(open(bk, encoding='utf-8'))
        check(j['app'] == 'big-dial-phonebook' and len(j['contacts']) == 2 and j['contacts'][0]['photo'].startswith('data:image') and 'pin' not in j['cfg'], '備份含照片、不含密碼')

        # LINE 分享 → 長輩手機（新的瀏覽器資料）
        share = await pg.evaluate('window._bdp.shareUrl()')
        check('#c=' in share and 'data:image' not in share, '分享連結不含照片')
        await pg.click('[data-act=exitEdit]')
        ctx2 = await b.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
        el = await ctx2.new_page(); watch(el)
        await el.goto(share); await ready(el)
        check(await el.is_visible('#modal.show') and '2 位' in await el.text_content('#modalBox') and '使用警語' not in await el.text_content('#modalBox'), '長輩打開連結：問要不要加入 2 位（不先跳警語）')
        await el.click('[data-act=importOk]')
        L = await el.evaluate('window._bdp.LIST')
        check(len(L) == 2 and L[1]['tels'][1]['n'] == '0223456789,88' and not await el.evaluate('window._bdp.CFG.example'), '加入後取代範例、分機保留')
        check('#c=' not in el.url, '網址列清掉分享碼')
        await el.goto(share); await ready(el); await el.click('[data-act=importOk]')
        check(await el.evaluate('window._bdp.LIST.length') == 2, '同一個連結再開一次不會重複')
        # 還原備份（含照片）
        await el.click('.cover [data-act=settings]'); await hold(el, 2300)
        await el.set_input_files('#restoreIn', bk); await el.wait_for_timeout(300)
        await el.click('[data-act=restoreMerge]')
        L = await el.evaluate('window._bdp.LIST')
        check(len(L) == 2 and L[0]['photo'].startswith('data:image'), '還原「加進目前的」：合併並補上照片')
        await el.click('[data-act=exitEdit]')
        ow = await el.evaluate('document.documentElement.scrollWidth')
        check(ow <= 391, '390px 手機沒有橫向捲動（%d）' % ow)
        await el.screenshot(path=os.path.join(OUT, 'mobile_home.png'), full_page=True)
        await el.click('.card >> nth=0')
        await el.screenshot(path=os.path.join(OUT, 'mobile_call.png'))
        await ctx2.close()

        m = await ctx.new_page(); watch(m)
        await m.set_viewport_size({'width': 375, 'height': 800})
        await m.goto(BASE); await ready(m)
        check(await m.evaluate('document.documentElement.scrollWidth') <= 376, '375px 沒有橫向捲動')
        check(await m.evaluate('window._bdp.CFG.hideEmg') == ['e113'], '隱藏的專線記住了')
        await m.click('[data-tab=emg]')
        check(await m.locator('#page .card.emg').count() == 6, '隱藏 113 後緊急分頁剩 6 支')
        await m.close()
        check(not errs, '沒有 console 錯誤 ' + str(errs[:3]))
        await b.close()
    print('\n%s %d 項失敗' % ('✗' if fails else '✓', len(fails)))
    sys.exit(1 if fails else 0)
asyncio.run(main())
