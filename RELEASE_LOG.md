# CounterLens Release Log

## [V2.9.0 - Confusion Matrix & UI Cleanup] - 2026-09-23
### Changed
- Added a compact confusion matrix beside the threshold, with larger counts, proportional bars, sample totals, and multilingual help.
- Simplified policy explanations, aligned admission counts, and removed extra group-gap text.
- Renamed the edge-case control to Mine Edge Cases and reduced chart clutter with shorter, lighter sample guides and one active boundary line.
- Added fixed demo reference labels in a new dataset release and default classroom; existing profiles, classrooms, and answers remain unchanged.
- Included the related MongoDB/backend updates and tests. GitHub Pages remains a static demo; database contents and private configuration are not published.

## [V2.8.0 - Interactive Classroom Workspace] - 2026-09-23
### Changed
- Reorganized the student view into a larger visualizer and a compact, aligned control panel.
- Added an adjustable admission threshold, exact GPA/SAT boundary slices, and a background-dependent boundary band.
- Clarified policy explanations and added outcome-flip and admission-rate change feedback.
- Added gold edge-case highlights and refined contrast, spacing, and help popovers across three themes and languages.
- Removed the standalone discussion/reflection panels; retained the optional Check-in questionnaire and local classroom console.
- Included the MongoDB backend, console, tests, and laptop demo guide in the source release. GitHub Pages remains a static synthetic-data demo; no database contents or private configuration are published.

## [V2.7.0 - Local Classroom Console] - 2026-09-18
### Added
- Added classroom sessions, a versioned demo questionnaire, and explicit answer submission with retry deduplication.
- Added a unified console for activity, survey results, submitted reflections, API health, and dataset quality.
- Added clearly labeled showcase data, collection controls, snapshot export, and MongoDB integration tests.

### Changed
- Made local console access automatic and clarified section navigation with distinct headings and reloadable links.
- Moved classroom data and monitoring storage to local MongoDB; existing SQLite files are left untouched.
- Added database readiness checks and retention indexes; excluded console polling from request metrics.
- Kept the separate reflection draft unsaved. Only the new questionnaire submits answers.

## [V2.6.0 - Backend Foundation & Private Monitoring] - 2026-09-02
### Added
- Added a versioned classroom-data API with public-release privacy checks and extensible feature metadata.
- Added a token-protected monitoring dashboard for anonymous traffic, teaching interactions, API health, and dataset quality.
- Added automatic monitoring retention, strict event allowlists, backend tests, and a real-data release checklist.

### Changed
- Moved the synthetic dataset and policy definitions behind a reusable data contract while preserving the current classroom experience.
- Removed Google Analytics, Google Fonts, and the Tailwind CDN; frontend assets are now built locally without third-party page requests.

## [V2.5.0 - Simplified Prototype UI Refresh] - 2026-09-02
### Changed
- Made Light the default theme and strengthened text, panel, and selected-state contrast.
- Clarified the four-step learning flow, group-rate comparisons, borderline cases, and score-versus-cutoff language.
- Aligned the outcome legend, unified chart and legend colors, and improved point, slider, focus, and multilingual usability.

## [V2.3.1] - 2026-03-04
### Fixed
- **Animate Scrollbar**: Resolved an unsightly scrollbar issue caused by the `animate-fate-flip` effect by optimizing the layout flow.
- **Micro-Polish**: Added a subtle "breathing" animation effect to the Result Indicators for more dynamic feedback.

## [V2.3] - 2026-03-04
### Added
- **UI Height Synchronization**: Perfectly aligned the heights across different panels (Counterfactual Visualizer, Counterfactual Editor, Dataset Slices, Confusion Matrix) for a cleaner, unified scientific grid.
- **Score Stability Visualization**: The Counterfactual Editor now displays both the original and updated decision margin values, providing a clear delta of the algorithmic impact.
- **Enhanced Label Contrast**: Increased visibility for secondary gray text labels (e.g., gender and score categories) within the Dataset Slices for better legibility on high-density displays.

### Changed
- **Default Visual Focus**: Set GPA as the default X-axis for the Counterfactual Visualizer to streamline common analytical workflows.
- **Scientific Aesthetic**: Refined the spacing and contrast of the Data Slices module to match the "Aurora Terminal" design language.

## [V2.2] - 2026-02-26
### Added
- **Mathematics-Style Axis Labeling**: GPA and SAT labels are now directly embedded at the ends of the axes for a more rigorous academic look.
- **Physical Truncation Marks**: Added double-slash marks at the origin to denote non-zero starting points (GPA 2.5, SAT 1200), improving scientific accuracy.
- **Unified Tactile DNA**: Applied `btn-tactile` (chamfered corners) to the Decision Margin module for full system UI consistency.

### Changed
- **Coordinate System Optimization**: Adjusted default viewing ranges to GPA [2.5-4.0] and SAT [1200-1600] to reduce whitespace and increase data density.
- **Dashboard Rebalancing**: 
    - Updated grid proportions to a symmetrical **20% : 60% : 20%** for better visual stability.
    - Expanded central Counterfactual Visualizer to 60% width.
- **Micro-UX Polish**:
    - Unified all help buttons (HelpCircle) to match adjacent font sizes.
    - Shortened Lab Guide and Ethics Scanner to `h-24` and synchronized their internal vertical alignment.
    - Reduced font sizes in the Result Indicator for a more compact, data-dense look.
    - Minimized vertical spacing between feature sliders and their labels.

### Fixed
- **Modal Congestion**: Removed redundant 'X' close buttons in favor of 'OK' buttons and compressed top padding for a tighter UI.
- **Visual Overlap**: Resolved clipping issues for GPA/SAT axis labels by adjusting chart margins.
- **Geometric Inconsistency**: Fixed the Decision Margin container's "pill" shape, reverting it to consistent chamfered corners.

