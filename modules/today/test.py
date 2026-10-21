# Today · the module's own checks, run by dev/tests/m_modules.py with the shared harness (h) and its contract (C).
# Every action in the contract is exercised at its level: the do actions act, log a commit and answer with their undo;
# the briefing (prepare) is written on the screen from figures, so the server saves nothing for it.
import datetime

def run(h, C):
    A = h.setup()
    R = C["routes"][0]
    DAY = datetime.date.today().isoformat()
    YDAY = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    Q = "&day=" + DAY
    get = lambda: h.call(R, tok=A, q=Q)[1]
    post = lambda b, q=Q: h.call(R, b, tok=A, q=q)
    commits = lambda: len(h.mock()["commits"])
    def brief(title, send=True):
        c, j = h.call("briefs", {"op": "new", "title": title}, tok=A, q=Q); bid = j["brief"]["id"]
        h.call("briefs", {"op": "save", "id": bid, "set": {"proof": [{"t": "A check someone can run"}], "limits": [{"t": "Read commits", "lv": "do"}]}}, tok=A, q=Q)
        h.call("briefs", {"op": "state", "id": bid, "to": "ready"}, tok=A, q=Q)
        if send: h.call("briefs", {"op": "send", "id": bid, "confirm": True}, tok=A, q=Q)
        return bid

    tested = set()
    j = get()
    ok = h.ok
    ok("today: reads its record, empty at first, with figures from Briefs", j.get("ok") and j["today"]["v"] == 2 and j["today"]["queue"] == [] and j["figures"] == {"draft": 0, "ready": 0, "sent": 0, "prd": 0, "next": []} and j["day"] == DAY, j)
    n0 = commits(); get(); h.call("boot", tok=A, q=Q)
    ok("today: reading, and writing the briefing, save nothing", commits() == n0, commits() - n0)
    tested.add("briefing.write")
    c, j = h.call(R, q=Q)
    ok("today: nothing opens without signing in", c == 401, c)

    # ---------- focus.set (do) ----------
    h.mock({"put": {"path": "studio/today/day.json", "data": {"v": 2, "days": {YDAY: {"focus": "Yesterday's line", "sessions": [{"id": "t_old", "start": "x", "end": "y", "min": 25}]}}, "queue": []}}})
    c, j = post({"op": "focus", "text": "Ship Today and Briefs"})
    days = j["today"]["days"]
    ok("today: focus.set (do) sets the day's focus and answers with its undo", c == 200 and days[DAY]["focus"] == "Ship Today and Briefs" and j["undo"] == {"op": "focus", "text": ""}, j)
    ok("today: past days are kept", days.get(YDAY, {}).get("focus") == "Yesterday's line", list(days))
    ok("today: the save is a commit, named for what it did and who did it", h.mock()["commits"][-1]["message"].startswith("Focus · ") and h.mock()["commits"][-1]["by"] == h.NAME + " via Loop Studio", h.mock()["commits"][-1])
    c, j = h.call("boot", tok=A, q=Q)
    ok("today: Home's window leads with the focus", j["data"]["today"]["text"] == "Ship Today and Briefs" and j["data"]["today"]["count"] == 0, j["data"]["today"])
    c, j = h.call("boot", tok=A, q="&day=" + YDAY)
    ok("today: the window follows the device's day", j["data"]["today"]["text"] == "Yesterday's line", j["data"]["today"])
    c, j = post({"op": "focus", "text": "Changed in a tap"}); u = j["undo"]
    c, j = post(u)
    ok("today: undo puts the focus back", j["today"]["days"][DAY]["focus"] == "Ship Today and Briefs", j["today"]["days"][DAY])
    n0 = commits(); post({"op": "focus", "text": "Ship Today and Briefs"})
    ok("today: the same focus again saves nothing", commits() == n0, "")
    c, j = post({"op": "focus", "text": "<b>x</b>" + "y" * 300})
    ok("today: a focus is one clean line, cut to 140", "<" not in j["today"]["days"][DAY]["focus"] and len(j["today"]["days"][DAY]["focus"]) == 140, j["today"]["days"][DAY]["focus"][:20])
    post({"op": "focus", "text": "Ship Today and Briefs"})
    tested.add("focus.set")

    # ---------- brief.sent reaches the queue ----------
    b1 = brief("Build 3 · Builds"); b2 = brief("Studio site"); b3 = brief("Library search")
    j = get(); Qu = j["today"]["queue"]
    ok("today: each brief sent to build joins the queue, in the order sent", [x["title"] for x in Qu] == ["Build 3 · Builds", "Studio site", "Library search"] and all(x["kind"] == "brief" and x["v"] == 1 for x in Qu) and Qu[0]["ref"] == b1, Qu)
    ok("today: the briefing's figures count the briefs", j["figures"]["sent"] == 3 and j["figures"]["ready"] == 0, j["figures"])
    b4 = brief("Ready, not sent", send=False)
    j = get()
    ok("today: a ready brief is named for the briefing", j["figures"]["ready"] == 1 and j["figures"]["next"][0]["title"] == "Ready, not sent", j["figures"])
    c, j = h.call("boot", tok=A, q=Q)
    ok("today: Home counts the queue under the focus", j["data"]["today"]["count"] == 3, j["data"]["today"])

    # ---------- queue.order (do) ----------
    ids = [x["id"] for x in Qu]
    c, j = post({"op": "order", "ids": ids[::-1]})
    ok("today: queue.order (do) sets the order and answers with its undo", [x["id"] for x in j["today"]["queue"]] == ids[::-1] and j["undo"] == {"op": "order", "ids": ids}, j)
    c, j = post(j["undo"])
    ok("today: undo restores the order", [x["id"] for x in j["today"]["queue"]] == ids, "")
    c, j = post({"op": "order", "ids": [ids[2]]})
    ok("today: an order naming some items moves those first and keeps the rest", [x["id"] for x in j["today"]["queue"]] == [ids[2], ids[0], ids[1]], "")
    post({"op": "order", "ids": ids})
    c, j = post({"op": "remove", "id": ids[1]})
    ok("today: taking an item off answers with its undo", [x["id"] for x in j["today"]["queue"]] == [ids[0], ids[2]] and j["undo"]["op"] == "restore" and j["undo"]["at"] == 1, j)
    c, j = post(j["undo"])
    ok("today: undo puts it back in its place", [x["id"] for x in j["today"]["queue"]] == ids, [x["id"] for x in j["today"]["queue"]])
    c, j = post({"op": "remove", "id": "q_nope"})
    ok("today: taking off an item that is gone says so", c == 404, c)
    tested.add("queue.order")

    # ---------- timer.log (do) ----------
    now = datetime.datetime.now(datetime.timezone.utc)
    start = (now - datetime.timedelta(minutes=26)).isoformat()
    c, j = post({"op": "session", "id": "t_a1", "day": DAY, "start": start, "min": 25})
    S = j["today"]["days"][DAY]["sessions"]
    ok("today: timer.log (do) logs a finished session to its day, with its undo", c == 200 and len(S) == 1 and S[0]["min"] == 25 and j["undo"] == {"op": "unsession", "id": "t_a1", "day": DAY}, j)
    n0 = commits(); c, j = post({"op": "session", "id": "t_a1", "day": DAY, "start": start, "min": 25})
    ok("today: the same session twice is logged once", commits() == n0 and len(j["today"]["days"][DAY]["sessions"]) == 1, "")
    c, j = post({"op": "session", "id": "t_a2", "day": DAY, "start": start, "min": 30})
    ok("today: a session runs 25 or 50 minutes", c == 400, j)
    c, j = post({"op": "session", "id": "t_a3", "day": DAY, "start": now.isoformat(), "min": 50})
    ok("today: a session still running is not logged", c == 400 and "not finished" in j.get("error", ""), j)
    c, j = post({"op": "session", "id": "t_a4", "day": YDAY, "start": (now - datetime.timedelta(minutes=60)).isoformat(), "min": 50})
    ok("today: a session goes to the day it began on the device", len(j["today"]["days"][YDAY]["sessions"]) == 2, j["today"]["days"][YDAY])
    c, j = post({"op": "unsession", "id": "t_a1", "day": DAY})
    ok("today: undo takes a logged session off", j["today"]["days"][DAY]["sessions"] == [], "")
    tested.add("timer.log")

    # ---------- the briefing read ----------
    c, j = post({"op": "read"})
    ok("today: marking the briefing read keeps when", j["today"]["days"][DAY].get("read"), j["today"]["days"][DAY])
    c, j = post({"op": "launch"})
    ok("today: an unknown action is refused", c == 400, c)
    c, j = h.call(R, {"op": "focus", "text": "x"}, tok=A, q="&day=1999-01-01")
    utc = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    ok("today: a day far from now is read as the server's today", c == 200 and j["today"]["days"].get(utc, {}).get("focus") == "x", list(j["today"]["days"]))
    post({"op": "focus", "text": "Ship Today and Briefs"})

    # the first Today's record, from build 1, still reads
    h.mock({"put": {"path": "studio/today/day.json", "data": {"v": 1, "focus": "", "queue": []}}})
    j = get()
    ok("today: the first record shape still reads", j["today"]["v"] == 2 and j["today"]["queue"] == [], j)
    ok("today: every action in its contract is exercised here", tested == {a["id"] for a in C["actions"]}, tested ^ {a["id"] for a in C["actions"]})
