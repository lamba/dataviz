// File: /Users/lamba/Projects/js/charting_generic_enhanced/README.MD

<span style="color: blue;">Puneet Lamba. May 25, 2025.</span>

# TOC

<!-- TOC -->
<!-- Note: TOC limited to heading levels 1-3 (from global config) -->
<ul>
<li>1. <a href="#change-log">Change log</a></li>
</ul>
<!-- /TOC -->

---
---

# Change log
- v1.0.4
	- Pushed v1.0.3 and synced with npm (so ready to follow the new workflow documented here: `/Users/lamba/Dropbox/my-docs/md-notes/tech/js/js-notes.pdf`)
	- Added y-axis ticks and tick labels
	- Centralized management of chart margins
	- Fixed "Selected Columns:" UI and moved it to the top so it's not obstructed by the brush bar
	- Fixed footer for Inventica Consulting
	- Defined x-axis labels and moved them out of the chart area so that they don't conflict the the brush bar which moves around as it displays its own labels
- v1.0.5
	- Added the ability to created calculated columns using simple formulas
		- More complicated than it seems. Average of what over what? Better to **do calculations outside the charting system (in Excel and then use the charting for visual analysis**
		- See my write up on pros/cons of Excel v DataViz in `/Users/lamba/Dropbox/my-docs/md-notes/tech/js/js-notes.pdf`
	- Added logo
- v1.0.6
	- Fixed composed chart sorting, y-axis assignment, and y-axis labeling issues
- v1.0.7
	- Scatter plot enhancements 
		- Provide more user feedback (e.g. both axes MUST be numeric)
		- Quadrant based coloring
		- If a third numeric column is selected, dots will be sized based on that value (bigger = higher value)
