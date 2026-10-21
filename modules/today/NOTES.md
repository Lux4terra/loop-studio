# Today

**Status:** live (build 2).

**Holds:** one focus for the day (past days kept, 400 of them), the queue of briefs and builds in the order Eliya sets, focus sessions logged to the day they began, and the morning briefing.

**Limits:**

| Action | Level | How |
|---|---|---|
| `focus.set` | do | Set or changed in a tap; answers with its undo |
| `queue.order` | do | Dragged by the handle or nudged; taking an item off answers with its undo |
| `timer.log` | do | The timer runs on the device (25 or 50 minutes) and survives a reload; a finished session is logged once, even if it ended while Studio was closed |
| `briefing.write` | prepare | Written on the device from figures, in the reader's language; the server saves nothing for it beyond "read" |

**Hears:** `brief.sent` (the brief joins the queue once; sent again, it keeps its place and takes the newer pack).
**Asks:** `briefs.waiting` (how many briefs are ready, in draft, sent, with a PRD draft waiting; the next three).

**Record:** `studio/today/day.json`

```
{ v: 2,
  days: { "YYYY-MM-DD": { focus, set, read, sessions: [{ id, start, end, min }] } },
  queue: [{ id, kind: "brief" | "build", ref, title, at, v, branch }] }
```

The day is the person's own, as their device counts it: the shell sends `&day=` with every call and the core checks it is within two days of now. The first Today's `{ v: 1, focus, queue }` still reads.

**Home window:** the day's focus in Eliya's words, with the queue count below; the count alone when no focus is set.

**Next:** Builds (build 3) adds its builds to the queue through an event of its own. A gentle alert when a session ends while Studio is closed.
