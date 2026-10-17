# 0.6.0 — 2026-10-16

Show photo rust assessment, overall deduction and review coverage on every top-50 truck; distinguish pending/insufficient/expired from no visible rust. Accept rubric-v3.5.

## 0.5.0 — 2026-10-16

- Show each top-50 truck's listing photo beside its rank and title, linked to the listing. Photos load lazily, send no referrer, and come only from the source's own image service (Penske, Sandhills for TruckPaper/AIM, Charter and Appleton uploads).
- Use the feed's `thumbnail_url`; a Penske unit's lead photo is also used when the feed has none. A listing without a saved photo, or a photo that fails to load, shows "No saved photo".
- Widen the identity column (22% to 25%); smaller side-by-side photo at tablet width; phone cards keep a 104px photo.

## 0.4.0 — 2026-10-16

- Lead with large listed prices in a six-column comparison; expose all weighted scores with labeled bars.
- Add search and combined price/mileage/body/attic filters, preserving overall ranks.
- Expand source evidence and point breakdowns on demand; preserve expansion and filters during live updates.
- Add responsive phone rows, sticky desktop headers, labeled color states and reduced-motion support.
- Keep rubric, publication scope, source schedule and alerts unchanged.

## 0.3.2 — 2026-10-16

- Require a real positive USD asking price for every top-50 row; explain and count price exclusions.

## 0.3.1 — 2026-10-16

- Explain and accept rubric v3.3 with the explicit 2-point attic bonus.

## 0.3.0 — 2026-10-16

- Expand to live top 50 using rubric v3.2, automatic reranking, per-category sorting and component breakdowns.
- Show assumptions and unverified identities; remove the outdated curated-ten fallback.

# Changelog

## 0.2.0 — 2026-10-16

- Connect the ten already-published comparison entries to a minimized read-only listing feed. Refresh saved details every15seconds while visible, on return to the tab, or with Refresh now.
- Show each observation time, listing state, stale/sold/spec-change review labels and explicit disconnection/last-success status. Escape listing text and reject untrusted URLs/invalid metrics.
- Preserve curated ordering and distinguish current facts from original selection rationale. Weighted scoring and automatic publication of additional ledger candidates remain out of scope.
- 10 Node tests pass;88.41% instrumented line coverage including tests. Browser checks cover live connection, sorting and observed timestamps.

## 0.1.1 — 2026-10-16

- Explain the overall investigation ranking above the comparison, label each truck Overall #1–#10, and show its individual tradeoffs. Keep overall ranks fixed during price/mileage sorting.

##0.1.0 —2026-10-16

- Initial ten-truck comparison, numeric sorting, source links and explicit uncertainties.
