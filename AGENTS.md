# AGENTS.md

This file provides repository-specific guidance for agents working on `/Users/robschoen/Dropbox/CC/TM/TMMvotes.html`.

## Scope
- Primary artifact: `/Users/robschoen/Dropbox/CC/TM/TMMvotes.html`
- Supporting data: Excel files in `/Users/robschoen/Dropbox/CC/TM/*.xlsx`
- Runtime model: single static HTML page with inline CSS/JS, no build step

## Purpose Of The Page
- Load one Brookline Town Meeting vote spreadsheet from GitHub raw URLs.
- Parse the first worksheet using `xlsx` in the browser.
- Provide two views:
1. `View by Vote`: members grouped by `YES`, `NO`, `ABSTAIN`, `NoVote` for one selected article.
2. `View by Member`: articles grouped by vote value for one selected member.

## Data Layout Assumptions (Critical)
The parser assumes a fixed worksheet structure.
- Row indexes are zero-based in JS arrays:
- `TITLE_ROW_INDEX = 2` (Excel row 3)
- `DESCRIPTION_ROW_INDEX = 3` (Excel row 4)
- `HEADER_ROW_INDEX = 4` (Excel row 5)
- `FIRST_DATA_ROW_INDEX = 5` (Excel row 6)
- Column indexes:
- `PRECINCT_COL_INDEX = 0` (A)
- `NAME_COL_INDEX = 1` (B)
- Vote columns start at `FIRST_VOTE_COL_INDEX = 2` (C)

If spreadsheet shape changes, update constants first and then revalidate both tabs.

## Behavioral Contracts To Preserve
- Vote normalization must continue returning only:
- `YES`, `NO`, `ABSTAIN`, `NoVote`
- Member keys must remain stable as:
- ```${name} (Precinct ${precinct})```
- `precinctSortValue("AL")` must remain sorted after numeric precincts.
- `View by Vote` percentages are based only on `YES + NO`.
- `View by Member` percentages are based on total article count.
- Spreadsheet change must fully reset and reload global state (`votingData`, `votes`, `members`).

## Safe Edit Guidelines
- Prefer additive edits with small, isolated function changes.
- Keep all DOM IDs stable unless updating all call sites.
- Avoid relying on browser-global `event`; pass event objects explicitly.
- Avoid repeated listener binding when data reloads; ensure listeners are attached once.
- Treat spreadsheet values as untrusted content when rendering to DOM.
- Prefer `textContent` and DOM node creation over direct `innerHTML` interpolation.

## When Updating Spreadsheet Options
- Keep each `<option value>` URL-encoded (spaces as `%20`).
- In single-select dropdowns, only one option should use `selected`.
- Keep displayed vote counts in sync with source spreadsheets.

## Manual Regression Checklist
Run this checklist after any functional change.
1. Open `/Users/robschoen/Dropbox/CC/TM/TMMvotes.html` in a browser.
2. Confirm initial load completes and renders vote results without console errors.
3. Switch across all spreadsheet options and verify data refreshes each time.
4. In `View by Vote`, verify all four vote columns populate and percentages update.
5. Toggle `Sort by last name only` and verify ordering changes.
6. In `View by Member`, switch members and verify all four article columns populate.
7. Toggle `Sort by precinct, then name` and verify member ordering changes.
8. Toggle tabs repeatedly and confirm active-tab styling and content visibility remain correct.

## Known Risks Worth Watching
- Duplicate event listeners when reloading data.
- XSS risk from spreadsheet values rendered via `innerHTML`.
- Ambiguous default spreadsheet selection if multiple `<option selected>` values exist.
- Tab activation logic tied to implicit global `event`.

## Change Management
- If you change parsing rules, update this file and in-code comments together.
- Keep comments concise and focused on invariants, not obvious syntax.
- Do not introduce build tooling unless explicitly requested by the user.
