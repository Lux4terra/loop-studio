# Loop Studio · the screens, in a real browser: setting up and signing in, Home, each module slot opening (and loading
# only then), Back and the browser's back, the notification centre, Appearance and Settings, phone and laptop widths,
# light and dark, the translation layer, contrast, and the app working offline once installed.
import asyncio, json, re
from harness import *
from playwright.async_api import async_playwright

SH = shots_dir("ui")
V = re.search(r'export const V = "(\w+)"', open(REPO + "/api/_core/registry.gen.js").read()).group(1)
MODS = ["today", "briefs", "builds", "library"]; NAMES = {"today": "Today", "briefs": "Briefs", "builds": "Builds", "library": "Library"}
STRINGS = json.load(open(REPO + "/dev/i18n/strings.json"))
async def shot(pg, n, full=False): await pg.wait_for_timeout(350); await pg.screenshot(path=SH + "/" + n + ".png", full_page=full)
async def overflow(pg): return await pg.evaluate("document.scrollingElement.scrollWidth - innerWidth")
async def view(pg): return await pg.evaluate("G.view")

async def main():
    mock({"reset": True})
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---------- first run: set up with the studio key ----------
        pg = await page_for(b, None, wait="#login form")
        ok("a first visit offers set-up with the studio key", await pg.locator("form[data-form=setup] input[name=key]").count() == 1 and await pg.locator("input[name=pass2]").count() == 1, await pg.inner_text("#login"))
        await shot(pg, "phone_setup")
        await pg.fill("input[name=key]", "not-the-right-key-000"); await pg.fill("input[name=name]", NAME); await pg.fill("input[name=pass]", PASS); await pg.fill("input[name=pass2]", PASS)
        await pg.click("button[type=submit]"); await pg.wait_for_function("() => document.getElementById('lErr').textContent.length>0", timeout=8000)
        ok("a wrong key is said plainly", "studio key is not right" in await pg.inner_text("#lErr"), await pg.inner_text("#lErr"))
        await pg.fill("input[name=key]", KEY); await pg.fill("input[name=pass2]", PASS + "x"); await pg.click("button[type=submit]")
        ok("two different passcodes are caught before sending", "differ" in await pg.inner_text("#lErr"), await pg.inner_text("#lErr"))
        await pg.fill("input[name=pass2]", PASS); await pg.click("button[type=submit]"); await pg.wait_for_selector(".greet", timeout=10000)
        ok("set-up lands on Home, greeting by name", NAME in await pg.inner_text(".greet"), await pg.inner_text(".greet"))
        ok("the welcome waits behind the bell", await pg.locator("#bellBtn .dot").count() == 1, "")
        tok = await pg.evaluate("G.tok")
        # ---------- Home ----------
        apps = await pg.eval_on_selector_all("#apps .app", "a => a.map(x => x.dataset.app)")
        ok("Home shows the four modules, then Appearance and Settings", apps == MODS + ["look", "settings"], apps)
        ok("Home has a window for each module and one for notifications", await pg.locator("#wins .win").count() == 5, await pg.locator("#wins .win").count())
        ok("an empty module's window says so in words", "No focus set yet" in await pg.inner_text("#wins .win >> nth=0"), await pg.inner_text("#wins .win >> nth=0"))
        dock = await pg.eval_on_selector_all("#dock button", "a => a.map(x => x.textContent.trim())")
        ok("the dock holds Home and the four modules", dock == ["Home", "Today", "Briefs", "Builds", "Library"], dock)
        names = await pg.eval_on_selector_all("#main button, #bar button, #dock button", "a => a.filter(x => !(x.getAttribute('aria-label') || x.textContent.trim())).length")
        ok("every button has a name a screen reader can read", names == 0, names)
        loaded = await pg.evaluate("[...document.scripts].map(s => s.src).filter(s => s.includes('/m/'))")
        ok("no module's screen loads before its app opens", loaded == [], loaded)
        await shot(pg, "phone_home")
        # ---------- each slot ----------
        for m in MODS:
            await pg.click("#apps [data-app=%s]" % m); await pg.wait_for_selector("#contract", timeout=8000)
            title = await pg.inner_text("#lt span"); h = await pg.evaluate("location.hash")
            ok(m + ": opens from Home with its own screen and contract", title == NAMES[m] and h == "#/" + m and "studio/%s/" % m in await pg.inner_text("#contract"), (title, h))
            ok(m + ": its screen loaded when it opened", await pg.evaluate("[...document.scripts].some(s => s.src.includes('/m/%s.js?v=%s'))" % (m, V)), "")
            ok(m + ": its dock button shows where you are", await pg.evaluate("document.querySelector('#dock button.on').dataset.v") == m, "")
            ok(m + ": nothing spills sideways on a phone", await overflow(pg) <= 0, await overflow(pg))
            await shot(pg, "phone_" + m, True)
            await pg.click("#lt .back"); await pg.wait_for_selector(".greet")
            ok(m + ": Back returns Home", await view(pg) == "" and await pg.evaluate("location.hash") == "", await view(pg))
        n = await pg.evaluate("[...document.scripts].filter(s => s.src.includes('/m/')).length")
        ok("each screen loads once, however often it opens", n == 4, n)
        # the browser's back takes the same path, through the dock as well
        await pg.click("#dock [data-v=builds]"); await pg.wait_for_selector("#contract"); await pg.click("#dock [data-v=library]"); await pg.wait_for_selector("#contract")
        await pg.go_back(); await pg.wait_for_timeout(400); v1 = await view(pg); await pg.go_back(); await pg.wait_for_timeout(400); v2 = await view(pg)
        ok("the browser's back steps through the apps you opened, then Home", v1 == "builds" and v2 == "", (v1, v2))
        await pg.go_forward(); await pg.wait_for_timeout(400); ok("and forward again", await view(pg) == "builds", await view(pg))
        await pg.click("#lt .back"); await pg.wait_for_selector(".greet")
        # ---------- the notification centre ----------
        await pg.click("#bellBtn"); await pg.wait_for_selector("#sheet.ncs.on"); await pg.wait_for_timeout(500)
        box = await pg.locator("#sheet").bounding_box()
        ok("the notification centre drops from the top", box and box["y"] <= 1, box)
        ok("it opens on what is there: the welcome, under Updates", "Studio is ready" in await pg.inner_text("#shB") and "Updates" in await pg.inner_text("#shB .seg .on"), await pg.inner_text("#shB"))
        ok("its groups are named by the app they come from", await pg.locator("#shB .ncg").count() == 1 and "Studio" in await pg.inner_text("#shB .ncgh"), await pg.inner_text("#shB"))
        await shot(pg, "phone_bell")
        await pg.wait_for_function("() => !document.querySelector('#bellBtn .dot')", timeout=5000)
        ok("opening it marks the notices seen", F("studio/account.json").get("seenAt"), "")
        await pg.go_back(); await pg.wait_for_timeout(500)
        ok("the browser's back closes it and stays in Studio", await pg.evaluate("!document.getElementById('sheet').classList.contains('on')") and await view(pg) == "" and pg.url.startswith(APP), pg.url)
        await pg.click("#bellBtn"); await pg.wait_for_selector("#sheet.on"); await pg.click("#shX"); await pg.wait_for_timeout(450)
        ok("the close button puts it away", await pg.evaluate("!document.getElementById('sheet').classList.contains('on')"), "")
        await pg.click("#bellBtn"); await pg.wait_for_selector("#sheet.on"); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(450)
        ok("Escape puts it away", await pg.evaluate("!document.getElementById('sheet').classList.contains('on')"), "")
        # ---------- Appearance ----------
        await pg.click("#apps [data-app=look]"); await pg.wait_for_selector(".lkprev")
        await shot(pg, "phone_look", True)
        await pg.click("[data-act=theme][data-v=dark]"); await pg.wait_for_timeout(500)
        ok("choosing Dark turns Studio dark at once", await pg.evaluate("document.documentElement.dataset.theme") == "dark" and await pg.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(15, 15, 17)", await pg.evaluate("getComputedStyle(document.body).backgroundColor"))
        await pg.wait_for_function("() => 1", timeout=1000); await pg.wait_for_timeout(600)
        ok("the look is saved to Studio's records", (F("studio/account.json").get("look") or {}).get("theme") == "dark", F("studio/account.json").get("look"))
        opts = await pg.evaluate("cssVar('--accent-options').split(/\\s+/)")
        await pg.click("[data-act=accent][data-v='%s']" % opts[3]); await pg.wait_for_timeout(500)
        ok("an accent from the tokens applies", await pg.evaluate("document.documentElement.style.getPropertyValue('--accent')") == opts[3], opts[3])
        await pg.click("[data-act=icons][data-v=quiet]"); await pg.click("[data-act=wall][data-v=dusk]"); await pg.click("[data-act=glass][data-v='2']"); await pg.wait_for_timeout(600)
        await shot(pg, "phone_look_dark", True)
        await pg.click("#dock [data-v='']"); await pg.wait_for_selector(".greet")
        ok("Home follows the look: quiet icons, the wallpaper, clearer windows", await pg.locator(".st-quiet #apps").count() == 1 and "wall-dusk" in await pg.evaluate("document.getElementById('wall').style.background") and await pg.evaluate("document.body.dataset.glass") == "2", "")
        await shot(pg, "phone_home_dark_dusk")
        await pg.reload(); await pg.wait_for_selector(".greet")
        ok("the look holds after a reload", await pg.evaluate("document.documentElement.dataset.theme") == "dark" and await pg.locator(".st-quiet").count() == 1, "")
        # ---------- Settings ----------
        await pg.click("#apps [data-app=settings]"); await pg.wait_for_selector("#ver")
        ok("Settings shows the version Studio runs", await pg.inner_text("#ver") == V, await pg.inner_text("#ver"))
        ok("Settings says how to add Studio to the Home Screen", "Home Screen" in await pg.inner_text("#main"), "")
        await pg.click("[data-act=fs][data-v=xl]"); await pg.click("[data-act=tf][data-v='12']"); await pg.wait_for_timeout(500)
        ok("larger text applies at once", await pg.evaluate("document.documentElement.dataset.fs") == "xl" and await pg.evaluate("getComputedStyle(document.documentElement).fontSize") == "20px", await pg.evaluate("getComputedStyle(document.documentElement).fontSize"))
        await shot(pg, "phone_settings_dark", True)
        await pg.click("[data-act=fs][data-v=m]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=nameEdit]"); await pg.wait_for_selector("form[data-form=name]"); await pg.fill("form[data-form=name] input", "Eliya N."); await pg.click("form[data-form=name] button[type=submit]"); await pg.wait_for_timeout(700)
        ok("the name is changed from Settings", F("studio/account.json")["name"] == "Eliya N." and "Eliya N." in await pg.inner_text("#main"), F("studio/account.json")["name"])
        ok("no page errors on the phone", not pg.errs, pg.errs[:5])
        ok("the phone reached nothing outside Studio", not pg.outside, pg.outside[:5])
        await pg.click("[data-act=signout]"); await pg.wait_for_selector("form[data-form=login]")
        ok("signing out returns to sign-in, with nothing kept", await pg.evaluate("!localStorage.getItem('loop_studio_boot') && !JSON.parse(localStorage.getItem('loop_studio')).tok"), "")
        # ---------- signing in ----------
        await pg.fill("input[name=pass]", "wrong-pass-000"); await pg.click("button[type=submit]"); await pg.wait_for_function("() => document.getElementById('lErr').textContent.length>0", timeout=8000)
        ok("a wrong passcode is said plainly", "passcode is not right" in await pg.inner_text("#lErr"), await pg.inner_text("#lErr"))
        await pg.fill("input[name=pass]", PASS); await pg.click("button[type=submit]"); await pg.wait_for_selector(".greet", timeout=10000)
        ok("the passcode signs in", "Eliya" in await pg.inner_text(".greet"), "")
        await pg.close()
        # reset to the default look for the remaining pages
        call("me", {"look": {"theme": "auto", "accent": "", "icons": "sig", "wall": None, "glass": 1}, "display": {"fs": "m", "tf": "24"}}, tok=tok)

        # ---------- a link straight to an app ----------
        ctx = await b.new_context(**PHONE, service_workers="block"); await ctx.add_init_script('localStorage.setItem("loop_studio",JSON.stringify({tok:%s}))' % json.dumps(tok))
        pl = await ctx.new_page(); await pl.goto(APP + "#/builds"); await pl.wait_for_selector("#contract", timeout=10000)
        ok("a link to an app opens that app", await view(pl) == "builds", await view(pl))
        await pl.click("#lt .back"); await pl.wait_for_selector(".greet"); ok("and Back from there goes Home", await view(pl) == "", "")
        await ctx.close()

        # ---------- widths, light and dark ----------
        for label, dev, scheme in [("small", SMALL, "light"), ("phone_dark", PHONE, "dark"), ("laptop", LAPTOP, "light"), ("laptop_dark", LAPTOP, "dark")]:
            pg = await page_for(b, tok, dev=dev, scheme=scheme)
            await shot(pg, label + "_home")
            ok(label + ": Home fits the width", await overflow(pg) <= 0, await overflow(pg))
            bg = await pg.evaluate("getComputedStyle(document.body).backgroundColor")
            ok(label + ": the theme follows the device (" + scheme + ")", (bg == "rgb(15, 15, 17)") == (scheme == "dark"), bg)
            con = await pg.evaluate("[contrast(cssVar('--text'), cssVar('--bg')), contrast(cssVar('--text-2'), cssVar('--surface')), contrast(cssVar('--accent'), cssVar('--surface')), contrast(cssVar('--accent-ink'), cssVar('--accent'))]")
            ok(label + ": text reads clearly (4.5:1 and up) and the accent stands out (3:1)", con[0] >= 7 and con[1] >= 4.5 and con[2] >= 3 and con[3] >= 4.5, con)
            for m in MODS:
                await pg.click("#apps [data-app=%s]" % m); await pg.wait_for_selector("#contract")
                ok(label + ": " + m + " fits the width", await overflow(pg) <= 0, await overflow(pg))
                if m == "today": await shot(pg, label + "_today", True)
                await pg.click("#lt .back"); await pg.wait_for_selector(".greet")
            if dev is LAPTOP:
                cols = await pg.evaluate("getComputedStyle(document.getElementById('apps')).gridTemplateColumns.split(' ').length")
                ok(label + ": apps sit eight to a row and the windows side by side", cols == 8 and await pg.evaluate("getComputedStyle(document.getElementById('wins')).display") == "grid", cols)
                ok(label + ": the page widens to 1,160 px", await pg.evaluate("document.getElementById('main').getBoundingClientRect().width") == 1160, await pg.evaluate("document.getElementById('main').getBoundingClientRect().width"))
                await pg.click("#bellBtn"); await pg.wait_for_selector("#sheet.ncs.on"); await pg.wait_for_timeout(500); box = await pg.locator("#sheet").bounding_box()
                ok(label + ": notifications open at the top right", box["x"] > 900 and box["y"] < 40, box)
                await shot(pg, label + "_bell")
            ok(label + ": no page errors", not pg.errs, pg.errs[:4])
            await pg.context.close()

        # ---------- the translation layer ----------
        pg = await page_for(b, tok)
        await pg.evaluate("S => { L.xx = Object.fromEntries(S.map(s => [s, '‹' + s + '›'])); LANGS.push(['xx', 'Test']); G.lang = 'xx'; render(); }", STRINGS)
        allow = {"Loop Studio", "Eliya", "Eliya N.", V, "English", "Test"}
        js = """([allow, skip]) => { const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (w.nextNode()) { const n = w.currentNode, s = n.textContent.trim(), p = n.parentElement;
            if (!s || !/[A-Za-z]{2,}/.test(s) || s.includes('‹') || !p || p.closest('.mono, .own, #ver, #av, svg, script, style, [hidden], #toast, ' + skip) || allow.includes(s.replace(/^[,\\s]+/, ''))) continue;
            if (p.closest('#sheet') && !document.getElementById('sheet').classList.contains('on')) continue;
            out.push(s.slice(0, 60)); } return out; }"""
        left = []
        for v in [""] + MODS + ["look", "settings"]:
            await pg.evaluate("v => { G.view = v; render(); }", v); await pg.wait_for_timeout(500)
            if v in MODS: await pg.wait_for_selector("#contract")
            left += [v + ": " + x for x in await pg.evaluate(js, [list(allow), "#login"])]
        await pg.evaluate("G.view=''; render(); bellOpen()"); await pg.wait_for_timeout(500); left += ["bell: " + x for x in await pg.evaluate(js, [list(allow), "#login"])]
        await shot(pg, "phone_translated")
        await pg.context.close()
        pg = await page_for(b, None, wait="#login form")
        for mode in ["login", "setup"]:
            await pg.evaluate("([S, m]) => { L.xx = Object.fromEntries(S.map(s => [s, '‹' + s + '›'])); if (!LANGS.some(l => l[0] === 'xx')) LANGS.push(['xx', 'Test']); G.lang = 'xx'; G.loginMode = m; renderLogin(); }", [STRINGS, mode]); await pg.wait_for_timeout(300)
            left += [mode + ": " + x for x in await pg.evaluate(js, [list(allow), "#bar, #main, #dock"])]
        ok("every word on every screen passes through the translation layer", not left, left[:12])
        await pg.context.close()

        # ---------- installed: works offline ----------
        ctx = await b.new_context(**PHONE, service_workers="allow"); await ctx.add_init_script('if(!localStorage.getItem("loop_studio"))localStorage.setItem("loop_studio",JSON.stringify({tok:%s}))' % json.dumps(tok))
        po = await ctx.new_page(); await po.goto(APP); await po.wait_for_selector(".greet")
        await po.wait_for_function("() => navigator.serviceWorker && navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true)", timeout=10000)
        await po.wait_for_timeout(1500)
        keys = await po.evaluate("caches.keys()")
        ok("the service worker keeps this version of Studio", ("loop-studio-" + V) in keys, keys)
        await ctx.set_offline(True); await po.reload(); await po.wait_for_selector(".greet", timeout=10000); await po.wait_for_timeout(800)
        ok("offline, Studio still opens, with what it last loaded", "Offline" in await po.inner_text("#main") and await po.locator("#apps .app").count() == 6, await po.inner_text("#main"))
        await shot(po, "phone_offline")
        await ctx.set_offline(False); await ctx.close()
        await b.close()
    summary()

asyncio.run(main())
