# Modules

Every capability in Loop Studio is a module: one folder, one contract, touching nothing outside itself. The build reads these folders and plugs each module into one registry, on the server (`api/_core/registry.gen.js`) and on the screen (`public/app/m/<id>.js`, loaded only when its app opens).

## A module's folder

| File | What it is |
|---|---|
| `module.json` | The contract (below). The build refuses a module whose contract is incomplete. |
| `server.js` | `export default function (core) { return { routes, boot, on } }` |
| `screen.js` | `Studio.register("<id>", { load(ctx), render(ctx, record), after(ctx, record), acts, forms })` |
| `screen.css` | Optional: the module's own styles, tokens only, loaded with its screen. |
| `i18n/<lang>.json` | Translations of the module's strings, English text as the key. English needs no file. |
| `test.py` | `def run(h, C)`: the module's own checks, run by `dev/tests/m_modules.py` with the shared harness. |
| `NOTES.md` | What the module holds, what comes next, its record's shape. |

## The contract (`module.json`)

| Key | Meaning |
|---|---|
| `id` | The folder's name; lower case. |
| `name`, `summary` | What Home and the screen call it, and one line on what it does. |
| `version`, `status` | Contract version; `slot` (empty screen) or `live`. |
| `order`, `dock`, `icon`, `hue` | Its place on Home, whether it sits in the dock, its icon and colour. |
| `records` | Every file it keeps, all under `studio/<id>/`. The core refuses any other path. |
| `routes` | The API actions it answers. Each must be unique across Studio. |
| `permissions` | What a person needs to use it, named for when Studio has more than one person. |
| `actions` | Each thing it does, at its level: `do` (acts, logs, can be undone), `prepare` (drafts for a person to approve), or `raise` (stops and asks). |
| `events` | `emits` and `listens`: the only way modules tell each other something. |
| `queries` | `provides` and `uses`: the only way a module asks another a question. A query is named `<id>.<name>` after the module that answers it, runs read-only (nothing saved, raised or told while it runs) and answers with a copy. |
| `window` | Home's window for it: words for `zero`, `one`, `many` and a `line`. The server sends the figure; the screen writes the sentence in the reader's language. |
| `i18n`, `tests` | Languages it carries, and its test file. |

## The core a module receives

`core.path(name)`, `core.load(path, def)`, `core.read(path)`, `core.mutate(path, def, fn, message, who)` — its own records only; `core.notify({ k, t, x, o, st, go })` — a notice in the notification centre (`o` holds the person's own words, shown as written); `core.emit(event, data, me)`; `core.query(name, args, me)`; `core.ai` — the free-model router (`keys()`, `draft({ sys, prompt, order, names, max, check })`, `scrub(text, names)`); and `core.send`, `core.fail`, `core.clean`, `core.para`, `core.now`, `core.rid`.

A server part returns `{ routes, boot(me), on: { event(data, me, from) }, provide: { query(args, me, from) } }`. `me` carries `name`, `at` and `day`, the person's own day as their device counts it.

**Levels in practice.** A `do` route answers with `undo`, the call that reverses it. A `prepare` route leaves a draft for a person and changes nothing else. A `raise` route refuses without `confirm: true`, which only a person's tap sends.

## The context a screen receives

- `ctx.api(body, q)` calls the module's own route (Home's figures follow quietly after a save); `ctx.rec` is its record; `ctx.set(rec)` keeps and draws it.
- `ctx.sub` is the module's own sub-view (`#/briefs/b_1a2b`); `ctx.go(sub)` moves within the module and `ctx.open(app, sub)` to another app, both with Back and the browser's back.
- `ctx.ui` holds the shell's helpers (`head` with `own` for a person's words, `slot`, `contract`, `empty`, `tile`, `ic`, `lv`, `busy`, `esc`, `dm`, `hm`, `rel`).
- Words: `ctx.t` / `ctx.T` translate; `ctx.f(s, vars)` and `ctx.F(s, vars)` translate a sentence with `{name}` slots (text, or HTML whose values are HTML); `ctx.own(text)` marks a person's own words, never translated; `ctx.plural`.
- `ctx.sheet(title, html)` and `ctx.close()`; `ctx.toast(msg)`; `ctx.undo(msg, fn)` offers Undo for six seconds.
- `ctx.keep(key, value)` / `ctx.kept(key)` keep small things on this device; `ctx.every(ms, fn)` ticks while the module is open; `ctx.q(sel)` finds an element in its screen or sheet; `ctx.copy(textOrPromise)` and `ctx.share({ title, text })`.
- `ctx.day` (the device's day), `ctx.needs` (notices that need the person), `ctx.data` (what boot sent for it).

Colours, type, radii and motion come only from `app/tokens.css`.

## Adding a module

1. Copy a slot's folder and rename it.
2. Fill in `module.json`.
3. `python3 dev/build.py`.
4. `sh dev/tests/run_all.sh`.
