# Builds

**Status:** slot (build 1). The contract, record, route and an empty screen are in place.

**Holds, once built (build 3):** every build side by side — repo, branch, session, last commit, suite status, next step — read from GitHub, with a smoke suite on GitHub Actions per repo.

**Limits:** writing session packs and reading commits are *do*; merging to main is *raise*.

**Record:** `studio/builds/builds.json` — `{ v, list: [] }`; a build's `st` is `running` while its branch is open.

**Home window:** builds running.
