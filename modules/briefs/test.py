# Briefs · the module's own checks, run by dev/tests/m_modules.py with the shared harness (h) and its contract (C).
# Every action in the contract at its level: do acts, logs a commit and answers with its undo; prepare leaves a draft
# for a person and changes nothing else; raise is refused until a person's tap confirms it.
import datetime, re

def run(h, C):
    A = h.setup()
    R = C["routes"][0]
    DAY = datetime.date.today().isoformat(); Q = "&day=" + DAY
    post = lambda b: h.call(R, b, tok=A, q=Q)
    get = lambda: h.call(R, tok=A, q=Q)[1]
    commits = lambda: len(h.mock()["commits"])
    ok = h.ok
    tested = set()
    h.mock({"put": {"path": "studio/library/items.json", "data": {"v": 1, "items": [
        {"id": "i_b1_01", "kind": "Tool", "name": "Module contract check", "purpose": "The build refuses an incomplete contract.", "example": "dev/build.py contracts()", "at": "2026-10-20"},
        {"id": "i_b1_04", "kind": "Test", "name": "Tokens guard", "purpose": "No colour outside tokens.css.", "example": "dev/tests/b_registry.py", "at": "2026-10-20"}]}}})

    j = get()
    ok("briefs: reads its record, empty at first, with which model keys are set", j["briefs"]["list"] == [] and j["briefs"]["cfg"] == {"ai": "auto", "keepOut": []} and j["ai"] == {"gemini": False, "groq": False}, j)
    c, j = post({"op": "new", "title": " "})
    ok("briefs: a brief starts with a title", c == 400, j)
    c, j = post({"op": "new", "title": "Build 3 · Builds"}); B = j["brief"]; bid = B["id"]
    ok("briefs: a new brief is a draft with its gate unmet", c == 200 and B["st"] == "draft" and B["gate"] == {"title": True, "proof": 0, "unlevelled": 0, "actions": 0, "ok": False} and B["branchOf"] == "wip/build-3-builds", B)

    # ---------- brief.save (do) ----------
    c, j = post({"op": "save", "id": bid, "set": {"problem": "Builds run in four places at once.", "user": "The studio lead, on a phone.", "limits": [{"t": "Read commits and test results", "lv": "do"}, {"t": "Merge a build to main", "lv": "sometimes"}]}})
    L = j["brief"]["limits"]
    ok("briefs: brief.save (do) saves fields and answers with its undo", c == 200 and j["brief"]["problem"].startswith("Builds run") and j["undo"]["op"] == "save" and j["undo"]["set"]["problem"] == "", j)
    ok("briefs: an action keeps only do, prepare or raise as its level", [x["lv"] for x in L] == ["do", ""] and all(x["id"] for x in L), L)
    c, j2 = post(j["undo"])
    ok("briefs: undo restores the fields", j2["brief"]["problem"] == "" and j2["brief"]["limits"] == [], j2["brief"])
    post({"op": "save", "id": bid, "set": {"problem": "Builds run in four places at once.", "user": "The studio lead, on a phone.", "limits": L}})
    c, j = post({"op": "save", "id": bid, "set": {"repos": [{"name": "not a repo"}]}})
    ok("briefs: a repo is written as owner/name", c == 400 and "owner/name" in j["error"], j)
    c, j = post({"op": "save", "id": bid, "set": {"secret": "x"}})
    ok("briefs: an unknown field is refused", c == 400, j)
    tested.add("brief.save")

    # ---------- the ready gate ----------
    c, j = post({"op": "state", "id": bid, "to": "ready"})
    ok("briefs: ready is refused without a check in the proof of done", c == 400 and "proof of done" in j["error"], j)
    c, j = post({"op": "save", "id": bid, "set": {"proof": [{"t": "Three builds tracked at once, each with its branch, last commit and suite status."}]}})
    ok("briefs: the gate counts the checks and the actions without a level", j["brief"]["gate"]["proof"] == 1 and j["brief"]["gate"]["unlevelled"] == 1 and not j["brief"]["gate"]["ok"], j["brief"]["gate"])
    c, j = post({"op": "state", "id": bid, "to": "ready"})
    ok("briefs: ready is refused while an action has no level", c == 400, j)
    L = get()["briefs"]["list"][0]["limits"]; L[1]["lv"] = "raise"
    c, j = post({"op": "save", "id": bid, "set": {"limits": L}})
    ok("briefs: with a check and every action levelled, the gate passes", j["brief"]["gate"]["ok"], j["brief"]["gate"])
    c, j = post({"op": "state", "id": bid, "to": "ready"})
    ok("briefs: brief.ready (do) marks it ready, with its undo", c == 200 and j["brief"]["st"] == "ready" and j["undo"] == {"op": "state", "id": bid, "to": "draft"}, j)
    c, j = post(j["undo"]); ok("briefs: undo returns it to draft", j["brief"]["st"] == "draft", j["brief"]["st"])
    post({"op": "state", "id": bid, "to": "ready"})
    c, j = post({"op": "save", "id": bid, "set": {"proof": []}})
    ok("briefs: a ready brief whose gate breaks goes back to draft, and says so", j["brief"]["st"] == "draft" and j["fell"], j["brief"]["st"])
    post(j["undo"]); c, j = post({"op": "state", "id": bid, "to": "ready"})
    ok("briefs: and is ready again once the gate holds", j["brief"]["st"] == "ready", j["brief"]["st"])
    tested.add("brief.ready")

    # ---------- fill from notes (do, part of brief.save) ----------
    c, j = post({"op": "new", "title": "From notes"}); fid = j["brief"]["id"]
    notes = "An idea first.\n\nProblem: Briefs take too long on a phone.\nUser: the studio lead\n## Proof of done\n- A brief exported in one tap\n- Every suite passes\nLimits:\n- Save a brief (do)\n- Send to build — raise\nprepare: draft the PRD\nRepos:\n- Lux4terra/loop-studio, push access\n- Lux4terra/loop-data, read-only\nRead first: the round note"
    post({"op": "save", "id": fid, "set": {"notes": notes}})
    c, j = post({"op": "fill", "id": fid}); F = j["brief"]
    ok("briefs: filling from notes reads the headings as written", F["problem"] == "Briefs take too long on a phone." and F["user"] == "the studio lead" and [x["t"] for x in F["proof"]] == ["A brief exported in one tap", "Every suite passes"], F)
    ok("briefs: it reads each action's level from the line", [(x["t"], x["lv"]) for x in F["limits"]] == [("Save a brief", "do"), ("Send to build", "raise"), ("draft the PRD", "prepare")], F["limits"])
    ok("briefs: it reads repos and their access", [(x["name"], x["access"]) for x in F["repos"]] == [("Lux4terra/loop-studio", "push"), ("Lux4terra/loop-data", "read")] and [x["t"] for x in F["read"]] == ["the round note"], (F["repos"], F["read"]))
    ok("briefs: filling answers with its undo, and the notes stay", j["undo"]["op"] == "save" and set(j["undo"]["set"]) == {"problem", "user", "proof", "limits", "repos", "read"} and F["notes"] == notes, j["undo"])
    c, j = post(j["undo"]); ok("briefs: undo empties what filling set", j["brief"]["problem"] == "" and j["brief"]["proof"] == [], j["brief"])
    post({"op": "save", "id": fid, "set": {"notes": "No headings here at all."}})
    c, j = post({"op": "fill", "id": fid}); ok("briefs: notes without headings say how to write them", c == 400 and "Problem:" in j["error"], j)

    # ---------- prd.draft (prepare) ----------
    post({"op": "save", "id": bid, "set": {"notes": "Eliya wants every build side by side. Ask Kevin about the old tracker; write to eliya@example.com or call +250 788 123 456. @eliya_n on GitHub. Due 2026-11-01, v1.2."}})
    c, j = post({"op": "prd", "id": bid})
    ok("briefs: without a key, drafting says which keys are missing", c == 400 and j["missing"] == ["GEMINI_API_KEY", "GROQ_API_KEY"] and "GEMINI_API_KEY or GROQ_API_KEY" in j["error"], j)
    post({"op": "cfg", "ai": "groq"})
    c, j = post({"op": "prd", "id": bid})
    ok("briefs: with one provider chosen, it names that key", c == 400 and j["missing"] == ["GROQ_API_KEY"], j)
    c, j = post({"op": "cfg", "ai": "auto", "keepOut": ["Kevin", "Kevin"]})
    ok("briefs: models.choose (do) keeps the order and the names kept out, with its undo", j["cfg"] == {"ai": "auto", "keepOut": ["Kevin"]} and j["undo"]["ai"] == "groq", j)
    tested.add("models.choose")
    h.mock({"aiKeys": True}); n0 = commits()
    c, j = post({"op": "prd", "id": bid}); calls = h.mock()["ai"]
    B = j.get("brief", {})
    ok("briefs: prd.draft (prepare) asks Gemini first and leaves a draft on the brief", c == 200 and j["via"] == "gemini" and calls[0]["provider"] == "gemini" and B["prdDraft"]["text"].startswith("### Summary") and B["prd"] is None, (c, j, calls[:1]))
    ok("briefs: a draft changes nothing but the draft", commits() - n0 == 1 and B["st"] == "ready" and B["problem"].startswith("Builds run"), commits() - n0)
    ok("briefs: Gemini is asked with thinking off and its key from the environment", calls[0]["thinking"] == {"thinkingBudget": 0} and calls[0]["key"] == "test-gemini-key", calls[0])
    sent = calls[0]["prompt"] + calls[0]["sys"]
    ok("briefs: names, emails, phone numbers and handles never reach the model", not re.search(r"(?i)eliya|kevin|example\.com|788 123|@eliya", sent) and "[person]" in sent and "[email]" in sent and "[phone]" in sent and "[handle]" in sent, sent[:400])
    ok("briefs: dates and versions are left as they are", "2026-11-01" in sent and "v1.2" in sent, "")
    ok("briefs: the draft says how many details were kept out", j["removed"] >= 5 and B["prdDraft"]["removed"] == j["removed"], j["removed"])
    c, j = h.call("boot", tok=A, q=Q)
    ok("briefs: a draft waiting shows on Home as a badge", j["data"]["briefs"]["badge"] == 1, j["data"]["briefs"])
    c, j = post({"op": "prd-accept", "id": bid})
    ok("briefs: accepting puts the draft in the brief, with its undo", j["brief"]["prd"]["text"].startswith("### Summary") and j["brief"]["prdDraft"] is None and j["undo"]["op"] == "prd-undo", j["brief"]["prd"])
    c, j = post(j["undo"]); ok("briefs: undo returns the draft for review", j["brief"]["prd"] is None and j["brief"]["prdDraft"]["text"].startswith("### Summary"), "")
    c, j = post({"op": "prd-accept", "id": bid, "text": "### Summary\nEdited by hand."})
    ok("briefs: an edited draft is accepted as edited", j["brief"]["prd"]["text"] == "### Summary\nEdited by hand." and j["brief"]["prd"]["via"] == "you", j["brief"]["prd"])
    h.mock({"aiDown": {"gemini": True}}); h.mock({"ai": []})
    c, j = post({"op": "prd", "id": bid}); calls = [x["provider"] for x in h.mock()["ai"]]
    ok("briefs: with Gemini down, Groq drafts", c == 200 and j["via"] == "groq" and calls[0] == "gemini" and "groq" in calls, calls)
    c, j = post({"op": "prd-discard", "id": bid})
    ok("briefs: discarding a draft leaves the accepted PRD, with its undo", j["brief"]["prdDraft"] is None and j["brief"]["prd"]["text"] == "### Summary\nEdited by hand." and j["undo"]["op"] == "prd-undo", j["brief"])
    h.mock({"aiDown": {"gemini": True, "groq": True}}); n0 = commits()
    c, j = post({"op": "prd", "id": bid})
    ok("briefs: with both down, a plain message and nothing saved", c == 503 and j["error"].startswith("The free models are busy") and commits() == n0, j)
    h.mock({"aiDown": {"gemini": False, "groq": False}, "aiCut": True, "ai": []})
    c, j = post({"op": "prd", "id": bid}); n_calls = len(h.mock()["ai"])
    ok("briefs: a draft cut short is never shown; each model gets a second try with more room", c == 503 and n_calls == 8, n_calls)
    h.mock({"aiCut": False, "aiText": "Sure! Here is a PRD with no headings at all, just one paragraph that rambles on. " * 4})
    c, j = post({"op": "prd", "id": bid})
    ok("briefs: a draft without the PRD's sections is never shown", c == 503, j)
    h.mock({"aiText": None, "ai": []}); post({"op": "cfg", "ai": "groq"})
    c, j = post({"op": "prd", "id": bid})
    ok("briefs: with Groq chosen, only Groq is asked", c == 200 and {x["provider"] for x in h.mock()["ai"]} == {"groq"} and h.mock()["ai"][0]["key"] == "test-groq-key", h.mock()["ai"])
    post({"op": "prd-discard", "id": bid}); post({"op": "cfg", "ai": "auto"})
    c, j = post({"op": "new", "title": "Empty"}); c, j = post({"op": "prd", "id": j["brief"]["id"]})
    ok("briefs: drafting from nothing asks for notes first", c == 400 and "notes" in j["error"], j)
    tested.add("prd.draft")

    # ---------- pack.export (do) ----------
    post({"op": "save", "id": bid, "set": {"reuse": ["i_b1_01", "i_b1_04", "i_b1_01"], "repos": [{"name": "Lux4terra/loop-studio", "access": "push"}, {"name": "Lux4terra/loop-data", "access": "read"}], "read": [{"t": "The round note of build 2"}], "how": "A smoke suite on GitHub Actions per repo.\n- Budgets hold."}})
    c, j = post({"op": "pack", "id": fid})
    ok("briefs: a draft does not export a pack", c == 400 and "ready" in j["error"], j)
    c, j = post({"op": "pack", "id": bid}); P = j["pack"]; T = P["text"]
    heads = re.findall(r"^#{1,2} .*$", T, re.M)
    ok("briefs: pack.export (do) writes version 1 in the pack's shape", c == 200 and P["v"] == 1 and heads == ["# Build 3 · Builds", "## Read first", "## Repos", "## What to build", "## How", "## Proof of done", "## Close"], heads)
    ok("briefs: the pack names the Library items it reuses, once each", T.count("Module contract check (Tool)") == 1 and "Tokens guard (Test)" in T and "Search the Library before building anything" in T, T[:600])
    ok("briefs: the pack gives repos with their access, the branch and every level", "`Lux4terra/loop-studio`, push access." in T and "`Lux4terra/loop-data`, read-only." in T and "Branch `wip/build-3-builds`" in T and "Merge a build to main: raise" in T and "Read commits and test results: do" in T, "")
    ok("briefs: the pack carries the problem, the PRD, the how, the proof and the close", "**Problem.** Builds run" in T and "Edited by hand." in T and "- A smoke suite on GitHub Actions per repo." in T and "- Budgets hold." in T and "1. Three builds tracked" in T and "claude/build-3-builds-round-note.md" in T, "")
    n0 = commits(); c, j = post({"op": "pack", "id": bid})
    ok("briefs: exporting an unchanged brief again keeps its version", j["pack"]["v"] == 1 and j["pack"].get("same") and commits() == n0, j["pack"]["v"])
    post({"op": "save", "id": bid, "set": {"close": "Write claude/loop-studio-round-3.md in project knowledge."}})
    c, j = post({"op": "pack", "id": bid})
    ok("briefs: a changed brief exports a new version, kept on the brief", j["pack"]["v"] == 2 and [x["v"] for x in j["brief"]["packs"]] == [1, 2] and j["pack"]["text"].rstrip().endswith("Write claude/loop-studio-round-3.md in project knowledge."), j["brief"]["packs"])
    c, j = post({"op": "pack-get", "id": bid, "v": 1})
    ok("briefs: earlier versions stay readable", j["pack"]["v"] == 1 and "round-note" in j["pack"]["text"], "")
    tested.add("pack.export")

    # ---------- brief.send (raise) ----------
    n0 = commits()
    c, j = post({"op": "send", "id": bid})
    ok("briefs: brief.send (raise) waits for a person's tap, and nothing changes", c == 409 and j.get("raise") and commits() == n0, j)
    c, j = post({"op": "send", "id": bid, "confirm": "yes"})
    ok("briefs: only a tap's own yes confirms", c == 409, c)
    c, j = post({"op": "send", "id": fid, "confirm": True})
    ok("briefs: only a ready brief is sent", c == 400, j)
    c, j = post({"op": "send", "id": bid, "confirm": True})
    ok("briefs: with the tap, it is sent with its current pack", c == 200 and j["brief"]["st"] == "sent" and j["pack"]["v"] == 2 and j["pack"].get("sent"), j)
    Tq = h.call("today", tok=A, q=Q)[1]["today"]["queue"]
    ok("briefs: brief.sent reaches Today's queue", len(Tq) == 1 and Tq[0]["ref"] == bid and Tq[0]["title"] == "Build 3 · Builds" and Tq[0]["v"] == 2, Tq)
    I = h.F("studio/inbox.json")["items"][0]
    ok("briefs: a notice says it was sent, with the title as written", I["mod"] == "briefs" and I["t"] == "Brief sent to build" and I["o"] == "Build 3 · Builds" and I["go"] == {"app": "today"}, I)
    tested.add("brief.send")

    # ---------- built, set aside, restored (do) ----------
    c, j = post({"op": "state", "id": bid, "to": "built"})
    ok("briefs: a sent brief is marked built, with its undo", j["brief"]["st"] == "built" and j["undo"]["to"] == "sent", j)
    c, j = post(j["undo"]); ok("briefs: undo returns it to sent", j["brief"]["st"] == "sent", "")
    c, j = post({"op": "state", "id": fid, "to": "set-aside"})
    ok("briefs: brief.aside (do) sets a brief aside, with its undo", j["brief"]["st"] == "set-aside" and j["undo"]["to"] == "restore", j)
    c, j = post(j["undo"]); ok("briefs: restoring returns it to where it was", j["brief"]["st"] == "draft", j["brief"]["st"])
    c, j = post({"op": "state", "id": fid, "to": "sent"})
    ok("briefs: a draft cannot jump to sent", c == 400, j)
    tested.add("brief.aside")

    # ---------- queries: the Library's items, and what waits ----------
    c, j = post({"op": "library", "q": "tokens"})
    ok("briefs: it reads the Library's items through the declared query", [x["name"] for x in j["items"]] == ["Tokens guard"], j)
    lib_before = h.F("studio/library/items.json")
    j = get()
    ok("briefs: the list names the Library items its briefs reuse", j["lib"]["i_b1_01"]["name"] == "Module contract check", j["lib"])
    ok("briefs: asking the Library changes none of its records", h.F("studio/library/items.json") == lib_before, "")
    c, j = h.call("boot", tok=A, q=Q)
    ok("briefs: Home counts the briefs that wait", j["data"]["briefs"]["count"] == 2 and j["data"]["briefs"]["badge"] == 0, j["data"]["briefs"])
    c, j = post({"op": "launch", "id": bid})
    ok("briefs: an unknown action is refused", c == 400, j)
    c, j = h.call(R, q=Q)
    ok("briefs: nothing opens without signing in", c == 401, c)
    ok("briefs: every action in its contract is exercised here", tested == {a["id"] for a in C["actions"]}, tested ^ {a["id"] for a in C["actions"]})
