// File: /Users/lamba/Projects/js/charting_generic_enhanced/README.MD

<span style="color: blue;">Puneet Lamba. June 02, 2025.</span>

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
<li>1.9. <a href="#v1-1-4">v1.1.4</a></li>
<ul>
<li>1.9.1. <a href="#it-makes-perfect-sense-to-have-the-total-sorting-option-for-all-charts-here-s-why">It makes perfect sense to have the "Total" sorting option for all charts. Here's why:</a></li>
<li>1.9.2. <a href="#why-total-sorting-is-useful-for-all-chart-types">Why "Total" sorting is useful for all chart types:</a></li>
<li>1.9.3. <a href="#the-logic-works-universally">The logic works universally:</a></li>
<li>1.9.4. <a href="#keep-it-simple">Keep it simple:</a></li>
</ul>
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

## v1.1.4
- Sometimes what you need to fix is not the code, but the data. Prime example is that I did a random filter and noticed that contacts with an AP of 10 weren't showing up on the charts. Why? Because they had sparse columns and the charting libraries were excluding them outright. So I replaced all blanks with zeros (for numeric fields) and none (for category fields) and voila - I had whole new set of data never seen before!
- Another data-related observation - numeric columns are not showing up a slider filters because they either have non-numeric values or negative values - another cleanup opportunity
- Modified code to allow negative numeric values and still place them on a sliding filter (as opposed to a checkbox filter used for categories)
- Added ability to sort by magnitude of the stacked bar (i.e. total of values, negative sentiment score hurts overall total)

### It makes perfect sense to have the "Total" sorting option for all charts. Here's why:

### Why "Total" sorting is useful for all chart types:

1. **Stacked Bar Charts** - Sort by total bar length (the main use case we discussed)
2. **Grouped Bar Charts** - Sort by sum of all grouped bars for each category
3. **Line Charts** - Sort by total value across all selected metrics
4. **Area Charts** - Sort by combined area size (total of all selected columns)
5. **Scatter Plots** - Sort by sum of selected numeric columns (even if only showing 2)
6. **Composed Charts** - Sort by total across all bars + lines

### The logic works universally:

The "total" calculation we implemented is:
```typescript
const totalA = config.selectedColumns.reduce((sum, col) => sum + ((a as any)[col] || 0), 0);
const totalB = config.selectedColumns.reduce((sum, col) => sum + ((b as any)[col] || 0), 0);
```

This simply sums up all the selected columns for each data point, which makes sense regardless of how those columns are visually represented in the chart.

### Keep it simple:

Rather than trying to hide/show the "Total" option based on chart type, it's better UX to always show it. Users can choose whether it makes sense for their specific use case.

So yes, definitely keep the "Total (High to Low)" option available for all chart types! The current implementation is perfect.

