# Library

**Status:** slot (build 1). The contract, record, route and an empty screen are in place. The screen already lists items filed before the module's own build.

**Holds, once built (build 4):** tools, prompts, components, tests, decisions and facts — each with a name, a one-line purpose, an example and a date; reuse suggested while a brief is written; expired facts flagged. Listening to `brief.sent` (its `reuse` ids) can count each item's uses.

**Limits:** filing is *do*; suggesting reuse is *prepare*; promoting an item into Loop Core is *raise*.

**Answers already:** `library.items` (`{ ids }` or `{ q }`, newest first, at most 300), so Briefs can name the items a brief reuses without reaching into these records.

**Record:** `studio/library/items.json` — `{ v, items: [{ id, kind, name, purpose, example, at, uses }] }`.

**Home window:** items filed.
