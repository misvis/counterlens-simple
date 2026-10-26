# CounterLens Simplified

A classroom AI ethics prototype with a React interface, a small Fastify API, and a local MongoDB database. The current priority is a working local demo and presentation workflow.

The public [GitHub Pages demo](https://misvis.github.io/counterlens-simple/) remains independently deployable. It cannot run the API or database.

## Student workspace

- **Policy Studio** uses a dropdown for Academic Focus, Holistic Review and Income Support; **Admission Threshold** changes its cutoff for all students.
- **Counterfactual Visualizer** shows student outcomes on fixed GPA (horizontal) and SAT Percentile (vertical) axes, grouped by columns, rows and additional sections. Only the selected student's current group shows their exact cutoff. No PCA projection is used.
- Use the Admission Threshold slider to adjust the cutoff. The plots, cohort outcomes, group rates, and confusion matrix stay in sync. Direct boundary dragging remains implemented in the hidden Background band view.
- **Counterfactual Editor** changes a hypothetical profile without changing the cohort. It keeps GPA/SAT controls and edits all six Explorer backgrounds with categorical dropdowns and numeric ZIP-area income. Gold highlights identify nearby edge cases; purple identifies counterfactual edits. **Group Outcomes** compares cohort admission rates for every category of the same six backgrounds.
- Click a student or choose one from the list, then use the editor to try hypothetical GPA/SAT and background values. The original stays in place, and hypothetical profiles leave cohort records, group rates, and the confusion matrix unchanged. Use Reset to restore the selected student's original values. Direct point dragging remains implemented in the hidden Background band view.
- **Confusion Matrix**, next to the threshold slider, compares cohort decisions with fixed reference outcomes. Rows are admitted/not admitted; columns read **Meets benchmark / Below benchmark** for the dataset's positive/negative labels. The benchmark is separate from the adjustable admission threshold. Each cell shows its count and a bar scaled by all labeled samples. The footer shows total samples and, when labels are missing, how many were included. Counts update with the policy and cutoff, while hypothetical profile edits leave cohort counts unchanged. Label provenance is explained in the help popup.

The `synthetic-1973-v2` release adds a boolean `referenceOutcome` with role `outcome`, separate from policy inputs. It preserves the previous 72 GPA/SAT/background profiles. Reference labels follow the original prototype's demonstration formula: `18 * GPA + 20 * SAT / 1600 + noise > 72`, with noise in `[0, 15)` from a separate seeded stream (2026). These are simulated labels, not observed performance or evidence of fairness. Future approved releases can provide a boolean outcome feature allowed for comparison; the matrix uses it only when there is exactly one such feature. Missing labels are excluded and coverage is shown. Without a reference field, the matrix shows an unavailable state rather than invented counts.

Light and Dark themes and English, Chinese, and Spanish are available. Dark uses the existing Graphite palette. The Summer palette is retained in the code but hidden from the theme switch. The public build works without an API; collecting events or questionnaire answers requires a separately running backend.

## Feature explorer prototype (updated 2026-10-26)

Release snapshot for 2026-10-26: the active workspace uses the six-background Feature Explorer, 200 simulated records, Rows-before-Columns grouping controls, three policy presets, stable editor/profile layouts and the external circular magnifier. The final magnifier and parameter footer use fully opaque Light/Dark surfaces. The release check passed all 113 tests, MongoDB integration and the production build, with four existing Hook warnings and no errors. GitHub Pages serves the static demo; backend services and classroom data remain local.

The student workspace now opens **Feature explorer (prototype)** by default at `http://127.0.0.1:5173/`. Feature facets (WIT-style) has been removed. Background comparison and Background band are hidden, and the Visualizer view selector and its adjacent information button have been removed. Older URLs with a `visualizer` parameter also open Feature explorer.

- Synthetic records receive deterministic attributes for **Ethnicity, Residency, ZIP-area income, Major, Transfer status, and Math status**. The six-background policies below use these attributes. The active Explorer preview expands the canonical synthetic release from 72 to **200** records, preserving every original record and adding S73–S200 with the same seeded generators. The adapter accepts the raw release or its SAT percentile projection, carries explicit browser-only preview provenance, and leaves real, changed or unfamiliar datasets untouched. Database releases and classroom bindings remain unchanged. The visible Simulated data/rules badges are removed; provenance remains in the data and policy details.
- Axes are fixed to GPA horizontally and SAT Percentile vertically, without axis selectors. **Rows / Columns / Add sections** share a compact horizontal toolbar that wraps on narrow screens, with row controls first to match the labels on the left. Both Rows and Columns default to None. The resulting single plot fills the available desktop height above the threshold and confusion matrix, with its SVG measured from the layout. **Sections** accepts multiple additional fields; each combination repeats the same row/column matrix. Multiple panels keep compact 220px plots in a scrollable matrix. Every selected combination is rendered, including empty combinations, with no chart-count limit. Row labels align toward the plots, with a column measured from their text up to the original 102px width and a 6px grid gap. Short groups use less width; Hispanic/Latino stays on one line, and longer names wrap naturally without forced character breaks.
- **Reset**, before Rows, restores the initial grouping view: Rows/Columns None, no sections, all categories available and the default three fixed income bins. It also closes disclosures and the magnifier, clears picker searches and resets matrix scrolling. The current student, draft, policy, threshold and case highlighting remain unchanged; the editor and threshold retain their separate reset controls.
- Each active grouping field opens category selection. ZIP-area income represents the ZIP code's median household income, not an individual student's household income; its demo values are simulated. It supports fixed, cohort-wide quantile and custom monetary bins. Income ranges are half-open, with explicit missing groups when needed. Changing displayed categories does not recompute quantile boundaries or change the global cohort.
- Category and axis scales stay shared across all panels. Grouping changes the display, never an actual student's score. A compact student picker and its six background values share one fixed-height row. The text follows the current hypothetical profile, highlights changed values in purple, and keeps exact income amounts. Long values scroll horizontally within the summary and retain their field names in tooltips and accessible labels. Selecting or clearing a student does not add a row or resize the chart. Original and edited markers appear only in their matching groups. The cutoff uses the selected student's current profile directly without overriding any fields from the panel context.
- The right editor uses the six Explorer fields instead of First-gen/Athletics controls. All six backgrounds contribute under Holistic Review and Income Support; Academic Focus ignores them. Income edits commit an actual nonnegative dollar amount on blur or Enter; blank input restores the committed value, invalid input does not change the profile, and Reset restores all fields. Income remains a background and grouping field. Legacy First-gen, Athletics and boolean resident fields do not contribute to these policies.
- The editor keeps the same form and height with or without a selected student. Empty values show em dashes with controls disabled, without an invented prediction. Each background field reserves one compact helper line so original-value comparisons and income errors do not expand the card; long text keeps its full value in the tooltip.
- **Group Outcomes** lists each of the six dimensions with per-category admitted/total counts and rates. ZIP-area income shares the exact bin settings with the plot. Empty groups show an em dash rather than a 0% rate. Statistics always use the complete original cohort, independently of visible plot categories and hypothetical edits, and update with the policy or threshold.
- The demo uses one mutually exclusive Major and one nominal Math status per student. Categories follow the supplied dataset schema below; the records and scoring coefficients remain simulated. Math status is not a course name or an attainment ranking. Supporting multi-major or multi-status records would require an explicit overlap/counting definition.
- Only the panel matching the current selected profile (edited draft when present) shows one solid cutoff, calculated from that profile's exact six background values. Other panels keep their cohort points without a cutoff. Background edits update the line directly; changing a grouping value moves it to the matching panel without retaining the old line. No range bands or shading are shown. No selection, a filtered-out current group or an off-chart cutoff produces no fabricated line. Grouped income still uses the student's actual amount for the cutoff, without substituting a bin median. Earlier per-panel representative helpers remain isolated from the active UI.
- Hover or focus a point to inspect its neighborhood in a 196px circular 4× magnifier and select nearby records. It opens to the right of the source plot, with an opaque background, fine crosshair and compact two-line ID/outcome and GPA/SAT footer. There is no heading or sample list. Placement remains fixed while its contents follow the pointer; constrained viewports use another available outer side or a smaller circle. Only when no external strip exists does it use a bounded corner fallback. Pointer updates are coalesced once per animation frame in an independent lens component, leaving original plot marks untouched; geometry is cached only while scroll/resize invalidation is active. Pointer clicks at exactly overlapping coordinates cycle through those records; keyboard selection targets the focused record without changing plotted coordinates. Escape, scrolling, resizing and source changes close the lens. The magnifier follows the source plot's cutoff visibility and does not add cohort records. The selected/original and edited point rings remain, while the visible Group cutoff / Original legends and plot caption are removed. Group Outcomes expands its card to contain all six feature groups and uses the surrounding sidebar's scroll area.
- Controls omit policy reminders, repeated coordinate captions and visible plot-count labels. English, Chinese and Spanish labels remain available. This design follows the separation of binning and scatter controls in the [What-If Tool tutorial](https://pair-code.github.io/what-if-tool/learn/tutorials/customize-datapoints/) and its distinction between [analysis fields and model inputs](https://pair-code.github.io/what-if-tool/learn/tutorials/non-input-features/). Local implementation does not establish public deployment or a learning benefit.
- Opening the workspace selects the displayed cohort's student closest to the active policy cutoff (currently S129 under Academic Focus at 62) and initializes the editor from that original profile. Loading an API copy of the same data preserves the current selection, edits and threshold, including an explicit clear; genuinely different data gets its own initial selection. Empty or unscorable cohorts remain unselected. This initialization does not run again when policy, threshold or grouping changes.
- Clicking plot background, axes or matrix gaps clears the student, draft, cutoff and magnifier. Student marks, the draft marker and controls retain their own interactions. GPA/SAT edits show one draft marker at its actual coordinates, with a dashed original-to-draft connector when both points belong to the same panel. Background-only edits and cross-panel moves do not create an artificial connector; Reset removes the draft and connector. Row labels share the plot surface color and retain opaque backing while scrolling.
- Cross-panel edits put the same student ID in each endpoint plot's existing top margin, with the original solid blue ring and hypothetical dashed purple ring. Clicking either compact marker, or pressing Enter/Space, reveals and focuses its counterpart while retaining the selection and draft. The matrix accounts for sticky row labels; narrow layouts also reveal the target vertically in the page. A filtered counterpart leaves one inactive marker without changing filters. Same-panel edits, Reset and deselection remove the pair markers. No connecting line crosses other plots, and marker IDs do not count as cohort records.
- Enabling **Mine Edge Cases** only highlights the eight nearest cases and puts them first in the student picker in increasing absolute score-to-cutoff distance, followed by other students in source order. It never selects a student or replaces an existing draft; choose a case from the picker or plot. Threshold changes refresh this ranking while retaining the current student and edited background. Turning mining off restores source order and keeps that selection and draft. Policy selection retains its existing behavior of closing mining, keeps the current student and edits, and uses the new policy's default threshold. Picker sorting never reorders the cohort or chart marks.

Boundary rationale (2026-10-26): under Holistic Review, S25 and S84 both have GPA 3.24 and SAT percentile 82, but their different backgrounds produce scores 52.909576 and 56.70164 around cutoff 55. No GPA–SAT-only boundary can explain both outcomes at that shared position. The default selected sample preserves the existing conditional line semantics. For a genuinely global separator, the current additive model can be represented exactly by academic points A and background points B with A+B=55, or a 3D plane in normalized GPA/SAT/background-score coordinates. Such a score-space overview changes the axis interpretation and has not been enabled. Academic Focus has a shared GPA–SAT separator because it assigns no background points. The active UI still shows only the selected profile's line.

Earlier automatic-selection validation, before manual case selection: `npm run check` passed 95 tests and the production build, retaining four existing `src/App.jsx` Hook warnings and no errors. Browser checks confirmed S153 selected on load with one cutoff; changing cutoff to 56 kept S153, then mining selected S04. Edited S153 residency/income persisted across all three policies with one updated line. Course emphasis mining selected S49; raising its cutoff to 57 changed the top-ranked student to S29 but retained S49. Income emphasis mining selected S190. Turning mining off preserved selection; explicitly clearing selection was not undone by later policy or threshold changes. All 200 original points remained present. The live API matched the bundled source values despite different object-key ordering.

The supplied category schema is used by simulation generation, grouping, editing, outcomes and policy details:

Ethnicity and Major display in stable English A–Z order in category pickers, matrix columns/rows/sections, the editor, Group Outcomes and policy details. Unlisted source values join the same alphabetical order; missing values remain last. Other dimensions keep their logical order, including numeric income intervals. Sorting uses a display copy without changing the schema arrays, simulated records or scoring rules.

| Field | Categories |
| --- | --- |
| Ethnicity | White; Asian; Black/African American; Hispanic/Latino; Not Specified; Two or More; Native Hawaiian/Other Pacific Islander; American Indian/Alaska Native |
| Residency | In-state; Out-of-state |
| Major | Economics; CompSci; BiologicalSci; CompEng; Psychology; Biochem; ChemEng; Math |
| Math status | Enrolled; Not Enrolled; None |

Ethnicity has eight categories: `Two or More`, `Native Hawaiian/Other Pacific Islander`, and `American Indian/Alaska Native` are three separate values. Synthetic generation keeps the first five groups fixed and splits only the previously combined bucket. The three groups retain the prior simulated contribution of -2 points, so this category correction does not introduce new score differences. `Not Specified` and the literal math-status string `None` are explicit categories, separate from missing values; `None` is also separate from `Not Enrolled`. Major, ethnicity and math-status values use the supplied English category strings. Income and Transfer status retain their existing definitions. No International category is generated or offered by the declared schema. Source values and missingness remain untouched, including unlisted source categories. No real dataset has been imported by this schema change.

Category-alignment validation on 2026-10-25: `npm run check` passed all 86 tests, MongoDB integration and the production build (four existing `src/App.jsx` Hook warnings, no errors). Browser checks confirmed the exact new editor/outcome/rule categories, two residencies, 24 major-by-math panels and 18 ethnicity-by-math panels with one line each and 72 original points. `None` selects its own group; ungrouped major edits move the lines without changing cohort statistics. Long labels fit the picker, policy details and outcomes; a 390px viewport keeps horizontal scrolling inside the plot matrix. The preview now shows three Math status columns by two Residency rows. Schema-aligned simulations admit 39/72, 50/72 and 35/72 under the three default policies. Earlier validation records below describe the categories and behavior at those stages.

Eight-category ethnicity correction: `npm run check` passed 88 tests and the production build, with the same four existing Hook warnings. Tests preserve all 57 records in the first five generated ethnicity groups and partition the remaining 15 into the three corrected groups (5/4/6 records); all student scores and default policy admission counts remain unchanged. Browser checks confirmed eight editor options, outcome rows and policy entries, eight separate plots with 72 original points, and independent filtering/editing of the corrected three categories. Each displayed GPA/SAT panel still has one line with no range or shading. The local preview is filtered to the three corrected categories for comparison. Full Cartesian layouts now contain 2,304 panels with three income bins and 3,072 with four.

Compact selected-profile view validation: `npm run check` passed 88 tests, MongoDB integration and the production build, with the same four existing Hook warnings. Browser checks confirmed fixed axes, removal of the visible cutoff/original legend, and aligned Columns/Rows/Sections controls. Six-panel and 12-panel layouts retained 72 original points and exactly one current-profile line; background edits moved the line to the current group without leaving an old line, and grouped income used the actual edited $60,000. Clearing selection hid the line. The 4× lens opened by pointer and keyboard focus, selected a listed neighboring student, closed on Escape with focus restoration, and showed no cutoff when opened over another group. At 390px it stayed within the viewport and the page did not overflow horizontally. The Group Outcomes card grew from roughly 375px to 901px at 1440×1000 and contained all six groups, with only the sidebar scrolling. Independent SSR covered eight cases including 3,072 panels, 72 original points and one exact cutoff. Earlier iteration records above describe superseded per-panel line and axis-selector behavior.

200-student preview validation: `npm run check` passed 95 tests, MongoDB integration and the production build (four existing `src/App.jsx` Hook warnings, no errors). The browser showed 200 original point records, 200 labeled students and 200 total members in each of the six outcome dimensions; policy admissions were 99/200, 124/200 and 86/200. The original 72-record release fingerprint and labels remain unchanged. Single plots filled the available desktop space at 1440×900, 1440×1000 and 1920×1080, resizing when background details opened. Switching to six plots retained 220px panels, all 200 original points and one selected-profile line. The 164px circle had no heading or list; hover, neighboring-point selection, exact-overlap cycling and Escape focus restoration worked. A 390px viewport kept the page width bounded and the lens inside the viewport. These are local preview checks; earlier records above refer to the 72-record preview and previous UI iterations.

Run the grouping, policy and preview checks with `node --test shared/featureExplorer.test.js shared/explorerPolicies.test.js shared/explorerPanelProfiles.test.js shared/explorerDemoDataset.test.js`; the full `npm test` also requires the local MongoDB service.

Interaction and ordering validation on 2026-10-26: `npm run check` passed all 97 tests, MongoDB integration and the production build, with the same four existing `src/App.jsx` Hook warnings and no errors. Browser checks covered background and empty-panel deselection, control and draft clicks retaining selection, repeated GPA/SAT changes with exactly one correctly positioned draft and dashed connector, cross-group edits without a stale connector, and Reset removing both. All 200 original points and policy totals remained unchanged. A 64-panel Ethnicity-by-Major matrix used the same A–Z order as the editor and outcomes; sticky row labels matched plot backgrounds in Light and Dark themes. Independent SSR checks also covered background-only edits, missing coordinates, reset and cross-panel moves. These are local checks, not a public deployment.

Cross-panel pairing validation on 2026-10-26: all 101 tests and the production build passed; the final responsive navigation correction also passed lint/build with the same four existing warnings. Browser checks covered reciprocal click/Enter/Space navigation across a 64-panel matrix, simultaneous ethnicity/major edits, multiple section dimensions, a filtered destination, Reset/deselection cleanup and restoration of the normal same-panel dashed connector. At 390px, pair navigation kept the target marker clear of sticky row labels without page-width overflow. Light and Dark themes retained matching marker/point colors. Independent SSR checked both endpoints, either filtered endpoint, zero panels and preserved original/draft counts. The preview is left on a four-panel S153 example (Hispanic/Latino to White, Math to Biochem).

Manual-case and stable-editor validation on 2026-10-26: all 101 tests passed, with the existing four Hook warnings. Browser checks confirmed mining leaves an empty selection empty, highlights eight cases and promotes them in the picker; toggling mining also preserved S47 and its edited GPA. View Reset cleared a 12-panel custom-bin/filter/section configuration back to one 200-point plot and default bins while preserving the edited student and mining. Blank clicks beside the student picker and on plot background clear selection, draft, cutoff and pair markers. Editor height remained exactly 402.5px at 1440px width and about 451.29px at 390px width across selected, empty, edited and income-error states; the narrow page had no horizontal overflow. These are local preview checks.

Per-panel cutoff validation on 2026-10-25: `npm run check` passed 81 tests, MongoDB integration and the production build; lint retained four existing `src/App.jsx` Hook warnings and no errors. Live browser checks confirmed one line in every panel for 3-column and 6-panel layouts, stable lines after grouped edits, movement after ungrouped edits, and fixed whole-bin income medians across row groups. The full six-dimension view rendered 2,160 panels with exactly one line each, including 2,089 empty panels, while retaining 72 unique original points, one actual draft marker and unchanged cohort outcomes/confusion matrix. No range polygons or extra cutoff edges remained. Clearing selection and using an income axis hid the cutoff; restoring GPA/SAT and a selected student restored each panel's line. Independent SSR checks also covered 2,880 panels with four income bins. The local preview is left at three income columns by two transfer rows. These checks do not establish public deployment.

Policy-dropdown validation on 2026-10-26: `npm run check` passed 103 tests, MongoDB integration and the production build, with four existing Hook warnings and no errors. The original 200 records and reference labels remain unchanged. Default admission counts are 116/99/116; Academic Focus and Income Support have equal totals but differ on 40 individual decisions. Browser checks verified keyboard policy switching, preserved student/draft, default-cutoff restoration, live count updates, Academic background invariance, and the S153 prediction changing from rejected under Holistic Review to admitted under Income Support. English, Chinese and Spanish options, help/Escape behavior, enlarged info icons and 390px width were checked. These are local preview checks.

Inline-background validation on 2026-10-26: targeted ESLint and the production build passed. At 1280px width, the picker was 210px wide, its row stayed 30px high, and the plot retained the same position and 349.83px height across selection, deselection and long ethnicity/major/income edits. All six summary fields followed the edited profile; clicking their text retained selection, while clicking the plot axis cleared it. At 390px, the summary scrolled by keyboard within its own row, the plot remained 280px high, and the page had no horizontal overflow. Browser console checks reported no errors. These are local preview checks.

External-lens validation on 2026-10-26: `npm run check` passed 113 tests, including ten placement tests and MongoDB integration, with the existing four Hook warnings; the final geometry-cache guards also passed targeted lint and the production build. Browser checks confirmed a 196px circle outside the source plot on its right, rgba background alpha 0.88 in Light and Dark, the compact S47 outcome/GPA/SAT footer, fixed lens position while switching source points, one active lens across panels, keyboard and pointer selection, Escape focus restoration and scroll dismissal. Overlapping S25/S84 cycle correctly; plot-background clicks clear selection and lens. A 390px viewport placed the circle below the source plot without page-width overflow. All 200 original points remained present. Hover rendering is isolated and pointer updates are coalesced by animation frame; no frame-rate benchmark is claimed. These are local preview checks.

### Six-background simulated policies

The active synthetic Explorer uses `shared/explorerPolicies.js`, algorithm `explorer_weighted_sum_v1`, revision `six-background-simulation-v4`. Revision 2 aligned the rule keys with the supplied categories, removed International, and replaced course-name rules with the three math statuses. Revision 3 corrected ethnicity to eight separate categories. Revision 4 restores the original Academic Focus GPA/SAT rule, retains the six-background mix as Holistic Review, and adds Income Support with a larger income bonus. These are arbitrary, hand-authored demonstration coefficients, including ethnicity offsets; they are not fitted estimates, evidence about a demographic category, or proposed real admissions criteria. Existing source records and simulated reference labels remain fixed; generated background categories follow the revised schema.

Each score adds normalized GPA and SAT points plus six background contributions; all six are explicitly zero under Academic Focus. GPA maps 2.4–4 to 0–1, SAT Percentile maps 0–100 to 0–1, both clamped. Each categorical field uses its explicit lookup table. ZIP-area income interpolates from the listed bonus at $25,000 to zero at $150,000, clamped outside that interval. Display bins never set the income used for actual student predictions. Missing/unlisted backgrounds contribute zero.

| Preset | GPA weight | SAT weight | Maximum income points | Other backgrounds | Default cutoff |
| --- | --- | --- | --- | --- | --- |
| Academic Focus | 60 | 40 | 0 | All zero | 62 |
| Holistic Review | 45 | 25 | 8 | Shared categorical rules | 55 |
| Income Support | 45 | 25 | 13 | Same as Holistic Review | 55 |

The dropdown is generated from the policy array and keeps each policy ID stable. It preserves the current student and draft, closes mining and help, and restores the chosen policy's default cutoff when the policy changes. One adjacent information button opens the selected rule; Academic Focus labels backgrounds as not used. The compact count below the selector uses the current threshold. Policy, threshold and matrix information icons have larger 30–34px click targets and 19–20px symbols. The common categorical tables are in the module; Income Support differs from Holistic Review only in its income bonus, keeping its academic weights and cutoff identical. Legacy `firstGen`, `athlete` and `resident` fields are ignored by this algorithm. Old policies remain supported for dormant views and non-synthetic releases.

This iteration applies the new policies in the synthetic browser workspace without rewriting persisted dataset releases or classroom bindings. Existing policy IDs are retained for compatibility; the simulation revision is explicit in the policy objects. Current event payloads record policy IDs but not this revision, so they alone cannot distinguish older policy runs from this prototype. No database migration or public deployment is implied.

Earlier single-line refinement validation, before per-panel conditional lines: `npm run check` passed all 75 tests and the production build, with the same four existing Hook warnings. Browser checks confirmed zero range polygons/outer edges, exactly one current-profile cutoff before and after income edits, movement to the new group after residency edits, and restoration on Reset. Clearing selection, filtering out the current group, and switching to income axes each removed the line. All 72 original points, cohort outcomes, and the confusion matrix remained unchanged by hypothetical edits.

Earlier new-policy validation, before the single-line refinement: `npm run check` passed 75 tests and the production build (four pre-existing `src/App.jsx` Hook warnings, no errors). Independent tests covered all six contributions, income clamping/missing data, exact boundary equality, conditional ranges, prediction flips and unchanged original records/reference labels. Browser checks confirmed all five categorical edits moved the hypothetical cutoff, a $50,000 income edit flipped S47 from not admitted to admitted, and policy switches produced 37/72, 49/72 and 30/72 original admissions. The then-current six-dimensional 2,880-panel view retained 72 original points and one original/edited profile cutoff each. The following records describe earlier iterations and their then-current rules.

Historical validation from 2026-10-21: 31 shared model/grouping tests and the production build passed. Browser checks at that time covered combined Whole-Person Review bands, the former row/column facet ordering, unchanged cohort statistics, and the selected profile cutoff. These checks predate the Explorer-only interface update.

Earlier validation on 2026-10-25, before the six-feature iteration: all 31 shared model/grouping tests and the production build passed. Lint reported no errors and four existing Hook warnings in `src/App.jsx`. Native Chrome verification was unavailable in that earlier run.

Six-feature iteration validation on 2026-10-25: `npm run check` passed all 60 tests, including MongoDB integration, and the production build. Lint has no errors and the same four existing `src/App.jsx` Hook warnings. In-app browser checks covered 1/2/3 plots, all six dimensions with 2,880 panels and 72 unique original points, fixed/quantile/custom income bins, invalid custom cuts, empty and partial category selections, and unchanged cohort statistics. Hypothetical checks covered hidden-axis SAT edits, overlapping original/edited points, residency group changes, and conditional cutoff geometry. A 390px viewport kept horizontal scrolling inside the matrix; English/light and Chinese/dark views were inspected. These are local checks, not a public deployment.

Six-feature sidebar follow-up: `npm run check` passed 65 tests and the production build, with the same four pre-existing lint warnings. Browser checks confirmed all five categorical edits move the hypothetical point to the chosen group, a $250,000 income edit stays visible on the shared income axis, invalid/blank inputs preserve committed values, and Reset restores all six backgrounds. Both quantile and custom income bins matched between the plots and Group Outcomes, including empty groups; every dimension still totaled 72 original students. Switching policy updated each dimension's admitted count from 45 to 55 without changing membership. Hypothetical edits left these statistics and the confusion matrix unchanged.

## Run locally

Requirements: Node.js 20.19+ and MongoDB 7+ (the console uses MongoDB's approximate percentile aggregation). Start MongoDB on `127.0.0.1:27017`, then:

```powershell
npm install
npm run dev
```

No `.env` is needed with the local defaults. The API connects to the dedicated `counterlens_demo` database and seeds the 72-record synthetic release, example questionnaire, and `local-demo-v2` classroom without replacing existing data. Existing classrooms (including `local-demo`) remain pinned to their original releases; their old links and answers are preserved. New classrooms and showcases use the reference-label release.

- Student page: http://localhost:5173/
- Classroom console: http://localhost:5173/?view=console
- API liveness: http://127.0.0.1:8787/healthz
- API/database readiness: http://127.0.0.1:8787/readyz
- http://127.0.0.1:8787/monitoring redirects to the console.

The local development console automatically tries demo access for a loopback API. If a custom token is configured, it returns to the connection form. Development uses the public convenience token `counterlens-local-demo` when no token is configured. The API binds to loopback by default. Set a private `MONITORING_TOKEN` before exposing it to other machines. Production does not supply a default token or enable showcase generation. Tokens remain in page memory, not browser storage.

For another laptop, see [the demo handoff guide](docs/LAPTOP_DEMO.md). Copying the source does not copy MongoDB data; generate a new showcase on that machine.

## Five-minute demonstration

1. Open the console and select **Generate showcase** to create a separate, labeled session with simulated events and 24 simulated answers. Service measurements are still real.
2. Select **New classroom** and enter a title for a fresh session.
3. Use **Open student view**. The link's `class` parameter assigns events and answers to that classroom.
4. Compare policies, move the threshold, and drag a student to explore a hypothetical profile.
5. Return to the console and refresh to inspect activity. Select the generated showcase session to see demo question distributions and answers. Close collection when finished.
6. Use **Export snapshot** for a JSON report of the displayed window (includes up to 12 recent answers, not a full research-data export).

The console supports Overview, Classroom & surveys, System health, and Dataset release views; automatic refresh is optional. An unavailable API/database produces an error and marks previous values as unverified. Counts are event/submission counts, not unique-person counts, completion rates, or learning outcomes.

## Questionnaire framework

`shared/questionnaire.js` defines a versioned example exit ticket with choice, integer scale, and optional text questions. Student rendering and server answer validation use the definition stored for that classroom. English, Chinese, and Spanish labels are supported.

When changing questions, increment the questionnaire version and create a new classroom. Existing classrooms remain tied to their original version. The dashboard's policy and confidence charts currently illustrate the example questions; adding different research questions also requires adapting these charts. A form-builder UI, participant identities, longitudinal linking, and pre/post experiment design are intentionally deferred.

Answers are saved only on explicit submission. A random submission ID prevents retries of the same request from adding another response. It is not a participant identifier and does not stop one person from submitting again after reloading. The standalone **Discuss / Your reflection** panels have been removed from the student workspace. The **Check-in** entry is currently hidden, including when an API is configured; the survey component, backend endpoints, and existing answers are retained for future use.

## MongoDB collections

| Collection | Purpose |
| --- | --- |
| `dataset_releases` | Versioned classroom metadata, policies, and public-release status |
| `classroom_records` | One approved classroom record per document |
| `questionnaires` | Versioned question definitions |
| `classrooms` | Classroom title, collection state, dataset and questionnaire versions |
| `events` | Allow-listed interactions, assigned to a classroom |
| `responses` | Explicitly submitted questionnaire answers and version context |
| `request_metrics` | Route templates, status codes, and duration; no request bodies |

Events, responses, and request metrics receive an `expiresAt` timestamp and TTL index (30 days by default, set at insertion). TTL deletion is asynchronous; console queries also exclude expired records. Dataset releases and definitions are retained. Old SQLite files in `server/.data/` are untouched and are not automatically imported into MongoDB.

## Configuration

Copy `.env.example` to `.env` only when overriding defaults. Never commit `.env` or database dumps.

| Variable | Local default | Purpose |
| --- | --- | --- |
| `HOST` / `PORT` | `127.0.0.1` / `8787` | API listener |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Server-only database connection |
| `MONGODB_DB` | `counterlens_demo` | Application database |
| `MONITORING_TOKEN` | `counterlens-local-demo` in development | Console access |
| `MONITORING_RETENTION_DAYS` | `30` | Retention for new events, answers, and metrics |
| `CONSOLE_URL` | `http://localhost:5173/?view=console` | Console redirect |
| `ALLOWED_ORIGINS` | Local Vite and `https://misvis.github.io` | Browser origins |
| `VITE_API_BASE_URL` | Set by `npm run dev` | Browser API endpoint, never the MongoDB URI |
| `VITE_DATASET_ID` | `admissions-demo` | Classroom dataset |

`npm run dev:web` runs only the static frontend, with bundled synthetic data and no answer/event submission unless an API URL is configured. `npm run deploy` still publishes the static build to GitHub Pages. The current local platform changes require a separately running API to collect anything.

## API overview

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /healthz` | Process liveness | Public |
| `GET /readyz` | Live MongoDB ping | Public |
| `GET /api/v1/classroom-view/:datasetId` | Public-approved release, optionally pinned by classroom | Public |
| `GET /api/v1/classrooms/:id` | Classroom state and questionnaire | Public |
| `POST /api/v1/events` | Strictly allow-listed events | Public, rate limited |
| `POST /api/v1/responses` | Validated questionnaire answers | Public, rate limited |
| `GET/POST /api/v1/monitoring/classrooms` | List/create classrooms | Console token |
| `PATCH /api/v1/monitoring/classrooms/:id` | Open/close collection | Console token |
| `POST /api/v1/monitoring/showcase` | Generate labeled presentation examples | Console token, development only |
| `GET /api/v1/monitoring/summary` | Session results and system health | Console token |

The session selector filters classroom events and answers. Operational metrics cover all classrooms in the selected time window and exclude console polling, health probes, and CORS preflights. P95 response time is an approximate server-side metric.

## Data boundary

The application does not store IP addresses, user agents, student record IDs in analytics, or persistent visitor identifiers. It **does** store explicitly submitted questionnaire answers, including optional text. Free text can contain identifying information if someone enters it; the form asks respondents not to do so. Operational request metrics never store answers. External web servers may have separate logs.

All data sent to a public browser can be downloaded. Public-release flags and schema checks do not establish anonymity. Source files and linkage keys stay outside this public repository. See [the release checklist](docs/DATA_RELEASE_CHECKLIST.md) before using institutional data. Question wording, recruitment, consent, and evaluation measures remain demo placeholders pending research design.

## Verification

```powershell
npm run check
```

Runs ESLint, integration tests against the local MongoDB service, admission-boundary math tests, and a production build. Integration tests create a fresh `counterlens_test_<random-id>` database and remove only that test database. They exercise answer validation, authentication, retry deduplication, session isolation, closed collection, simulated-data separation, retention filtering, persistence after restart, rate limiting, and readiness failure. Math tests check boundary equality across policies, backgrounds, and thresholds, including off-chart and degenerate cases.

## License

Creative Commons Attribution-NonCommercial 4.0 International. See [LICENSE](LICENSE).
