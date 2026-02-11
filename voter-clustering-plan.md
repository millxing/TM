# Voter Clustering Feature — Implementation Plan

## Context for the implementer

You are adding a **Voter Clustering** tab to an existing single-file HTML app (`TMMvotes.html`) that analyzes Brookline Town Meeting roll-call votes. The app currently loads one Excel spreadsheet at a time from GitHub and offers two views: "View by Vote" (pick an article, see who voted Yes/No/Abstain) and "View by Member" (pick a member, see all their votes). The new feature loads **all sessions simultaneously**, matches members across sessions, builds a voting-pattern matrix, and renders an interactive 2D scatter plot where each dot is a Town Meeting member, positioned so that members who vote similarly appear near each other.

---

## 1. Data source & spreadsheet structure

Spreadsheets are hosted at:
```
https://raw.githubusercontent.com/millxing/TM/main/<encoded filename>
```

The current set of files (hardcoded in a `<select>` element) is:

| File | Label |
|------|-------|
| `May%202022%20Votes.xlsx` | May 2022 (57 votes) |
| `November%202022%20Votes.xlsx` | November 2022 (68 votes) |
| `May%202023%20Votes.xlsx` | May 2023 (44 votes) |
| `November%202023%20Votes.xlsx` | November 2023 (24 votes) |
| `May%202024%20Votes.xlsx` | May 2024 (34 votes) |
| `November%202024%20Votes.xlsx` | November 2024 (28 votes) |
| `May%202025%20Votes.xlsx` | May 2025 (45 votes) |
| `November%202025%20Votes.xlsx` | November 2025 (19 votes) |

Each spreadsheet has identical structure:
- **Row 3 (index 2):** Article titles (e.g., "Article 32 Main Motion", "Terminate Debate on Article 8")
- **Row 4 (index 3):** Article descriptions
- **Row 5 (index 4):** Column headers
- **Row 6+ (index 5+):** Voting data, one row per member
- **Column A (index 0):** Precinct number or "AL" (At Large)
- **Column B (index 1):** Member name (e.g., "Abramowitz, Neil")
- **Columns C+ (index 2+):** Vote values — "Y", "N", "A", or blank

Summary/total rows (named "YES", "NO", "TOTAL", etc.) must be filtered out. Precinct must be a valid integer or "AL".

The existing code already has all the parsing logic for a single spreadsheet. Reuse it.

---

## 2. Member matching across sessions

Members are identified by **name string** (Column B) combined with **precinct**. The same person may appear in some sessions but not others (they weren't elected, or they missed that meeting entirely).

**Matching strategy — keep it simple:**
- Build a canonical key: `normalize(name) + "|" + precinct` where `normalize` lowercases and trims whitespace.
- Exact match only. Do NOT attempt fuzzy matching — name formatting is consistent across these spreadsheets since they come from the same clerk's office.
- If a member's precinct changes between sessions (rare but possible after redistricting), they will appear as two separate members. This is acceptable.

---

## 3. Building the vote matrix

### 3.1 Load all spreadsheets

Define a single source of truth for sessions in **chronological order** (oldest to newest), e.g.:

```js
const SESSION_FILES = [
  { id: "2022-05", label: "May 2022", file: "May%202022%20Votes.xlsx" },
  { id: "2022-11", label: "November 2022", file: "November%202022%20Votes.xlsx" },
  { id: "2023-05", label: "May 2023", file: "May%202023%20Votes.xlsx" },
  { id: "2023-11", label: "November 2023", file: "November%202023%20Votes.xlsx" },
  { id: "2024-05", label: "May 2024", file: "May%202024%20Votes.xlsx" },
  { id: "2024-11", label: "November 2024", file: "November%202024%20Votes.xlsx" },
  { id: "2025-05", label: "May 2025", file: "May%202025%20Votes.xlsx" },
  { id: "2025-11", label: "November 2025", file: "November%202025%20Votes.xlsx" }
];
```

Fetch and parse all 8 spreadsheets in parallel using `Promise.all`. For each spreadsheet, extract:
- The list of vote columns (title + description + whether it's a "Terminate Debate" vote)
- The list of members and their votes

For progress updates, increment a shared `loadedCount` in each file's `finally` block and update a status label like `"Loading 3 of 8..."`.

If any fetch/parse fails, surface which session failed and stop rendering the clustering view (do not silently skip files).

Store as an array of session objects:
```js
sessions = [
  {
    id: "2022-05",
    label: "May 2022",
    file: "May%202022%20Votes.xlsx",
    votes: [
      {
        id: "2022-05::2",
        sessionId: "2022-05",
        sessionLabel: "May 2022",
        colIndex: 2,
        title: "Article 1 Main Motion",
        description: "...",
        isTerminateDebate: false
      },
      {
        id: "2022-05::3",
        sessionId: "2022-05",
        sessionLabel: "May 2022",
        colIndex: 3,
        title: "Terminate Debate on Article 8",
        description: "...",
        isTerminateDebate: true
      },
      ...
    ],
    members: {
      "abramowitz, neil|1": {
        "2022-05::2": "YES",
        "2022-05::3": "NO",
        ...
      },
      ...
    }
  },
  ...
]
```

### 3.2 Detect Terminate Debate votes

A vote is a "Terminate Debate" motion if its title (case-insensitive) contains the substring `"terminate debate"`. Flag these in the data structure. They will be handled separately (see §3.4).

### 3.3 Build the unified member list

Collect all unique canonical member keys across all sessions. For each member, record:
- Display name and precinct from the **most recent session they appear in**, using `SESSION_FILES` chronological order as the tie-breaker
- Which sessions they appeared in
- Their full vote vector across all sessions

### 3.4 Build the numeric matrix

Create a matrix where:
- **Rows** = members (only those appearing in at least N sessions — see §5 for the threshold control)
- **Columns** = all vote columns across all sessions

Encoding:
| Vote | Value |
|------|-------|
| YES | +1 |
| NO | -1 |
| ABSTAIN | 0 |
| No Vote / absent | `NaN` (missing) |

**Terminate Debate weighting:** Multiply all Terminate Debate vote values by a weight factor (default **0.5**). This means they still contribute to the clustering but have half the influence of substantive votes. Expose this as a slider in the UI (range 0.0 to 1.0) so the user can tune it or zero it out entirely.

### 3.5 Handle missing data

Members who didn't attend a session will have `NaN` for every vote in that session. Before running PCA:

1. **Drop columns** where fewer than 20% of the included members have a non-NaN value (these votes provide no useful signal).
2. **Drop rows (members)** using the "minimum sessions attended" threshold only (see §5).  
3. **Impute remaining NaN values** with 0 (i.e., treat isolated missing votes as neutral). This is the simplest defensible approach and avoids pulling absent members toward any pole.
4. Keep both versions of the matrix:
   - `matrixRawWithNaN` for similarity/agreement calculations
   - `matrixImputed` for PCA only

---

## 4. Dimensionality reduction — PCA

Use **Principal Component Analysis** to project the high-dimensional vote matrix down to 2 dimensions for plotting.

### Why PCA (not UMAP, t-SNE, etc.)
- PCA is deterministic — same data always produces the same plot. Users won't be confused by different layouts on reload.
- PCA is simple to implement from scratch (just SVD of the centered matrix) with no library dependency.
- The axes are interpretable — PC1 often corresponds to the dominant ideological split, which is exactly what we want to show.
- For ~250 members × ~300 votes, PCA runs in milliseconds.

### Implementation

You have two options:

**Option A — Use ml.js (recommended if adding a dependency is OK):**
```html
<script src="https://cdn.jsdelivr.net/npm/ml-pca@4.1.1/lib/index.min.js"></script>
```
Feed it the imputed matrix, extract the first 2 components.

**Option B — Implement from scratch:**
1. Center each column (subtract column mean from every value).
2. Compute the covariance matrix (or use SVD directly on the centered matrix).
3. Extract the two eigenvectors with the largest eigenvalues.
4. Project each member's vote vector onto these two eigenvectors to get (x, y) coordinates.

A clean SVD implementation in ~50 lines of JS is feasible. Alternatively, use the power iteration method for just the top 2 components, which is even simpler.

**Whichever you choose**, normalize the output coordinates to a [-1, 1] range for consistent plotting.

### Variance explained

Compute and display the percentage of variance explained by PC1 and PC2 (e.g., "PC1 explains 18% of variance, PC2 explains 9%"). Show this as axis labels on the plot. This tells the user how much of the voting pattern is captured in the 2D view.

---

## 5. User interface

### 5.1 New tab

Add a third tab button: **"Voter Clustering"** alongside the existing "View by Vote" and "View by Member" tabs. When this tab is first activated, it triggers the multi-session data load (show a progress indicator as each spreadsheet loads).

### 5.2 Controls (above the plot)

| Control | Type | Default | Purpose |
|---------|------|---------|---------|
| Sessions to include | Multi-select checkboxes (one per session) | All checked | Let user include/exclude specific sessions |
| Minimum sessions | Dropdown: 1..8 (cap at number of selected sessions) | 2 | Only include members who appeared in at least this many of the selected sessions |
| Terminate Debate weight | Slider, 0.0–1.0, step 0.1 | 0.5 | How much influence Terminate Debate votes have (0 = ignore them, 1 = equal weight) |
| Color by | Dropdown: "Precinct", "Number of sessions attended", "None" | Precinct | What determines dot color |

When any control changes, recompute the matrix, re-run PCA, and re-render the plot. This should be fast enough to feel instant (<200ms for this data size).

### 5.3 The scatter plot

Use **Plotly.js** via CDN (`https://cdn.plot.ly/plotly-2.27.0.min.js`). Plotly gives us hover tooltips, zoom, pan, and lasso select for free.

- **Each dot** = one Town Meeting member
- **X axis** = PC1 (label: "Component 1 (X% variance)")
- **Y axis** = PC2 (label: "Component 2 (Y% variance)")
- **Dot size** = fixed (medium), or optionally scaled by number of sessions attended
- **Dot color** = based on "Color by" control:
  - **Precinct mode:** Each precinct gets a distinct color. Use a categorical palette with enough colors for ~16 precincts + AL. Show a legend.
  - **Sessions attended mode:** Color by count on a sequential scale (light = few sessions, dark = many).
  - **None:** All dots same color.
- **Hover tooltip:** Show member name, precinct, number of sessions attended, and number of votes cast.
- **Click interaction:** When a dot is clicked, display a detail panel below the chart showing that member's full voting summary (similar to the existing "View by Member" display, but aggregated across the selected sessions). Alternatively, just auto-select that member in the existing "View by Member" tab — up to the implementer which feels more natural.

### 5.4 Supplementary panel: "Nearest neighbors"

Below (or beside) the scatter plot, show a small panel:
- When a member dot is clicked, list the **10 most similar members** (by Euclidean distance in the full vote space, NOT just the 2D projection) along with their agreement percentage.
- Compute neighbor distance on **co-voted dimensions only** (exclude columns where either member has `NaN`; use weighted numeric values for non-missing votes).
- Agreement % = (number of votes where both members voted and voted the same way) / (number of votes where both members voted). Exclude votes where either member has NaN.
- If two members have zero overlapping voted columns, set agreement to `N/A` and rank them after all members with overlap.

### 5.5 Supplementary panel: "Axis interpretation"

Show a small box that helps interpret what the axes mean:
- For PC1 and PC2, list the **5 articles with the highest positive loading** and the **5 articles with the highest negative loading**. Display them as:
  ```
  ← Left side: Article 15 (Nov 2023), Article 8 (May 2024), ...
  → Right side: Article 22 (May 2023), Article 3 (Nov 2022), ...
  ```
- This tells the user "members on the left of the plot tended to vote YES on these articles and NO on those" (and vice versa for the right).

---

## 6. Styling

Match the existing app's visual language:
- Same font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`)
- Same card container with `border-radius: 12px` and `box-shadow`
- Same control styling (select dropdowns, checkboxes, labels)
- Same color palette (#2c3e50 for headings, #3498db for accents, #f8f9fa for backgrounds)
- The scatter plot should fill the available width (up to `max-width: 1400px`) and be about 600px tall
- Controls should use the same `flex` + `gap` layout as the existing `.control-group`

For the slider (Terminate Debate weight), style it with CSS to match the blue accent color. Show the current value next to it.

---

## 7. Performance considerations

- **Parallel fetch:** Load all 8 spreadsheets with `Promise.all`. Show a progress counter ("Loading 3 of 8...").
- Implement progress with a shared counter incremented in each task's `finally`, then update the clustering loading element after each completion.
- **Cache parsed data:** Once the multi-session data is loaded, cache it in a global variable. Don't re-fetch when the user toggles sessions on/off — just recompute the matrix from cached data.
- **Debounce control changes:** If the user drags the slider, debounce the recompute to avoid running PCA on every intermediate value. 200ms debounce is fine.
- **Matrix size:** Worst case is ~250 members × ~320 votes. PCA on a 250×320 matrix is trivial in JS — no web worker needed.

---

## 8. Code organization

This is a single-file HTML app. Keep it that way. Add the new code in clearly commented sections:

```
/****************************************************
 * VOTER CLUSTERING — DATA LOADING
 ****************************************************/

/****************************************************
 * VOTER CLUSTERING — MATRIX BUILDING
 ****************************************************/

/****************************************************
 * VOTER CLUSTERING — PCA
 ****************************************************/

/****************************************************
 * VOTER CLUSTERING — RENDERING
 ****************************************************/
```

Add the Plotly CDN script tag in `<head>` alongside the existing XLSX script tag.

Reuse the existing `loadVotingDataFromExcel()` parsing logic — factor it into a helper that takes a URL and returns parsed data, so both the single-session views and the clustering view can use it.

---

## 9. Edge cases to handle

1. **Member appears with slightly different name formatting across sessions** — The exact-match strategy means they become two dots. This is acceptable. Don't try to fix it.
2. **Session with very few votes (e.g., Nov 2025 has only 19)** — Still include. More votes = more signal, but even 19 votes contribute.
3. **Member attended only 1 session and "Minimum sessions" is set to 1** — They'll have NaN for most of the matrix. After imputation (NaN→0), they'll cluster near the center. This is correct behavior — we don't have enough data to place them confidently.
4. **All votes in a column are the same (unanimous)** — After centering, this column becomes all zeros and contributes nothing to PCA. This is fine — it automatically gets ignored.
5. **Terminate Debate weight set to 0** — These columns get multiplied by 0 and become all zeros after centering. Equivalent to dropping them. This is correct.
6. **Two members share no co-voted columns** — Exclude from distance-based nearest-neighbor ranking unless needed as fallback; display agreement as `N/A`.

---

## 10. Testing checklist

- [ ] All 8 spreadsheets load successfully in parallel
- [ ] Member matching works: a member in 6 of 8 sessions appears as one dot, not six
- [ ] Terminate Debate votes are correctly identified (check a few manually)
- [ ] Changing the weight slider from 1.0 to 0.0 visibly changes the plot (some members shift)
- [ ] Changing "Minimum sessions" from 1 to 5 reduces the number of dots noticeably
- [ ] Unchecking a session checkbox and re-rendering works without errors
- [ ] Hovering a dot shows the correct member name and precinct
- [ ] Clicking a dot shows the nearest-neighbors list with plausible names
- [ ] Members with no overlap display `N/A` agreement and are ranked below members with overlap
- [ ] The "axis interpretation" panel shows real article titles, not undefined or blank
- [ ] The plot looks reasonable: not all dots in a single clump, and not randomly scattered. There should be some visible structure (likely a spectrum or 2-3 clusters).
- [ ] Precinct coloring shows a legend and uses distinguishable colors
- [ ] The existing two tabs ("View by Vote", "View by Member") still work exactly as before
- [ ] Mobile: controls stack vertically, plot is scrollable

---

## 11. Libraries to add

```html
<!-- Add to <head>, alongside the existing XLSX script -->
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
```

Plotly is required for rendering. No additional libraries are required for PCA.  
If preferred, PCA can still be implemented with an optional helper library:
```html
<script src="https://cdn.jsdelivr.net/npm/ml-matrix@6.10.4/matrix.umd.min.js"></script>
```
(ml-matrix provides SVD, which makes PCA a 5-line implementation.)

---

## 12. Summary of deliverables

The implementer should produce a single modified `TMMvotes.html` file that:

1. Retains all existing functionality unchanged
2. Adds a "Voter Clustering" tab with the controls described in §5.2
3. Loads all sessions in parallel when the tab is first activated
4. Builds the weighted, imputed vote matrix per §3
5. Runs PCA per §4 and renders an interactive Plotly scatter plot per §5.3
6. Shows nearest-neighbors and axis-interpretation panels per §5.4–5.5
7. Matches the existing visual style per §6
