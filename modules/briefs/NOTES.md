# Briefs

**Status:** live (build 2).

**Holds:** each brief's notes, problem, user, proof of done (each line a check someone can run), limits (each action at do, prepare or raise), the Library items it reuses, the repos a session attaches, what to read first, its branch, how and close; the PRD; and its session packs, version by version.

**States:** draft → ready → sent → built, or set aside (and restored to where it was). Ready only when the proof of done has at least one check and every action has a level; a ready brief whose gate breaks goes back to draft and says so.

**Limits:**

| Action | Level | How |
|---|---|---|
| `brief.save` | do | Each field saved from its own sheet; "Fill fields from notes" reads headings written in the notes (`Problem:`, `User:`, `Proof of done:`, `Limits:` with `(do)` / `(prepare)` / `(raise)`, `Repos:`, `Read first:`). Answers with its undo |
| `brief.ready` | do | Refused until the gate passes |
| `brief.aside` | do | Set aside, restored, marked built or back to sent |
| `prd.draft` | prepare | Free models through the core's router, Gemini first and Groq as fallback (or one alone). Names, emails, phone numbers and handles are taken out first. The draft waits on the brief to be accepted, edited or discarded |
| `pack.export` | do | One tap: the pack is made, copied while the tap still counts, shown, and kept as a version. An unchanged brief keeps its version |
| `models.choose` | do | The provider order and the names kept out of drafts |
| `brief.send` | raise | A sheet says what sending does; only the tap inside it sends (`confirm: true`). Emits `brief.sent` |

**Raises:** `brief.sent` with `{ id, title, v, reuse, branch, at }`. Today listens; Builds will in build 3; the Library may in build 4 (reuse counts).
**Answers:** `briefs.waiting`. **Asks:** `library.items`.

**Records:**

- `studio/briefs/briefs.json`: `{ v, list: [brief], cfg: { ai: "auto" | "gemini" | "groq", keepOut: [] } }`
  - brief: `{ id, title, st, at, upd, by, notes, problem, user, how, close, branch, proof: [{ id, t }], read: [{ id, t }], limits: [{ id, t, lv }], reuse: [libraryId], repos: [{ id, name, access }], prd: { text, at, via } | null, prdDraft: { text, at, via, model, removed } | null, packs: [{ v, at, sent }], sent, built, aside: { from, at } }`
- `studio/briefs/packs.json`: `{ v, by: { briefId: [{ v, at, text, sent }] } }`, the last eight versions of each.

**The pack's shape** is Studio's own session packs: title, read first, repos with access, what to build, how, proof of done, close. Headings stay in English, the language sessions read.

**Home window:** briefs in draft or ready; the badge counts PRD drafts waiting for review.

**Keys:** `GEMINI_API_KEY` and `GROQ_API_KEY`, in Vercel only. Without one, the PRD button names the key it needs. `GEMINI_MODELS` and `GROQ_MODELS` override the models tried (comma-separated).
