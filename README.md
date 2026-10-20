# Loop Studio

Eliya's incubation and productivity app for the Loop Institute: one Home of apps, where every workflow is a module with a contract. It installs on a phone from the browser and keeps its records in the private repo `Lux4terra/loop-data`, every save a commit.

Started as a stripped copy of the KERUB OS shell (sign-in, Home, windows, the notification centre, Appearance, the module registry, the service worker, the build and the test harness), with everything of KERUB taken out and each module given its own folder.

## Layout

| Folder | What it holds |
|---|---|
| `app/` | The shell's sources: `index.html`, `shell.js`, `shell.css`, `tokens.css`, `paint.js`, `sw.js`, the manifest, icons and translations |
| `modules/<id>/` | One module each: contract, server part, screen, translations, test and notes (see `modules/README.md`) |
| `api/studio.js` | The API: sign-in, the account, appearance, the notification centre, and every module's routes through the registry |
| `api/_core/` | The store (GitHub), sign-in, the registry, helpers, and `registry.gen.js` written by the build |
| `public/app/` | What Vercel serves, written by the build; never edited by hand |
| `dev/` | The build, the icon tool, the string extractor, and the test suites with their local mock |

## Design tokens

`app/tokens.css` is the only file with raw colours, type, radii and motion. The Loop design system replaces its values in one change; `dev/tests/b_registry.py` keeps every other file to the tokens' names. After a token change, `python3 dev/icons.py` redraws the app icons from the accent.

## Build and test

```
python3 dev/build.py                 # checks every contract, writes public/app and the registry
sh dev/tests/setup.sh                # once: Playwright with Chromium, and Pillow
sh dev/tests/run_all.sh              # every suite, about three minutes
sh dev/tests/run_all.sh c_ui         # one suite
```

Nothing reaches `main` until every suite passes on the exact commit. Work happens on `wip/<build>` branches.

## Vercel

Project root is this repo; no build command (the build output is committed in `public/`). Environment variables, set only in Vercel:

| Variable | Value |
|---|---|
| `LOOP_GITHUB_TOKEN` | A fine-grained GitHub token with Contents read and write on `Lux4terra/loop-data` only |
| `LOOP_DATA_REPO` | `Lux4terra/loop-data` |
| `STUDIO_KEY` | A long random phrase (16 characters or more). It signs every session and sets up or resets the passcode; rotating it signs every device out |

Open `/app/`, set Studio up with the studio key, choose a passcode, then add Studio to the Home Screen.
