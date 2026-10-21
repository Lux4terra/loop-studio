# Loop Studio · build 2's proof of done, walked in a real browser on a phone: a focus set in a tap and changed in a
# tap; a focus session that survives a reload and logs itself once it ends; the brief for Build 3 written, passed
# through its gate and exported as a session pack in one tap; sent to build with a tap; then seen in Today's queue and
# in the morning briefing. Around it: the PRD drafted and reviewed (and the key it needs named when missing), the
# queue dragged and nudged, undo, the screens at 360, 390 and 1,440 px in light and dark, and every word through the
# translation layer.
import asyncio, datetime, json, re
from harness import *
from playwright.async_api import async_playwright

SH = shots_dir("flows")
STRINGS = json.load(open(REPO + "/dev/i18n/strings.json"))
DAY = datetime.date.today().isoformat(); Q = "&day=" + DAY
CLIP = ["clipboard-read", "clipboard-write"]
NOTES = """Builds tracked side by side, each on its own branch.

Problem: Three or four builds run at once and nothing shows where each stands.
User: The studio lead, on a phone between sessions.
Proof of done:
- Three builds tracked at once, each with its branch, last commit and suite status.
- A smoke suite runs on GitHub Actions at every push.
Limits:
- Write a session pack from a brief (do)
- Read commits and test results from GitHub (do)
- Merge a build to main (raise)
Repos:
- Lux4terra/loop-studio, push access
- Lux4terra/loop-data, push access
Read first: claude/loop-studio-round-2.md"""

async def shot(pg, n, full=True): await pg.wait_for_timeout(300); await pg.screenshot(path=SH + "/" + n + ".png", full_page=full)
async def overflow(pg): return await pg.evaluate("document.scrollingElement.scrollWidth - innerWidth")
async def toast_has(pg, s): await pg.wait_for_function("s => document.getElementById('toast').classList.contains('on') && document.getElementById('toast').textContent.includes(s)", arg=s, timeout=8000); return True
async def sheet(pg): await pg.wait_for_selector("#sheet.on", timeout=8000); await pg.wait_for_timeout(420)
async def unnamed(pg): return await pg.eval_on_selector_all("#main button, #shB button", "a => a.filter(x => x.offsetParent && !(x.getAttribute('aria-label') || x.textContent.trim())).map(x => x.outerHTML.slice(0, 80))")
day = lambda: F("studio/today/day.json")["days"].get(DAY, {})
briefs = lambda: F("studio/briefs/briefs.json")["list"]

SWEEP = """([allow, skip]) => { const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode, s = n.textContent.trim(), p = n.parentElement;
    if (!s || !/[A-Za-z]{2,}/.test(s) || s.includes('‹') || s.includes('›') || !p || p.closest('.mono, .own, #ver, #av, svg, script, style, [hidden], #toast, ' + skip) || allow.includes(s)) continue;
    if (p.closest('#sheet') && !document.getElementById('sheet').classList.contains('on')) continue;
    out.push(s.slice(0, 60)); } return out; }"""

async def main():
    tok = setup()
    mock({"put": {"path": "studio/library/items.json", "data": {"v": 1, "items": [
        {"id": "i_b1_13", "kind": "Prompt", "name": "Build session pack", "purpose": "Repos with their access, what to build, how, the proof of done, and how to close.", "example": "Build 1 pack", "at": "2026-10-20"},
        {"id": "i_b1_03", "kind": "Tool", "name": "Local mock of Vercel and GitHub", "purpose": "Every suite runs offline and fast.", "example": "dev/tests/devserver.mjs", "at": "2026-10-20"}]}}})
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await page_for(b, tok, perms=CLIP)
        # ---------- 1. a focus, set and changed in a tap ----------
        await pg.click("#dock [data-v=today]"); await pg.wait_for_selector("#focus")
        ok("Today opens on its briefing, the focus, the timer and the queue", await pg.locator("#briefing").count() == 1 and await pg.locator("#fIn").count() == 1 and await pg.locator("#tmStart").count() == 1 and await pg.locator("#queue").count() == 1, "")
        await shot(pg, "phone_today_empty")
        await pg.fill("#fIn", "Ship Today and Briefs"); await pg.press("#fIn", "Enter")
        await pg.wait_for_selector("button#focus .ft")
        ok("a focus is set from the field and saved to the day", await pg.inner_text("#focus .ft") == "Ship Today and Briefs" and day().get("focus") == "Ship Today and Briefs", day())
        ok("setting it offers an undo", await toast_has(pg, "Focus set") and await pg.locator("#toast .tact").count() == 1, "")
        await pg.click("button#focus"); await pg.wait_for_selector("#fIn")
        ok("a tap on the focus opens it to change, with the cursor in it", await pg.evaluate("document.activeElement.id") == "fIn" and await pg.input_value("#fIn") == "Ship Today and Briefs", "")
        await pg.fill("#fIn", "Ship the Studio MVP"); await pg.click("#focus button[type=submit]"); await pg.wait_for_selector("button#focus .ft")
        ok("and a second tap saves the change", day().get("focus") == "Ship the Studio MVP", day())
        await pg.click("#toast .tact"); await pg.wait_for_function("() => document.querySelector('#focus .ft') && document.querySelector('#focus .ft').textContent === 'Ship Today and Briefs'", timeout=8000)
        ok("Undo puts the earlier focus back", day().get("focus") == "Ship Today and Briefs", day())

        # ---------- 2. a focus session that survives a reload ----------
        await pg.click("[data-mact=len][data-v='50']"); await pg.click("#tmStart"); await pg.wait_for_selector("#tmLeft")
        t1 = await pg.inner_text("#tmLeft"); await pg.wait_for_timeout(2200); t2 = await pg.inner_text("#tmLeft")
        ok("a 50-minute session starts and counts down", (t1.startswith("50:") or t1.startswith("49:")) and t2 < t1, (t1, t2))
        kept = await pg.evaluate("JSON.parse(localStorage.getItem('loop_studio_m_today'))")
        ok("the timer runs on this device", kept["timer"]["min"] == 50 and kept["timer"]["day"] == DAY and "timer" not in json.dumps(F("studio/today/day.json")), kept)
        await shot(pg, "phone_today_timer")
        await pg.reload(); await pg.wait_for_selector("#tmLeft", timeout=10000)
        t3 = await pg.inner_text("#tmLeft")
        ok("after a reload Studio returns to Today with the session still running", t3.startswith("49:") and await pg.evaluate("G.view") == "today", t3)
        await pg.evaluate("() => { const k = 'loop_studio_m_today', o = JSON.parse(localStorage.getItem(k)); o.timer.start = Date.now() - 51 * 60e3; localStorage.setItem(k, JSON.stringify(o)); }")
        await pg.reload(); await pg.wait_for_function("() => document.getElementById('tmStart')", timeout=10000)
        await pg.wait_for_function("() => /One session/.test(document.getElementById('tmSum').textContent)", timeout=8000)
        S = day().get("sessions", [])
        ok("a session that ended while Studio was closed is logged to the day, once", len(S) == 1 and S[0]["min"] == 50 and not (await pg.evaluate("JSON.parse(localStorage.getItem('loop_studio_m_today'))")).get("timer"), S)
        await pg.reload(); await pg.wait_for_selector("#tmStart"); await pg.wait_for_timeout(600)
        ok("and a reload afterwards logs nothing more", len(day().get("sessions", [])) == 1, "")
        await pg.click("#tmStart"); await pg.wait_for_selector("#tmLeft"); await pg.click("[data-mact=stop]"); await pg.wait_for_selector("#tmStart")
        ok("stopping a session logs nothing and offers an undo", await toast_has(pg, "nothing logged") and len(day()["sessions"]) == 1, "")
        await pg.click("#toast .tact"); await pg.wait_for_selector("#tmLeft")
        ok("Undo starts the stopped session again", await pg.locator("#tmLeft").count() == 1, "")
        await pg.click("[data-mact=stop]"); await pg.wait_for_selector("#tmStart")

        # ---------- 3. the brief for Build 3, through its gate ----------
        await pg.click("#dock [data-v=briefs]"); await pg.wait_for_selector("#contract")
        await pg.click("#lt .add"); await sheet(pg)
        await pg.fill("form[data-mform=new] input", "Build 3 · Builds"); await pg.click("form[data-mform=new] button[type=submit]")
        await pg.wait_for_selector("#gate"); bid = (await pg.evaluate("location.hash")).split("/")[-1]
        ok("a new brief opens at its own address, as a draft with its gate unmet", bid.startswith("b_") and await pg.inner_text("#lt .own") == "Build 3 · Builds" and await pg.locator("#gate [data-v=ready][disabled]").count() == 1, bid)
        ok("drafting the PRD with no key set names the key it needs", "GEMINI_API_KEY" in await pg.inner_text("#prdBtn"), await pg.inner_text("#prdBtn"))
        await pg.click("button.card[data-k=notes]"); await sheet(pg); await pg.fill("form[data-mform=field] textarea", NOTES); await pg.click("form[data-mform=field] button[type=submit]")
        await pg.wait_for_function("() => /Builds tracked side by side/.test(document.querySelector('button.card[data-k=notes]').textContent)", timeout=8000)
        await pg.click("[data-mact=fill]"); await pg.wait_for_function("() => document.querySelectorAll('[data-k=proof].row').length === 2", timeout=8000)
        B = [x for x in briefs() if x["id"] == bid][0]
        ok("Fill fields from notes reads the problem, the user, the checks, the levels, the repos and what to read", B["problem"].startswith("Three or four builds") and len(B["proof"]) == 2 and [x["lv"] for x in B["limits"]] == ["do", "do", "raise"] and len(B["repos"]) == 2 and B["read"][0]["t"] == "claude/loop-studio-round-2.md", B)
        ok("filling offers an undo", await toast_has(pg, "Filled 6 fields"), "")
        await pg.click("[data-mact=line][data-k=proof]"); await sheet(pg)
        await pg.fill("form[data-mform=line] textarea", "Every suite passes on the exact commit before main."); await pg.click("form[data-mform=line] button[type=submit]")
        await pg.wait_for_function("() => document.querySelectorAll('[data-k=proof].row').length === 3", timeout=8000)
        ok("a check is added from its own sheet", len([x for x in briefs() if x["id"] == bid][0]["proof"]) == 3, "")
        await pg.click("[data-mact=line][data-k=limits]"); await sheet(pg)
        await pg.fill("form[data-mform=line] textarea", "Draft each session's next step"); await pg.click("form[data-mform=line] button[type=submit]")
        await pg.wait_for_function("() => document.querySelectorAll('.lrow').length === 4", timeout=8000)
        ok("an action added without a level holds the gate shut, and says so", await pg.locator("#gate [data-v=ready][disabled]").count() == 1 and "1 without one" in await pg.inner_text("#gate"), await pg.inner_text("#gate"))
        await pg.click(".lrow.need [data-mact=lv][data-v=prepare]"); await pg.wait_for_selector("#gate [data-v=ready]:not([disabled])")
        ok("a level set in a tap opens the gate", [x for x in briefs() if x["id"] == bid][0]["limits"][3]["lv"] == "prepare", "")
        await pg.click("[data-mact=lib]"); await sheet(pg); await pg.wait_for_selector("#libList")
        await pg.fill("#libQ", "pack"); await pg.wait_for_function("() => document.querySelectorAll('#libList .row').length === 1", timeout=5000)
        await pg.click("#libList [data-mact=libPick]"); await pg.wait_for_function("() => document.querySelector('#libList [aria-pressed=true]')", timeout=8000)
        ok("a Library item is found by search and taken into the brief", [x for x in briefs() if x["id"] == bid][0]["reuse"] == ["i_b1_13"], "")
        await shot(pg, "phone_brief_library", False)
        await pg.click("#shX"); await pg.wait_for_timeout(450)
        ok("the brief names the item it reuses", "Build session pack" in await pg.inner_text("#main"), "")
        await shot(pg, "phone_brief_draft")
        # the PRD: prepared for review once a key is set
        mock({"aiKeys": True}); await pg.reload(); await pg.wait_for_selector("#gate")
        ok("with keys set, the button drafts", (await pg.inner_text("#prdBtn")).strip() == "Draft the PRD", await pg.inner_text("#prdBtn"))
        await pg.click("#prdBtn"); await pg.wait_for_selector("#prdDraft", timeout=15000)
        ok("the PRD draft waits on the brief for review, marked as prepared", "prepare" in (await pg.inner_text("#prdDraft")).lower() and [x for x in briefs() if x["id"] == bid][0]["prd"] is None, "")
        ok("names never left: the account's name is kept out of the prompt", "Eliya" not in json.dumps(mock()["ai"]), "")
        await shot(pg, "phone_brief_prd")
        await pg.click("[data-mact=prdAccept]"); await pg.wait_for_function("() => !document.getElementById('prdDraft')", timeout=8000)
        ok("accepting puts the PRD in the brief", [x for x in briefs() if x["id"] == bid][0]["prd"]["text"].startswith("### Summary"), "")
        # ready
        await pg.click("#gate [data-v=ready]"); await pg.wait_for_selector("#packBtn")
        ok("the brief passes its gate and is marked ready", [x for x in briefs() if x["id"] == bid][0]["st"] == "ready", "")

        # ---------- 4. the session pack in one tap ----------
        await pg.click("#packBtn"); await sheet(pg); await pg.wait_for_selector("#packTxt")
        clip = await pg.evaluate("navigator.clipboard.readText()")
        heads = re.findall(r"^#{1,2} .*$", clip, re.M)
        ok("one tap exports the session pack and copies it", heads == ["# Build 3 · Builds", "## Read first", "## Repos", "## What to build", "## How", "## Proof of done", "## Close"] and "version 1" in clip, heads)
        ok("the pack is shown, says it was copied, and is kept as version 1 on the brief", "Copied" in await pg.inner_text("#packSt") and (await pg.inner_text("#packTxt")).strip() == clip.strip() and [x["v"] for x in [y for y in briefs() if y["id"] == bid][0]["packs"]] == [1], await pg.inner_text("#packSt"))
        ok("the pack carries the brief's repos, levels, Library item and checks", "`Lux4terra/loop-studio`, push access." in clip and "Merge a build to main: raise" in clip and "Build session pack (Prompt)" in clip and "1. Three builds tracked at once" in clip, clip[:300])
        await shot(pg, "phone_pack", False)

        # ---------- 5. sent to build with a tap ----------
        n0 = len(mock()["commits"])
        await pg.click("#shB [data-mact=sendAsk]"); await sheet(pg)
        ok("sending asks first, saying what it does, and changes nothing yet", "raise" in (await pg.inner_text("#shB .raise")).lower() and "Today's queue" in await pg.inner_text("#shB") and len(mock()["commits"]) == n0, await pg.inner_text("#shB"))
        await shot(pg, "phone_send", False)
        await pg.click("#sendGo"); await toast_has(pg, "Sent to build")
        B = [x for x in briefs() if x["id"] == bid][0]
        ok("the tap sends it: the brief is sent, with its pack", B["st"] == "sent" and B["packs"][-1].get("sent"), B["st"])
        await pg.wait_for_selector("#gate .bst-sent")

        # ---------- 6. Today's queue, and the morning briefing ----------
        await pg.click("#dock [data-v=today]"); await pg.wait_for_selector("#queue .qrow")
        ok("the brief waits in Today's queue", "Build 3 · Builds" in await pg.inner_text("#queue"), await pg.inner_text("#queue"))
        ok("and the briefing names it", "Build 3 · Builds" in await pg.inner_text("#briefing") and "Ship Today and Briefs" in await pg.inner_text("#briefing"), await pg.inner_text("#briefing"))
        await shot(pg, "phone_today_proof")
        await pg.click("#queue [data-mact=qopen]"); await pg.wait_for_selector("#gate")
        ok("a queue item opens its brief", await pg.evaluate("location.hash") == "#/briefs/" + bid, await pg.evaluate("location.hash"))
        await pg.go_back(); await pg.wait_for_selector("#queue")
        ok("and Back returns to Today", await pg.evaluate("G.view") == "today", "")
        await pg.click("#dock [data-v='']"); await pg.wait_for_selector(".greet")
        await pg.wait_for_function("() => /1 waiting in the queue/.test(document.querySelector('#wins .win').innerText)", timeout=6000)
        ok("Home's Today window leads with the focus, with the queue below", "Ship Today and Briefs" in await pg.inner_text("#wins .win >> nth=0") and "1 waiting in the queue" in await pg.inner_text("#wins .win >> nth=0"), await pg.inner_text("#wins .win >> nth=0"))
        await shot(pg, "phone_home_after", False)
        await pg.click("#bellBtn"); await sheet(pg); await pg.wait_for_function("() => /Brief sent to build/.test(document.getElementById('shB').innerText)", timeout=6000)
        ok("the notification centre says it was sent, with the title as written", "Brief sent to build" in await pg.inner_text("#shB") and "Build 3 · Builds" in await pg.inner_text("#shB"), await pg.inner_text("#shB"))
        await pg.click("#shX"); await pg.wait_for_timeout(450)

        # ---------- 7. the queue: dragged, nudged, taken off ----------
        for t in ["Studio site, first version", "Library search"]:
            c, j = call("briefs", {"op": "new", "title": t}, tok=tok, q=Q); i = j["brief"]["id"]
            call("briefs", {"op": "save", "id": i, "set": {"proof": [{"t": "It works on a phone."}]}}, tok=tok, q=Q)
            call("briefs", {"op": "state", "id": i, "to": "ready"}, tok=tok, q=Q); call("briefs", {"op": "send", "id": i, "confirm": True}, tok=tok, q=Q)
        await pg.click("#dock [data-v=today]"); await pg.wait_for_selector("#queue .qrow"); await pg.reload(); await pg.wait_for_function("() => document.querySelectorAll('#queue .qrow').length === 3", timeout=10000)
        names = lambda: [x["title"] for x in F("studio/today/day.json")["queue"]]
        await pg.evaluate("document.getElementById('queue').scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(200)
        g = await pg.locator("#queue .qrow >> nth=0").locator(".grip").bounding_box(); h = (await pg.locator("#queue .qrow >> nth=0").bounding_box())["height"]
        await pg.mouse.move(g["x"] + g["width"] / 2, g["y"] + g["height"] / 2); await pg.mouse.down()
        for k in range(1, 9): await pg.mouse.move(g["x"] + g["width"] / 2, g["y"] + g["height"] / 2 + k * h * 2.1 / 8)
        await pg.mouse.up(); await pg.wait_for_function("() => document.getElementById('toast').textContent.includes('Queue ordered')", timeout=8000)
        ok("dragging by the handle moves an item down the queue", names() == ["Studio site, first version", "Library search", "Build 3 · Builds"], names())
        await pg.click("#toast .tact"); await pg.wait_for_function("() => document.querySelector('#queue .qrow .own').textContent === 'Build 3 · Builds'", timeout=8000)
        ok("Undo puts the order back", names()[0] == "Build 3 · Builds", names())
        await pg.click("#queue .qrow >> nth=2 >> [data-mact=up]"); await pg.wait_for_function("() => document.getElementById('toast').textContent.includes('Queue ordered')", timeout=8000)
        ok("a nudge moves an item one place", names() == ["Build 3 · Builds", "Library search", "Studio site, first version"], names())
        await pg.click("#queue .qrow >> nth=1 >> [data-mact=qdone]"); await toast_has(pg, "Taken off")
        ok("an item is taken off the queue, with an undo", names() == ["Build 3 · Builds", "Studio site, first version"], names())
        await pg.click("#toast .tact"); await pg.wait_for_function("() => document.querySelectorAll('#queue .qrow').length === 3", timeout=8000)
        ok("Undo returns it to its place", names()[1] == "Library search", names())
        ok("the briefing counts what waits", "3 items wait in the queue" in await pg.inner_text("#briefing"), await pg.inner_text("#briefing"))
        await pg.click("[data-mact=briefRead]"); await pg.wait_for_selector("#briefing.read")
        ok("the briefing, once read, folds to a line and stays read", day().get("read") and await pg.locator("#briefing.read").count() == 1, "")
        ok("every button on Today has a name", not await unnamed(pg), await unnamed(pg))
        await pg.click("[data-mact=earlier]"); await sheet(pg)
        ok("earlier days open in a sheet", await pg.locator("#shB").count() == 1, "")
        await pg.click("#shX"); await pg.wait_for_timeout(450)
        ok("no page errors along the way", not pg.errs, pg.errs[:5])
        ok("the phone reached nothing outside Studio", not pg.outside, pg.outside[:5])
        await pg.context.close()

        # ---------- 8. widths, light and dark ----------
        mock({"aiKeys": True})
        for label, dev, scheme in [("small", SMALL, "light"), ("phone_dark", PHONE, "dark"), ("laptop", LAPTOP, "light"), ("laptop_dark", LAPTOP, "dark")]:
            pg = await page_for(b, tok, dev=dev, scheme=scheme)
            for h2, sel, name in [("#/today", "#queue .qrow", "today"), ("#/briefs", "#contract", "briefs"), ("#/briefs/" + bid, "#gate", "brief")]:
                await pg.evaluate("h => { location.hash = h; }", h2); await pg.reload(); await pg.wait_for_selector(sel, timeout=10000)
                ok(label + ": " + name + " fits the width", await overflow(pg) <= 0, await overflow(pg))
                await shot(pg, label + "_" + name)
            ok(label + ": every button on a brief has a name", not await unnamed(pg), await unnamed(pg))
            ok(label + ": no page errors", not pg.errs, pg.errs[:4])
            await pg.context.close()

        # ---------- 9. every word through the translation layer ----------
        pg = await page_for(b, tok, perms=CLIP)
        await pg.evaluate("S => { L.xx = Object.fromEntries(S.map(s => [s, '‹' + s + '›'])); LANGS.push(['xx', 'Test']); G.lang = 'xx'; render(); }", STRINGS)
        allow = ["Loop Studio", "Gemini", "Groq"]
        left = []
        async def sweep(where): left.extend(where + ": " + x for x in await pg.evaluate(SWEEP, [allow, "#login"]))
        call("today", {"op": "focus", "text": "Ship Today and Briefs"}, tok=tok, q=Q)
        for v, sel in [("today", "#queue"), ("briefs", "#contract")]:
            await pg.evaluate("v => { G.rec = {}; nav(v); }", v); await pg.wait_for_selector(sel); await pg.wait_for_timeout(300); await sweep(v)
            if v == "today": await pg.click("#briefing"); await pg.wait_for_selector("#briefing .bl"); await sweep("today briefing")
        await pg.evaluate("id => nav('briefs', id)", bid); await pg.wait_for_selector("#gate"); await sweep("brief")
        c, j = call("briefs", {"op": "new", "title": "A draft"}, tok=tok, q=Q); d2 = j["brief"]["id"]
        call("briefs", {"op": "save", "id": d2, "set": {"notes": "A long enough note to draft from.", "limits": [{"t": "Act", "lv": ""}]}}, tok=tok, q=Q); call("briefs", {"op": "prd", "id": d2}, tok=tok, q=Q)
        await pg.evaluate("id => { G.rec = {}; nav('briefs', id); }", d2); await pg.wait_for_selector("#prdDraft"); await sweep("draft brief")
        for act, wait in [("[data-mact=line][data-k=limits]", "form"), ("[data-mact=lib]", "#libList"), ("[data-mact=cfg]", "form")]:
            if act == "[data-mact=cfg]": await pg.evaluate("nav('briefs')"); await pg.wait_for_selector("#contract")
            await pg.click(act); await sheet(pg); await pg.wait_for_selector("#shB " + wait); await sweep("sheet " + act); await pg.click("#shX"); await pg.wait_for_timeout(450)
        await pg.evaluate("id => nav('briefs', id)", bid); await pg.wait_for_selector("#gate")
        await pg.click("[data-mact=packOpen]"); await sheet(pg); await sweep("pack sheet"); await pg.click("#shX"); await pg.wait_for_timeout(450)
        await pg.evaluate("id => nav('briefs', id)", d2); await pg.wait_for_selector("#gate")
        await pg.evaluate("() => bellOpen()"); await sheet(pg); await sweep("notifications")
        await shot(pg, "phone_translated")
        ok("every word on Today, Briefs, a brief and their sheets passes through the translation layer", not left, left[:12])
        ok("no page errors in the translated screens", not pg.errs, pg.errs[:4])
        await pg.context.close()
        await b.close()
    summary()

asyncio.run(main())
