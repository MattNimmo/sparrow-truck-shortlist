# Sparrow truck comparison

A public, price-first comparison of the current top 50 priced trucks, served by the existing GET-only feed. The page polls saved evidence every 15 seconds while visible. It does not scan sellers continuously or change the existing rubric, source schedule or alerts.

## Comparison

- Large listed asking prices directly after truck identity, then mileage, overall score, all five weighted metrics and moving equipment.
- Search model, seller, stock and state; combine price, mileage, moving-body and explicit-attic filters. Filters apply to the published 50 only.
- Overall ranks stay attached while sorting. P/M positions compare the entire published list with explicit USD/mi units.
- Expand a truck for source claims, actual point breakdowns, assumptions, unknowns and original observation time.
- Phone layout keeps prices prominent, retains every metric and uses expandable filters; desktop uses a six-column table with sticky headers.
- Ranking weights, price eligibility and the attic bonus are unchanged by this design release.

No API keys, database credentials, VINs, raw source evidence, private notes or direct table access appear in the site. A disconnected page keeps the last successful data with an explicit warning. There is no fabricated fallback inventory.

Run `npm test`. Preview on `http://127.0.0.1:8771` (the feed's approved local origin). Deploy main to GitHub Pages.

## Design references and skills checked

- [NN/g comparison tables](https://www.nngroup.com/articles/comparison-tables/): show meaningful deciding attributes early, keep labels visible, reduce comparison noise and support mobile.
- [Carbon data-table guidance](https://carbondesignsystem.com/components/data-table/usage/): search/filter utilities, sorting and expandable details.
- [Impeccable](https://github.com/pbakaus/impeccable): existing local design skill applied to hierarchy, purposeful color and responsive layout.
- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design): reviewed as an alternative; no additional global skill installation required.

The local design context is recorded in `.impeccable.md`.
