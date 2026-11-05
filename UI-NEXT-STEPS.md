# UI improvements worth considering next

These ideas came out of the 2026 UI redesign (branch `t3/improve-website-ui`). Most come from task-based
usability testing: an agent tried to answer real resident and journalist questions using only what was on
screen. The rest come from the last round of design reviews. None of them is a bug. Each would remove friction
that testers actually hit.

All of them can be built in the existing static files (`TMMvotes.html`, `TMMpca.html`, `tm-shared.js`)
without a backend or new frameworks.

## Highest value

### 1. Find a vote within a member's record (View by Member)
- **Problem:** A member's votes are grouped by how they voted (Yes / No / Abstain / Not Recorded), and each
  group is in meeting order. The motions on a single article end up scattered. In testing, the four
  Article 23 motions for one member sat in three different columns, and one of them was the 16th item in
  the Yes list.
- **Suggestion:**
  - Sort each column by article number, so motions on the same article sit together.
  - Add a "Find a vote" text box above the columns that hides vote cards that don't match
    (e.g. "23" or "stipend").
  - Optionally, add a "Show in meeting order" toggle that shows a single table: Article | Motion | Vote.
- **Effort:** small to medium.

### 2. Searchable member picker in the main app
- **Problem:** The member menus (View by Member, Member Networks, Outlier Votes) are native dropdowns
  with about 280 names. Phone pickers can't be searched by typing, so finding one name is a long scroll.
- **Suggestion:** Reuse the "Find a member" pattern from the Voting Map page: a text box with a list of
  names that also accepts "First Last". Picking a name sets the existing dropdown. Also, the Member
  Networks menu sorts by precinct by default while the others sort alphabetically; consider making
  alphabetical the default everywhere.
- **Effort:** small.

### 3. Date range filter for cross-session views
- **Problem:** Closest Votes and Member History always cover every session since 2021. Questions like
  "closest votes in the last two years" or "who missed the most votes this term" can't be answered
  directly. This was the only task that ended up only partly completed.
- **Suggestion:** Add a shared "Since" menu (All, 2022, 2023, 2024, 2025, 2026) or a first-session/
  last-session pair, like the PCA page has. Recompute the tables over the chosen range.
- **Effort:** medium.

### 4. Name the source documents
- **Problem:** Links show as "Source 1" to "Source 4". Visitors can't tell which one is the warrant,
  the combined reports or the final results without opening each one. The URLs
  (`DocumentCenter/View/NNNNN`) don't say which is which either.
- **Suggestion:** Add link labels to the data, either as a label column next to each link in the
  session workbooks or as a small lookup by URL. Then show "Warrant", "Combined Reports",
  "Final Results" and "Town Meeting files". Keep "Source N" as the fallback.
- **Effort:** small in the app, plus a data update.

### 5. More descriptive vote titles in the dropdowns
- **Problem:** The vote options use short titles that sometimes drop the key word. For example,
  "8: Budget Appropriations Article, main motion" doesn't mention FY27, so it's easy to confuse with
  "5: FY26 Budget Amendment". Some titles are also cut off mid-phrase ("15: Amend Article 5"). Motion
  names are worded differently from view to view: "motion to end debate" vs "Motion to Terminate Debate".
- **Suggestion:** Use one shared label formatter everywhere (Article · short title · motion), and use
  the fuller `Description` from `AllVotes_categorized.xlsx` where the short title is cut off. Consider
  grouping options by night with `<optgroup>`.
- **Effort:** small to medium. Check this against the vote metadata contract in `CLAUDE.md`.

## Also worth doing

- **Precinct Votes, list the splits:** Add a per-row "Split: P14, P15" chip next to the vote title, plus
  a "Show only votes with a precinct split" checkbox. Today you find splits by scanning a grid of
  38 rows × 17 precincts, and on phones by swiping sideways.
- **Precinct Votes on phones:**
  - Make the precinct header row sticky. The header sticks on desktop, but on phones the table scrolls
    sideways, which stops it.
  - Show a one-line description under each vote title. The Description column is hidden on phones.
- **Voting map, plain-language position:** Next to "PC1 0.33, PC2 2.05", add a sentence such as
  "near the middle of the primary axis (rank 160 of 315)". Consider labelling the ends of each axis.
- **Desktop result columns:** In View by Vote and View by Member, the fixed-height columns show about
  8 names at 1440×900, and the only cue that more exist is a faint fade. Add a "+N more" footer or let
  the columns grow.
- **Loading feedback:** The first load shows a plain "Loading voting data…" line. Consider placeholder
  rows that look like the table, plus a "Loading session N of 13" counter.
- **Heat map colours:** The neighbouring color steps (61–80% vs 81–100%, and 20–39% vs 40–60%) are
  close in lightness. Widen the gaps so values like 64% and 85% are easier to tell apart.
- **CSS cleanup:** The redesign was layered onto the existing styles in several override blocks
  ("Design System v2", "Post-round-3 fixes", "Round 4 fixes", "Task-test fixes"). Merging them into
  one block per component would make future changes less likely to break something.

## How these were found

- **Design reviews:** independent design reviews scored the site from about 5.5/10 to 8.2/10.
  The Round 4 review is the source of the remaining design items above.
- **Task-based testing:** a tester agent tried 11 resident and journalist questions on desktop and
  phone. It completed 10 at first; after fixes, a fresh tester completed all 8 re-tested tasks.
- **Next step:** the most useful follow-up would be watching a few real residents or Town Meeting
  members use the site on their phones.
