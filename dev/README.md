# Loop Studio: development

Everything here is for building and testing; Vercel never serves it (`.vercelignore`).

| File | What it does |
|---|---|
| `build.py` | Checks every module contract, stamps one version from the content, writes `public/app/` and `api/_core/registry.gen.js`, merges translations. `--check` says whether they are current. |
| `icons.py` | Draws the app icons from the accent in `app/tokens.css`. |
| `i18n/extract.py` | Gathers every string a person reads into `i18n/strings.json`. `--missing fr` lists what French still lacks. |
| `tests/` | The local mock (`devserver.mjs`: Vercel, GitHub's contents API, and Gemini and Groq, all in memory), the shared `harness.py`, and the suites. |

## Suites

| Suite | Covers |
|---|---|
| `a_api` | Set-up with the studio key, sign-in, sessions and their signatures, rotating the key, the account, appearance, passcodes, the notification centre, headers, an empty data repo, too many tries |
| `b_registry` | Every module contract, the build and its refusals, the registry on its own (`registry_unit.mjs`, with queries), the walls between modules, tokens as the one source of colour, type, radius and motion (module styles too), the first-load budget (shell under 25 KB, each module under 12 KB compressed), translations, nothing of KERUB left, an app that installs |
| `m_modules` | Each module's own `test.py` |
| `c_ui` | Set-up and sign-in on screen, Home, each module opening and loading only then, Back and the browser's back, the notification centre, Appearance, Settings, 360 / 390 / 1,440 px wide, light and dark, contrast, every word through the translation layer, working offline |
| `d_flows` | Build 2's proof of done on a phone: a focus set and changed in a tap, a focus session across a reload, the Build 3 brief through its gate, its pack in one tap, sent with a tap, seen in Today's queue and briefing; the PRD reviewed; the queue dragged and nudged; undo; widths, light and dark; every word translated |
| `s_secrets` | No key, token or password anywhere in the repo |

Screenshots land in `tests/shots_*`, results in `tests/out_*.txt`.
