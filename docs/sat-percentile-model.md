# SAT percentile classroom model

The visualizer uses SAT User Group percentile as a numeric input (0–100),
not a rescaled SAT score. Its SAT contribution is `weight.sat * percentile / 100`.
The editor and student drag use one-percentile-point increments. GPA scoring,
policy weights, cutoffs, and simulated reference labels remain unchanged.
Admission outcomes are recomputed; GPA × percentile boundaries remain straight.

Source: https://research.collegeboard.org/reports/sat-suite/understanding-scores/sat
Table snapshot accessed 2026-10-14; the page describes actual SAT takers who
graduated in the preceding three school years. This is not a percentile computed
within the 72-person synthetic classroom. Examples: 1100 → 62, 1330 → 88,
1460 → 96. The current demo only uses uncensored table entries. For other scores,
published `1-` and `99+` entries are modeled as 0.5 and 99.5, approximations rather
than exact published ranks. The chart and editor show 60–100; scoring still uses percentile / 100.

The raw dataset/API contract retains SAT scores. `toPercentileClassroomView`
converts both bundled and API releases before they reach the visualizer, marks
the feature unit and model algorithm, and adds a version suffix for event
provenance. Already-marked percentile releases are not converted again.
The original release and reference outcomes are never mutated. Importing a
future percentile dataset requires explicit `unit: 'percentile'` metadata.
