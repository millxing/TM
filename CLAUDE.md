# CLAUDE.md

Repository guidance for `/Users/robschoen/Dropbox/CC/TM`.

## Scope
- App files:
- `/Users/robschoen/Dropbox/CC/TM/TMMvotes.html`
- `/Users/robschoen/Dropbox/CC/TM/TMMpca.html`
- Data files:
- Session workbooks in `/Users/robschoen/Dropbox/CC/TM/Votes/*.xlsx`
- Primary metadata workbook: `/Users/robschoen/Dropbox/CC/TM/Votes/AllVotes_categorized.xlsx`

## Vote Metadata Contract
- `AllVotes_categorized.xlsx` is the primary source for vote descriptions across apps.
- Header row is expected to include:
- `ID`, `Town Meeting Session`, `Vote Title`, `Description`, `Category`
- Optional: `Session Night`
- There should be one row per vote (currently 449 vote rows).
- `ID` is a unique hash identifier for a vote (derived externally from session + vote title).

## Description Resolution Order
1. `AllVotes_categorized.xlsx` (`Description`)
2. `VoteGuide.xlsx` (legacy fallback)
3. Session workbook description row

## Matching Rules
- Votes are linked by normalized session label + vote title text.
- Runtime vote IDs in apps remain session/column based (for example `2025-11::37`).
- Categories are loaded from `AllVotes_categorized.xlsx` but are not yet displayed in current UI.

## Editing Rules
- Keep DOM IDs stable unless all call sites are updated.
- Avoid browser-global `event`; pass event objects explicitly.
- Prefer `textContent` and node creation over `innerHTML` interpolation.
- Preserve the existing vote normalization contract: `YES`, `NO`, `ABSTAIN`, `NoVote`.
