// File: /Users/lamba/Projects/js/charting_generic_enhanced/README.MD

<span style="color: blue;">Puneet Lamba. June 01, 2025.</span>

# TOC

<!-- TOC -->
<!-- Note: TOC limited to heading levels 1-3 (from file hint) -->
<ul>
<li>1. <a href="#change-log">Change log</a></li>
<ul>
<li>1.1. <a href="#v1-0-4">v1.0.4</a></li>
<li>1.2. <a href="#v1-0-5">v1.0.5</a></li>
<li>1.3. <a href="#v1-0-6-7">v1.0.6/7</a></li>
<li>1.4. <a href="#v1-0-8">v1.0.8</a></li>
<li>1.5. <a href="#v1-1-0">v1.1.0</a></li>
<li>1.6. <a href="#v1-1-1">v1.1.1</a></li>
<ul>
<li>1.6.1. <a href="#current-implementation-for-horizontal-orientation">Current Implementation for horizontal orientation:</a></li>
<li>1.6.2. <a href="#the-issue">The Issue:</a></li>
</ul>
<li>1.7. <a href="#v1-1-2">v1.1.2</a></li>
<li>1.8. <a href="#v1-1-3">v1.1.3</a></li>
</ul>
</ul>
<!-- /TOC -->

<!-- TOC-LEVEL: 3 -->

---
---

# Change log

## v1.0.4
- Pushed v1.0.3 and synced with npm (so ready to follow the new workflow documented here: `/Users/lamba/Dropbox/my-docs/md-notes/tech/js/js-notes.pdf`)
- Added y-axis ticks and tick labels
- Centralized management of chart margins
- Fixed "Selected Columns:" UI and moved it to the top so it's not obstructed by the brush bar
- Fixed footer for Inventica Consulting
- Defined x-axis labels and moved them out of the chart area so that they don't conflict the the brush bar which moves around as it displays its own labels

## v1.0.5
- Added the ability to created calculated columns using simple formulas
	- More complicated than it seems. Average of what over what? Better to **do calculations outside the charting system (in Excel and then use the charting for visual analysis**
	- See my write up on pros/cons of Excel v DataViz in `/Users/lamba/Dropbox/my-docs/md-notes/tech/js/js-notes.pdf`
- Added logo

## v1.0.6/7
- Fixed composed chart sorting, y-axis assignment, and y-axis labeling issues
- Basic scatter plot fixes

## v1.0.8
- Scatter plot fix for x-axis

## v1.1.0
- Lost the original readme entries somehow and can't recall what that fix was
- Scatter plot is still working fine

## v1.1.1
- Added horizontal orientation for stacked, stacked 100, and grouped to make labels easier to read (but they have less real estate, ugh)
- Switched to chart.js for stacked and grouped because recharts wasn't handling horizontal orientation very well	
- That was causing a caching issue when switching between libraries, but that seems fixed now
- TBD - break the tsx into modules (it's way too big at over 3,500 lines now)

### Current Implementation for horizontal orientation:

**stackedBar100**: 
- Vertical: Recharts BarChart ✅
- Horizontal: Recharts BarChart ✅ (you never implemented Chart.js version)

**stackedBar**: 
- Vertical: Recharts BarChart ✅
- Horizontal: Chart.js Bar ❌ (causing the rendering issue)

**groupedBar**: 
- Vertical: Recharts BarChart ✅  
- Horizontal: Chart.js Bar ❌ (causing the rendering issue)

### The Issue:
The problem occurs when switching between **different charting libraries** (Recharts ↔ Chart.js), not when staying within the same library. Recharts handles state changes cleanly, but Chart.js has canvas caching issues.

## v1.1.2
- Disabled redundant chart.js built-in legend at the top since the "selected columns" legend at the top is working fine for all charts

## v1.1.3
- Now that horizontal orientation makes the category labels more readable, it would be nice if they weren't so constrained on real-estate. Addressed that via options to control chart height
