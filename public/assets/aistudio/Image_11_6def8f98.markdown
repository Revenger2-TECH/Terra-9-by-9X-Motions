---
name: Orbital Telemetry & Geospatial Intelligence
colors:
  surface: '#111319'
  surface-dim: '#111319'
  surface-bright: '#37393f'
  surface-container-lowest: '#0c0e13'
  surface-container-low: '#191c21'
  surface-container: '#1d2025'
  surface-container-high: '#282a30'
  surface-container-highest: '#33353b'
  on-surface: '#e2e2ea'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#e2e2ea'
  inverse-on-surface: '#2e3036'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c3f5ff'
  on-primary: '#00363d'
  primary-container: '#00e5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#ffe9d3'
  on-tertiary: '#472a00'
  tertiary-container: '#ffc681'
  on-tertiary-container: '#7e4e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cf0ff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#111319'
  on-background: '#e2e2ea'
  surface-variant: '#33353b'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  telemetry-metric:
    fontFamily: JetBrains Mono
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.02em
  telemetry-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  telemetry-coord:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a high-precision, deep-space operational environment engineered for the TERRA-9 Earth Analog Intelligence System. Drawing foundational cues from NASA JPL deep-space command centers, ESA planetary science consoles, Copernicus Sentinel Earth observation arrays, and computational GIS instrumentation, the interface serves researchers, aerospace systems engineers, and planetary science leads.

The emotional signature is austere, rigorous, and calculated. It eliminates decorative flourishes in favor of information density, extreme spatial clarity, and functional authority. The style merges **Scientific Minimalism** with **Technical High-Contrast Precision**:
- Unapologetic structural density governed by razor-thin division vectors rather than heavy shadows.
- Utilitarian telemetry surfaces calibrated for low-light mission operations centers (MOC).
- Deliberate restraint in signaling: non-game neon, avoiding sci-fi fantasy tropes in favor of actual aerospace instrumentation standards (MIL-STD-1472H and telemetry monitoring principles).
- High visual cadence between primary telemetry values, structural bounding frames, and coordinate arrays.

## Colors

The chromatic architecture is engineered strictly for dark-field high-legibility operations. Luminance values are assigned based on functional urgency and signal categorization.

- **Background Foundations:** Canvas base `#07090E` (Void), container baseline `#0B0F19` (Exosphere), and raised operational decks `#111827` / `#131D31` (Midnight Navy Surface).
- **Primary Signal (`#00E5FF` - Orbital Cyan):** Reserved for active target locks, vector vectors, primary sensor telemetry, real-time sync markers, and focal interactive states.
- **Secondary Reference (`#38BDF8` - Atmospheric Azure):** Applied to structural telemetry coordinates, auxiliary system nodes, dataset provenance tags, and calibrated scale bars.
- **Tertiary Alert / Metric (`#F59E0B` / `#FBBF24` - Solar Amber):** Denotes sensor anomalies, orbital drift deviations, thermal thresholds, and classification match alerts. Never used for purely aesthetic accents.
- **Structural Grids & Separators:** Hairline boundaries utilizing `#1E293B`, `#334155`, and dynamic telemetry bounds `rgba(56, 189, 248, 0.2)`.
- **Typographic Neutral Hierarchy:** Primary readouts `#F8FAFC`, secondary telemetry labels `#94A3B8`, muted metadata and coordinate legends `#64748B`.

## Typography

The typographic hierarchy is segmented across three disciplined roles:

1. **Display & Module Framing (Space Grotesk):** Engineered for section headings, deck categorizations, and system state alerts. Offers geometric rigidity without feeling disconnected from modern computational tools.
2. **System Prose & Analytical Annotations (Inter):** High-efficiency neutral grotesque handling long-form mission briefs, technical payload documentation, and geospatial anomaly reports.
3. **Telemetry, Provenance & Instrumentation (JetBrains Mono):** The operational core. Assigned to UTC timestamps, ephemeris vectors, spectral band classifications, similarity indexes, GIS coordinates (MGRS, Decimal Degrees), and raw telemetry packets. Tabular figures (`tnum`) must remain strictly enforced across all numeric representations to prevent layout jitter during sub-second streaming updates.

## Layout & Spacing

The interface functions on a high-density, multi-pane mission control workspace model. 

- **Grid Architecture:** 24-column modular micro-grid on multi-monitor/workstation displays (`>= 1440px`), collapsing to a 12-column layout on standard viewport monitors, and a stacked 4-column column system on tactical mobile/tablet viewports.
- **Density Profile:** Tight spatial tolerances. Gutter spaces remain locked to `0.75rem` (12px) and `1rem` (16px) to maximize data yield within the viewport without generating visual noise.
- **Docked Instrument Panels:** Structural division uses static side rails (left 280px for catalog/provenance trees, right 320px for live sensor telemetry and similarity scores) bracketing a central fluid geospatial viewport.
- **Viewport Constraints:** Full viewport lock (`100vh`) on mission consoles to avoid browser-level document scrolling; each analytical viewport handles independent micro-scrolling with low-profile scroll indicators.

## Elevation & Depth

Spatial layering rejects soft blur skeuomorphism and heavy blurred dropshadows. Depth is articulated purely through tonal luminance, border illumination, and hairline planar framing:

- **Baseline Void (`#07090E`):** The foundational substrate representing spatial coordinates, map viewports, and deep-sky rendering canvases.
- **Deck Container Layer 1 (`#0B0F19`):** Docked consoles, telemetry side-rails, and tabular inspectors. Delineated by a continuous 1px outline of `#1E293B`.
- **Active / Floating Panels Layer 2 (`#111827`):** Coordinate overlays, tooltips, fly-out spectrum pickers, and transient sensor plots. Border elevated to `#334155`.
- **Target Lock & Focus Elevation:** Rather than a drop shadow, focused or hovered surfaces receive an internal hairline rim or an outer keyline accent of `rgba(56, 189, 248, 0.25)` accompanied by a 1px corner reticle mark.
- **Modals / Critical Overrides:** Backed by an opaque 85% alpha `#07090E` curtain with zero background blur to preserve instantaneous render latency in workstation GPU threads.

## Shapes

The geometry of the interface is rigorously sharp (`0px` corner radii across all core primitives: buttons, tabs, input fields, viewports, and modular cards). 

- **Corner Archetype:** Strict 90-degree orthogonal corners symbolize hardware instrumentation, sensor racks, and spatial frame references.
- **Chamfered Offsets (Optional Accent):** Select primary telemetry readout modules and status badges may utilize a 45-degree technical chamfer (clipped corner of 3px to 4px) via CSS clip-path to evoke aerospace flight-chassis serial plates.
- **Reticle Indicators:** Framing elements leverage orthogonal tick marks (`+`, `L`-brackets at panel corners) rendered in `rgba(56, 189, 248, 0.4)` to emphasize scientific instrumentation bounding boxes.

## Components

### Buttons & Interactive Triggers
- **Primary Execution (Action/Acquisition):** Solid `#00E5FF` fill, black text (`#07090E`), uppercase `label-caps`, zero border-radius. Hover shifts to `#38BDF8`. Active state contracts by 1px inset boundary.
- **Secondary / Telemetry Trigger:** Dark surface (`#111827`) with a 1px border of `#334155` and text in `#F8FAFC`. Hover shifts border to `#38BDF8` with a background tint of `rgba(56, 189, 248, 0.08)`.
- **Destructive / Abort:** Base `#0B0F19` with a 1px border of `#EF4444`, text `#EF4444`. Invert on hover.

### Chips & Sensor Status Tags
- **Telemetry Chips:** Minimal padding (`2px 6px`), monospaced uppercase `telemetry-coord`. Background: `rgba(17, 24, 39, 0.8)`, border: 1px solid `rgba(255, 255, 255, 0.1)`.
- **Status Indicators:** Micro 6px square beacon (not circular). Green `#10B981` (Nominal), Amber `#F59E0B` (Drift/Anomaly), Red `#EF4444` (Telemetry Loss), Cyan `#00E5FF` (Tracking).

### Input Fields & Parameter Controls
- **Data Input:** Boxed field, background `#0B0F19`, 1px solid border `#1E293B`, monospaced text input (`#F8FAFC`).
- **Focus State:** Border changes directly to `#00E5FF`; corner tick indicator toggles visibility on the upper-right boundary. No glowing focus rings.
- **Numeric Steppers:** Integrated increment/decrement micro-keys aligned within the right edge of the monospaced field, bounded by 1px internal dividers.

### Checkboxes & Toggle Switches
- **Checkboxes:** 14px square box, 1px border `#334155`. Checked state features a solid 8px `#00E5FF` square center fill, omitting organic checkmark vectors.
- **Toggles:** Segmented binary switches (`[ ENABLED | STANDBY ]`) enclosed in a single rectangular 1px frame rather than rounded slider pills.

### Data Grids & Telemetry Tables
- **Header:** Uppercase `label-caps` in `#64748B`, background `#0B0F19`, bottom border 1px solid `#1E293B`.
- **Rows:** Alternating rows forbidden; density maintained with 1px horizontal division borders (`#131D31`).
- **Hover State:** High-contrast row scan line highlight (`rgba(56, 189, 248, 0.04)`).
- **Cells:** Numeric values right-aligned with fixed tabular spacing (`JetBrains Mono`).

### Modular Telemetry Cards
- **Structural Bounds:** 1px hairline border (`#1E293B`) on base `#0B0F19`.
- **Card Header:** Integral sub-bar separating the title block from the body; incorporates a trailing 4-digit module index (e.g., `MOD-0924`) in `#64748B`.
- **Coordinate Overlays:** Bounding box reticles (`[ ]`) situated in the four extreme corners of the panel.

### Specialized Scientific Modules
- **Analog Metric Bar:** Segmented step-meter (10 to 20 blocks) visualizing similarity metrics (0.000 to 1.000) instead of smooth continuous progress bars.
- **Coordinate HUD:** Floating geospatial telemetry indicator rendering active crosshairs with real-time latitude, longitude, and elevation indices fixed at `telemetry-coord`.