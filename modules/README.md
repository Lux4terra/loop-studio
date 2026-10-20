# Modules

Every capability in Loop Studio is a module: one folder, one contract, touching nothing outside itself. The build reads these folders and plugs each module into one registry, on the server (`api/_core/registry.gen.js`) and on the screen (`public/app/m/<id>.js`, loaded only when its app opens).

## A module's folder

| File | What it is |
|---|---|
| `module.json` | The contract (below). The build refuses a module whose contract is incomplete. |
| `server.js` | `export default function (core) { return { routes, boot, on } }` |
| `screen.js` | `Studio.register("<id>", { load(ctx), render(ctx, record), acts, forms })` |
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
| `events` | `emits` and `listens`: the only way modules hear of each other. |
| `window` | Home's window for it: words for `zero`, `one`, `many` and a `line`. The server sends the figure; the screen writes the sentence in the reader's language. |
| `i18n`, `tests` | Languages it carries, and its test file. |

## The core a module receives

`core.path(name)`, `core.load(path, def)`, `core.read(path)`, `core.mutate(path, def, fn, message, who)` — its own records only; `core.notify({ k, t, x, st, go })` — a notice in the notification centre; `core.emit(event, data, me)`; and `core.send`, `core.fail`, `core.clean`, `core.now`, `core.rid`.

## The context a screen receives

`ctx.api(body)` calls the module's own route; `ctx.ui` holds the shell's helpers (`head`, `slot`, `empty`, `seg`, `sw`, `tile`, `ic`, `esc`, `dm`, `hm`, `rel`); `ctx.t` / `ctx.T` translate; `ctx.data` is what boot sent for it; `ctx.rerender()` draws it again. Colours, type, radii and motion come only from `app/tokens.css`.

## Adding a module

1. Copy a slot's folder and rename it.
2. Fill in `module.json`.
3. `python3 dev/build.py`.
4. `sh dev/tests/run_all.sh`.
