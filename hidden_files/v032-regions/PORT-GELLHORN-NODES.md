# Port Gellhorn nodes — Finding 4 (v0.32 regions-fix, lane 4)

**Verdict: MERGE.** The guides' "Port Gellhorn, Kelly County" IS the
catalogue's "Port Gellhorn" town — same place, county-qualified naming.
The six Port Gellhorn gang ops now draw the town extent instead of the
whole Kelly County rect. Implemented in the gang-op resolution only
(`areaIdForGangOpRegion`, `src/features/map/likely-area.ts`); the
guides' words are untouched (`record.region` stays
"Port Gellhorn, Kelly County") and no extent was invented.

Note: `hidden_files/v032-demos/DEMOS-GANGOP.md` (cited in the brief)
does not exist in this checkout — the Finding-4 numbers below (2 / 16 /
18 / 3, 8 ops on the Kelly rect) were re-verified independently from
the code and the pinned snapshot instead of taken from that file.

## 1. What the two nodes are

All node facts below are from `deriveAreaNodes` over the pinned
`gtadb-landmarks-2e9e194.json` snapshot (4,380 records), via
`buildGameDatabase({ places: catalogueFromSnapshot(snapshot) })` —
the same construction the gang-op tests use.

### The catalogue town — `area:port-gellhorn`

- **Level town, parent `county:kelly`** (plurality vote of its
  positioned members over the `counties.ts` rects), `path`
  "Port Gellhorn", `children: []`.
- **337 member places, 335 positioned.** The 333 GTADB records
  addressed "X, Port Gellhorn" are its direct members (a record's
  region is its address minus its first part, so "La Cascara Motel,
  Port Gellhorn" files under the town itself). The other members are
  the street-addressed stragglers ("Moonstone Hwy, Port Gellhorn",
  "Interstate 404, Port Gellhorn") and the region place.
- **Bounds (own extent, member-bbox padded 12% / ≥200):**
  `{ west: -8213.50, east: -5403.48, south: 1829.86, north: 5730.995 }`
  — about 2,810 × 3,901 map units. (Its north edge, 5731, pokes
  slightly past the Kelly rect's north edge, 5626: the town extent
  is a padded member bbox, the county rect is a separate estimate.
  Both are labelled estimates; the town extent is still far tighter
  than the county rect.)
- **Source:** a `TOWN` region place in
  `src/features/street-leonida/page-data.ts` ("Officially named
  western/coastal settlement…"), and DESIGN §6.1 lists Port Gellhorn
  under Town. `geography.ts:117` already records that the step-1 rule
  wrongly made the qualified node a city too.
- `counties.ts` corroborates the county: the Kelly entry describes
  itself as `area: 'West · Port Gellhorn, Hamlet'` — the county's own
  record names Port Gellhorn as its western town.

### The guides' node — `area:port-gellhorn--kelly-county`

- **Level town, parent `county:kelly`, `children: []`, bounds null.**
- **7 members, 0 positioned:** the six Port Gellhorn gang ops
  (Kingpin Bowling, June Warehouse, La Cascara Motel, Brooks
  Boatworks, Stash House, Backroom Weed Front) plus
  `gym:starlet-motel-bench`.
- It exists **only because app-authored places carry the region
  string "Port Gellhorn, Kelly County"**. Zero GTADB records use it:
  0 of the 4,380 raw snapshot addresses contain both "Port Gellhorn"
  and "Kelly County", and the town's 333 places are all addressed
  "X, Port Gellhorn". (The 7 places with that region string in the
  built catalogue are exactly the 6 ops + the 1 gym.)
- With no positioned members, `resolveAreaBounds` fell back to its
  parent `county:kelly` — hence all six ops drew the Kelly rect
  `{ west: -9382, east: -3023, south: 596, north: 5626 }`
  (6,359 × 5,030), shared with Gas Station Meth Front and Walker
  Farm: 8 ops on one rect.

### Why the nodes were never merged before

The hierarchy's rule is structural, not semantic: the FULL parsed
region path is the area, so "Port Gellhorn, Kelly County" (2 segments)
is a different node from "Port Gellhorn" (1 segment), and its parent
is the path minus its first segment (`county:kelly`) — never the town.
That rule is correct in general (see §4: it must stand for the Vice
City neighbourhoods and for genuine sub-areas like Starlet Motel),
so the merge belongs in the gang-op resolution, not in
`areaIdForRegion` or `deriveAreaNodes`.

## 2. Evidence the guides' string IS the town

1. **The town is the only Port Gellhorn node with positioned
   members.** The qualified node has none and is an artefact of the
   guides'/app's county-qualified addressing. There is no second
   Port Gellhorn anywhere in the data to confuse it with.
2. **GTADB never qualifies it.** 0/4,380 records address a place
   "Port Gellhorn, Kelly County"; 333 address places "X, Port
   Gellhorn". The qualified form is a guides convention, not a
   catalogue place.
3. **The qualifier adds no information.** The town's county parent,
   voted from its own positioned members, is Kelly — the exact county
   in the guides' qualifier. "Port Gellhorn, Kelly County" says
   nothing the bare town doesn't already say.
4. **The area leads name town landmarks, all inside the town
   extent:** "Port Gellhorn, west of the Delights Cabaret"
   (Delights = GTADB L629, "Delights, Port Gellhorn"); "Port
   Gellhorn, north of the Pay 'n' Spray" (Brooks Boatworks);
   "Port Gellhorn, west side, northeast of Wild Hog Point" (Wild Hog
   Point = L3434, "Wild Hog Point, Kelly County", at [-7562, 3276] —
   inside the town bounds); "Pearl House Hair Salon, south Port
   Gellhorn" (Backroom Weed Front). Every lead is town-relative.
5. **The app's own gym data uses the qualified form for the town:**
   `gym:starlet-motel-bench`, region "Port Gellhorn, Kelly County",
   is "free weights by the motel pool in Port Gellhorn… The motel
   itself is on the map as Starlet Motel (GTADB L304)" at
   [-5365, 3476] — inside the town bounds. (The gym's own areaId is
   untouched by this lane: the merge is gang-op resolution only.)
6. **No counter-evidence.** No source — guide, GTADB record, or
   county entry — names a second, distinct place "Port Gellhorn" in
   Kelly County, or places any of the six ops outside the town.

## 3. Resolution trace — Brooks Boatworks

Before (measured, pre-merge probe):

```
region "Port Gellhorn, Kelly County"
  → parseRegionPath → ["Port Gellhorn", "Kelly County"]
  → areaIdForPathSlugs → area:port-gellhorn--kelly-county
  → node: 7 members, 0 positioned, bounds null, parent county:kelly
  → resolveAreaBounds → fallback 'county', Kelly rect
  → kind 'county', label "Brooks Boatworks · likely area — Kelly County extent (estimate)"
```

After (this lane):

```
region "Port Gellhorn, Kelly County"  (unchanged — guides' words kept verbatim)
  → areaIdForGangOpRegion → area:port-gellhorn  (county-qualified town redirect)
  → node: 337 members, 335 positioned, bounds = town extent, parent county:kelly
  → resolveAreaBounds → fallback 'none', "The area's own extent."
  → kind 'own', countyName null, label "Brooks Boatworks · likely area"
```

Unchanged by the merge: the place's `areaId` stays
`area:port-gellhorn--kelly-county` (game-db / global resolution
untouched — asserted in `tests/unit/gang-operations.test.ts`), the
place stays `position: null` / `area-known`, and the Ask answer is
verbatim unchanged (verified against `retrieveForAsk`):

> "Brooks Boatworks is a Kolts & Associates illegal operation in Port
> Gellhorn, Kelly County — north of the Pay 'n' Spray. It has no
> verified position, so it can't be pinned on the map — the safe code
> is 6823."

(The Ask text is built from `record.region` + `record.areaLead`,
never from the resolved area id.)

## 4. Cross-op pattern check — why Port Gellhorn fell back while others got own-bounds

Full 39-op table (measured pre-merge; only the 6 Port Gellhorn rows
change after):

- **Own-bounds (16)** resolve to nodes with positioned GTADB members:
  single-segment towns/cities (Ambrosia 181 members, Vice City 1170,
  Key Lento 263) or multi-segment neighbourhood nodes whose own
  GTADB records address them that way ("Stockyard, Vice City" 50,
  "La Perle, Vice City" 62, "Southside, Vice City" 102,
  "Little Cuba, Vice City" 76, "Balsero, Vice City" 54,
  "Salton, Vice City" 153).
- **County-fallback (18)** resolve to nodes with **zero** positioned
  members: the qualified town-in-county nodes, whose only members are
  the unpositioned gang-op places themselves — Port Gellhorn (7
  members / 0 positioned), Grassrivers (2 / 0), Hamlet (1 / 0),
  Watson Bay (3 / 0), Emerald Springs (1 / 0), Frogswater (1 / 0) —
  plus the 4 ops whose region IS a county (Mariana, Lummox ×2,
  Leonard ×2 — the county rect is the named area itself).
- **No-extent (3):** Fishing Shacks ("Wetman Bay, Grassrivers"),
  Chatfield Storage & Logistics ("Waxman Island"), Vespucci Mansion
  ("Vespucci Island") — named areas with no positioned members and no
  county parent to fall back to.

**Why Port Gellhorn specifically:** it is purely which addressing
convention the source data uses for that area. GTADB addresses Port
Gellhorn places bare ("X, Port Gellhorn"), so the town node
accumulates 335 positioned members while the qualified node
accumulates only app-authored unpositioned places. For Vice City
neighbourhoods GTADB addresses places 3-part ("X, Neighbourhood,
Vice City"), so the multi-segment node itself accumulates positioned
members and resolves own-bounds. Same hierarchy rule, different
source convention — not a difference in the places themselves.

### Same qualified-vs-bare shape elsewhere — NOT merged in this lane

| Region (op) | Bare node | Bare members / positioned | Bare bounds | Bare parent = qualifier? |
|---|---|---|---|---|
| Grassrivers, Mariana County (Manatee Motel) | `area:grassrivers` | 3 / 2 | yes | `county:mariana` = qualifier |
| Hamlet, Mariana County (M7 Compound) | `area:hamlet` | 185 (bounds present ⇒ positioned members exist) | yes | `county:mariana` = qualifier |
| Watson Bay, Mariana County (×3 ops) | `area:watson-bay` | 78 (bounds present ⇒ positioned members exist) | yes | `county:mariana` = qualifier |
| Emerald Springs, Kelly County (Gas Station Meth Front) | `area:emerald-springs` | 7 (L1111, L1627, L1778, L1779, L2889, L2899, L3812; bounds present) | yes | `county:kelly` = qualifier |
| Frogswater, Kelly County (Walker Farm) | — none — | — | — | cannot merge |

These four have the same evidence shape as Port Gellhorn (bare town
with its own extent whose county parent is the qualifier; qualified
node with no positioned members). Generalising the redirect would
move 6 more ops county → own (Manatee Motel, M7 Compound, Palmer
Fishing Warehouse, Watson Bay Safehouse, Mill Station Radar Base,
Gas Station Meth Front), taking the split to 28 own / 6 county and
leaving Walker Farm alone on the Kelly rect. **Deliberately not done
here:** the brief scopes this lane to Port Gellhorn (and its expected
Kelly stayers are Gas Station Meth Front + Walker Farm). Coordinator
decision needed — the evidence for the same merge is recorded here,
the code change is not made.

### Why the merge is NOT a general "X, County → X" rule

The qualified form is genuinely a different place in other cases,
so a global rule would be wrong:

- **Starlet Motel:** "Starlet Motel, Kelly County" (L1159, the pool,
  positioned) is a real sub-area node
  `area:starlet-motel--kelly-county` with its own positioned member
  and its own bounds — distinct from any bare Starlet Motel. Same
  for Goliath, Zephyr Islands, Draper Island, Millport
  (3-part GTADB addresses "X, Goliath, Mariana County" etc.).
  The one GTADB record with region "Grassrivers, Mariana County"
  (L1457, Fracking Site) is unpositioned — which is why that
  qualified node has no bounds.
- **Vice City neighbourhoods:** "La Perle, Vice City" (62 members)
  and bare `area:la-perle` (59 members) have **different** bounds
  (west -1579.72 vs -1423.95) — genuinely different nodes; the
  full-path rule must stand there.

That is why the redirect is a named, single-region mapping in the
gang-op resolution only, gated on the town node existing, with a
fallback to the qualified id when it doesn't.

## 5. What changed (before / after, measured)

| | Before | After |
|---|---|---|
| Hosted | 2 | 2 |
| Own-bounds | 16 | **22** (+6 Port Gellhorn) |
| County-fallback | 18 | **12** |
| No-extent | 3 | 3 |
| Drawn regions | 34 | 34 |
| Grouped rects | 13 | **14** |
| Kelly County rect ops | 8 | **2 — Gas Station Meth Front, Walker Farm** |
| Port Gellhorn town rect ops | — (did not exist) | **6** (Kingpin Bowling, June Warehouse, La Cascara Motel, Brooks Boatworks, Stash House, Backroom Weed Front) |
| Mariana rect ops | 6 | 6 (unchanged) |
| Lummox rect ops | 2 | 2 (unchanged) |
| Leonard rect ops | 2 | 2 (unchanged) |

Rects that change (lane 1 + demo lane: measure on the final tree):

- **NEW rect — Port Gellhorn town extent (own):**
  `{ west: -8213.502793266167, east: -5403.483414978226,
  south: 1829.856884400902, north: 5730.9954744969755 }`,
  carrying the 6 ops above, label
  "Kingpin Bowling · June Warehouse · La Cascara Motel · Brooks
  Boatworks · Stash House · Backroom Weed Front · likely area".
- **Kelly County rect (county, unchanged geometry):**
  `{ west: -9382, east: -3023, south: 596, north: 5626 }`,
  now carrying only Gas Station Meth Front + Walker Farm, label
  "Gas Station Meth Front · Walker Farm · likely area — Kelly County
  extent (estimate)".
- **No other rect changes.** Every other op's resolved area id, kind,
  bounds and group are byte-identical before/after (verified by
  diffing the full 39-row measurement pre- and post-merge).

## 6. Implementation + verification

- `src/features/map/likely-area.ts` — `areaIdForGangOpRegion`:
  named redirect `area:port-gellhorn--kelly-county` →
  `area:port-gellhorn` when the town node exists; module docstring
  updated (8 ops → 2 on the Kelly rect). Commit `3b1060c49`.
- `src/features/map/layers.ts` — layer description split 16 / 18 / 3
  → 22 / 12 / 3 (same commit; the description is asserted against
  the live measurement).
- `tests/unit/gang-op-likely-area.test.ts` — counts, Brooks
  own-bounds assertions (incl. exact town bounds), the 14-rect /
  2-op Kelly / 6-op town grouping, scope guards (Grassrivers and
  Emerald Springs still county; qualified id returned unchanged when
  the town node is absent). Commit `67e105a49`.
- Verification: `tsc --noEmit` clean; `eslint` 0 errors on the touched
  files; full `vitest run`: 1344 passed + 5 failed, all 5 being 5000ms
  timeouts under parallel load (backup-v4, card-matcher,
  completion-record, step6-collections-progress,
  street-leonida-world-life) — all 5 files pass 81/81 when run on
  their own, so the suite is 1349/1349 on substance and none of the
  flakes touches gang-op / geography / Ask code. Targeted run
  (gang-op-likely-area, ask-nylah, gang-operations, geography):
  110/110 pass. `tests/unit/ask-nylah.test.ts` Brooks tests pass and
  the answer is verbatim unchanged (§3). Prettier: the three touched
  source/test files carry the same pre-existing deviations at base
  HEAD (identical diff counts before/after) — no new formatting
  issues introduced, no whole-file reformat.
- Deliberately untouched: `src/data/gang-operations.ts` (no
  `areaLead`/`region` edits), `src/domain/geography.ts`,
  `src/domain/game-db.ts` (place areaIds, area membership and the
  area pages are unchanged), no version bump, no deploy, no release
  entries. Live stays v0.31.5.

## 7. Open question for the coordinator

Generalise the redirect to Grassrivers / Hamlet / Watson Bay /
Emerald Springs (6 more ops county → own, split 28 / 6, Kelly rect
down to Walker Farm alone)? The evidence shape is identical to Port
Gellhorn's; the call is a scope decision, not an evidence gap.
Frogswater (Walker Farm) has no bare node and stays county either
way.
