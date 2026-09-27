# Trade Plan page — build spec

Design reference: `trade-plan-design.html` (in this folder). It is a mockup written in a
custom component format (`<x-dc>`, `<sc-for>`, `<sc-if>`, `{{holes}}`, `class Component extends DCLogic`).
**Do not copy that format.** Use it only for layout, spacing, colors, copy and behavior, and
rebuild it using this app's existing stack, components, routing, auth and database conventions.

## Where it goes
- New route: **Trade Plan**, added to the sidebar right below **Dashboard**. The icon is a checkbox (check inside a square).
- Reuse the existing app shell (sidebar, account switcher, header with page title, date and quote).

## Layout
- Toolbar: previous/next week arrows, a range label ("Sep 20 – 26, 2026"), a **This week** button, a
  summary ("7 plans · 4 logged · 1 skipped"), and on the right a green **My Rules · N** button.
- A grid of 7 day columns, **Sunday to Saturday** (Sunday is labeled "Market opens 5 PM").
  - Today's column gets a cyan border (`#22d3ee`), the same as the Dashboard calendar.
  - Each column scrolls on its own and has a dashed **+ Add plan** button at the bottom.

## Plan tile
Expanded:
- A symbol input (upper-case), a Long/Short toggle (▲ green / ▼ red), and a minimize button.
- A "Checklist" label with a met/total count and a thin progress bar (amber until all rules are met, then green).
- The rule list, where each rule is one of:
  - **check**: a checkbox and its text
  - **choice**: the question text plus a row of option pills; only one can be selected, and clicking it again clears it
- **Trade quality** grade picker: `F, D, C, B, A, A++` (at most one; click again to clear).
  Colors: F `#f05252`, D `#fb8c3c`, C `#f5c542`, B `#b9dc55`, A `#7cc943`, A++ `#2fe0a8`.
- Buttons: **Skip this trade** and **Log to Journal**. Log is disabled until a grade is chosen.
  Either button sets the tile's status and collapses it. A finished tile shows its status plus **Undo**.

Collapsed: the symbol, a direction arrow, a grade badge, the status (Planned / ✓ Logged / Skipped), and met/total rules.
The tile's left edge is tinted with the grade color. Skipped tiles are shown at 60% opacity.

A rule counts as met when a check is checked, or when a choice has an answer.

## My Rules (side drawer, 520px)
- There is **one rule set per trading account**. It is also reachable from Settings → Trading Rules.
- Each rule has a text field, a type switch (**Checkbox** / **Multiple choice**) and a delete button.
- For multiple choice: options show as removable chips. Add one by typing and pressing Enter or clicking Add; there must be at least 2 options.
- **+ Add rule** and **Save rules**. Save drops rules whose text is empty.
- Note shown to the user: edits apply to new plans only; existing tiles keep their snapshot.

## Data model (adapt to the existing DB/ORM)
```
trading_rules
  id, account_id, position, text, type ('check' | 'choice'), options (json string[]), created_at, updated_at

trade_plans
  id, account_id, plan_date (date), symbol, direction ('long' | 'short'),
  grade ('F'|'D'|'C'|'B'|'A'|'A++' | null), status ('planned' | 'logged' | 'skipped'),
  rules_snapshot (json: [{ text, type, options, done, value }]),
  journal_trade_id (nullable FK, set when the plan is logged), created_at, updated_at
```
- When a tile is created, copy the account's current rules into `rules_snapshot`. Editing rules must never change existing tiles.
- **Log to Journal** opens the existing Add Trade flow pre-filled with the symbol and direction, and links the new trade back through `journal_trade_id`.
- Store the collapsed/expanded state on the client only (don't persist it).

## Theme tokens (from the existing app)
bg `#070b14` · sidebar `#05090f` · card `#0b121e` · inner `#0f1726` · border `#1a2436` / `#1f2a3d` ·
text `#e6ebf3` · muted `#8391a7` · green `#7cc943` (text `#8fd14f`) · red `#f05252` · amber `#f5a524` · cyan `#22d3ee`.