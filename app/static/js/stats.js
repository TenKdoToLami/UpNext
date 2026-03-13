/**
 * @fileoverview Statistics dashboard logic.
 * Handles calculation and rendering of library statistics using Chart.js.
 * @module stats
 */

import { state, setState } from './state.js';
import { TYPE_COLOR_MAP, STATUS_COLOR_MAP, MEDIA_TYPES, ICON_MAP, STATUS_ICON_MAP, STAR_FILLS, RATING_LABELS } from './constants.js';
import { safeCreateIcons } from './dom_utils.js';

let typeChartInstance = null;
let statusChartInstance = null;
let growthChartInstance = null;
let mediaGrowthChartInstance = null;
let ratingChartInstance = null;
let consumptionGrowthChartInstance = null;
let consumptionSpreadChartInstance = null;
let activeMediaTypes = [...MEDIA_TYPES]; // Global filter, default all active

// Reusable chart options for consistency
const COMMON_CHART_OPTIONS = {
	responsive: true,
	maintainAspectRatio: false,
	interaction: {
		mode: 'index',
		intersect: false
	},
	plugins: {
		legend: {
			position: 'bottom',
			labels: {
				padding: 20,
				usePointStyle: true,
				pointStyle: 'circle',
				font: {
					family: "'Inter', sans-serif",
					size: 11,
					weight: 600
				},
				color: (ctx) => {
					return document.documentElement.classList.contains('dark') ? '#e4e4e7' : '#27272a';
				}
			}
		},
		tooltip: {
			enabled: false, // Disable built-in tooltip
			external: externalTooltipHandler
		},
		datalabels: {
			color: '#ffffff',
			font: {
				weight: 'bold',
				size: 12,
				family: "'Inter', sans-serif"
			},
			formatter: (value, ctx) => {
				let sum = 0;
				// Safety check
				if (ctx.chart.data.datasets && ctx.chart.data.datasets[0] && ctx.chart.data.datasets[0].data) {
					let dataArr = ctx.chart.data.datasets[0].data;
					dataArr.map(data => {
						sum += data;
					});
				}
				if (sum === 0) return '0%';
				let percentage = (value * 100 / sum).toFixed(0) + "%";
				return percentage;
			},
			display: (ctx) => {
				let sum = 0;
				if (ctx.chart.data.datasets && ctx.chart.data.datasets[0] && ctx.chart.data.datasets[0].data) {
					let dataArr = ctx.chart.data.datasets[0].data;
					dataArr.map(data => sum += data);
				}
				if (sum === 0) return false;
				return (ctx.dataset.data[ctx.dataIndex] / sum) > 0;
			}
		}
	},
	layout: {
		padding: 20
	},
	borderWidth: 0,
	hoverOffset: 4
};

/**
 * Helper to get icon and color info for tooltip labels.
 */
function getTooltipInfo(label) {
	// 1. Check Media Types
	if (ICON_MAP[label]) {
		const typeColorClass = TYPE_COLOR_MAP[label] || '';
		const colorMatch = typeColorClass.match(/text-([a-z]+)-[0-9]+/);
		const baseColor = colorMatch ? colorMatch[1] : 'zinc';
		
		const hexMap = {
			violet: '#a78bfa',
			pink: '#f472b6',
			blue: '#60a5fa',
			red: '#f87171',
			amber: '#fbbf24',
			sky: '#38bdf8',
			fuchsia: '#e879f9',
			emerald: '#34d399',
			zinc: '#a1a1aa'
		};

		return {
			icon: ICON_MAP[label],
			color: hexMap[baseColor] || '#a1a1aa'
		};
	}

	// 2. Check Statuses
	if (STATUS_ICON_MAP[label]) {
		const statusColorClass = STATUS_COLOR_MAP[label] || '';
		const colorMatch = statusColorClass.match(/text-([a-z]+)-[0-9]+/);
		const baseColor = colorMatch ? colorMatch[1] : 'zinc';
		
		const hexMap = {
			zinc: '#a1a1aa',
			sky: '#38bdf8',
			red: '#f87171',
			orange: '#fb923c',
			fuchsia: '#e879f9',
			emerald: '#34d399'
		};

		return {
			icon: STATUS_ICON_MAP[label],
			color: hexMap[baseColor] || '#a1a1aa'
		};
	}

	// 3. Check Ratings
	const ratingValue = Object.keys(RATING_LABELS).find(key => RATING_LABELS[key] === label);
	if (ratingValue) {
		const hexMap = {
			1: '#f87171', // Red
			2: '#fbbf24', // Amber
			3: '#60a5fa', // Blue
			4: '#34d399'  // Emerald
		};
		return {
			icon: 'star',
			color: hexMap[ratingValue],
			rating: Number(ratingValue)
		};
	}

	return { icon: 'info', color: '#a1a1aa' };
}

/**
 * Creates or retrieves the external tooltip element.
 */
const getOrCreateTooltip = (chart) => {
	let tooltipEl = chart.canvas.parentNode.querySelector('div.custom-chart-tooltip');

	if (!tooltipEl) {
		tooltipEl = document.createElement('div');
		tooltipEl.classList.add('custom-chart-tooltip');
		tooltipEl.style.background = 'rgba(24, 24, 27, 0.95)';
		tooltipEl.style.borderRadius = '12px';
		tooltipEl.style.color = 'white';
		tooltipEl.style.opacity = 1;
		tooltipEl.style.pointerEvents = 'none';
		tooltipEl.style.position = 'absolute';
		tooltipEl.style.transform = 'translate(-50%, 0)';
		tooltipEl.style.transition = 'all .1s ease';
		tooltipEl.style.padding = '10px 14px';
		tooltipEl.style.zIndex = '100';
		tooltipEl.style.backdropFilter = 'blur(8px)';
		tooltipEl.style.border = '1px solid rgba(255, 255, 255, 0.1)';
		tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
		tooltipEl.style.minWidth = '140px';
		tooltipEl.style.whiteSpace = 'nowrap';
		tooltipEl.style.overflow = 'hidden';

		const table = document.createElement('table');
		table.style.margin = '0px';
		table.style.width = '100%';

		tooltipEl.appendChild(table);
		chart.canvas.parentNode.appendChild(tooltipEl);
	}

	return tooltipEl;
};

/**
 * External Tooltip Handler for Chart.js
 */
function externalTooltipHandler(context) {
	const { chart, tooltip } = context;
	const tooltipEl = getOrCreateTooltip(chart);

	if (tooltip.opacity === 0) {
		tooltipEl.style.opacity = 0;
		return;
	}

	if (tooltip.body) {
		const titleLines = tooltip.title || [];

		const tableHead = document.createElement('thead');
		titleLines.forEach(title => {
			// Deduplication logic: 
			// 1. If the chart is a Doughnut/Pie, usually the header is a repeat of the label.
			// 2. If title matches the first data point label, skip it.
			const firstLabel = tooltip.dataPoints[0]?.label;
			if (title === firstLabel && tooltip.dataPoints.length === 1) return;

			const tr = document.createElement('tr');
			tr.style.borderWidth = 0;
			const th = document.createElement('th');
			th.style.borderWidth = 0;
			th.style.textAlign = 'left';
			th.style.paddingBottom = '6px';
			th.style.fontSize = '12px';
			th.style.fontWeight = '700';
			th.style.color = 'rgba(255,255,255,0.6)';
			th.style.textTransform = 'uppercase';
			th.innerText = title;
			tr.appendChild(th);
			tableHead.appendChild(tr);
		});

		const tableBody = document.createElement('tbody');
		// Reverse the datapoints so the tooltip order matches the visual stack order (Top dataset = Top tooltip item)
		const dataPoints = [...tooltip.dataPoints].reverse();

		dataPoints.forEach((dataPoint) => {
			const tr = document.createElement('tr');
			tr.style.backgroundColor = 'transparent';
			tr.style.borderWidth = 0;

			const td = document.createElement('td');
			td.style.borderWidth = 0;
			td.style.display = 'flex';
			td.style.alignItems = 'center';
			td.style.gap = '8px';
			td.style.padding = '4px 0';

			// Robust label selection: 
			// 1. For Doughnut/Pie, dataPoint.label is the category (e.g. "Anime")
			// 2. For Line/Bar with multiple datasets, dataPoint.dataset.label is the category
			// 3. For single-dataset lines, dataPoint.dataset.label might be "Total Items"
			let label = dataPoint.dataset.label;
			const categoryLabel = dataPoint.label;

			// If dataset label is generic or missing, use the category/item label
			if (!label || label === 'Items' || label === 'Total Items' || label === 'Counts' || label === 'Time Spent') {
				label = categoryLabel;
			}

			const rawValue = dataPoint.parsed.y !== undefined ? dataPoint.parsed.y : dataPoint.parsed;
			let value = dataPoint.formattedValue;

			// For consumption charts, ensure we use formatMinutes for the tooltip values
			if (chart.canvas.id === 'consumptionGrowthChart' || chart.canvas.id === 'consumptionSpreadChart') {
				value = formatMinutes(rawValue);
			}

			const info = getTooltipInfo(label);

			const iconSpan = document.createElement('span');
			iconSpan.style.display = 'flex';
			iconSpan.style.alignItems = 'center';
			iconSpan.style.justifyContent = 'center';

			if (info.rating) {
				// Masterpiece = 4 stars, Good = 3, etc.
				iconSpan.innerHTML = `<div style="display: flex; gap: 1px;">${Array(info.rating).fill(`<i data-lucide="star" style="width: 10px; height: 10px; color: ${info.color}; fill: ${info.color};"></i>`).join('')}</div>`;
			} else {
				iconSpan.innerHTML = `<i data-lucide="${info.icon}" style="width: 14px; height: 14px; color: ${info.color};"></i>`;
			}

			const labelSpan = document.createElement('span');
			labelSpan.style.fontSize = '13px';
			labelSpan.style.fontWeight = '500';
			labelSpan.innerText = label;

			const valueSpan = document.createElement('span');
			valueSpan.style.marginLeft = 'auto';
			valueSpan.style.fontSize = '13px';
			valueSpan.style.fontWeight = '700';
			valueSpan.innerText = value;
			valueSpan.style.color = info.color;

			td.appendChild(iconSpan);
			td.appendChild(labelSpan);
			td.appendChild(valueSpan);
			tr.appendChild(td);
			tableBody.appendChild(tr);
		});

		// Add Total Row for multi-dataset charts (Like Momentum/Spread)
		if (dataPoints.length > 1) {
			const totalMins = dataPoints.reduce((sum, dp) => sum + (dp.parsed.y !== undefined ? dp.parsed.y : dp.parsed), 0);
			
			const tr = document.createElement('tr');
			tr.style.borderTop = '1px solid rgba(255, 255, 255, 0.15)';
			tr.style.marginTop = '4px';

			const td = document.createElement('td');
			td.style.display = 'flex';
			td.style.alignItems = 'center';
			td.style.gap = '8px';
			td.style.padding = '6px 0 2px 0';

			const iconSpan = document.createElement('span');
			iconSpan.innerHTML = '<i data-lucide="sigma" style="width: 14px; height: 14px; color: #a1a1aa;"></i>';

			const labelSpan = document.createElement('span');
			labelSpan.style.fontSize = '13px';
			labelSpan.style.fontWeight = '700';
			labelSpan.style.color = '#e4e4e7';
			labelSpan.innerText = 'TOTAL';

			const valueSpan = document.createElement('span');
			valueSpan.style.marginLeft = 'auto';
			valueSpan.style.fontSize = '13px';
			valueSpan.style.fontWeight = '800';
			
			// Format correctly if it's a consumption chart
			if (chart.canvas.id === 'consumptionGrowthChart' || chart.canvas.id === 'consumptionSpreadChart') {
				valueSpan.innerText = formatMinutes(totalMins);
			} else {
				valueSpan.innerText = totalMins;
			}
			valueSpan.style.color = '#ffffff';

			td.appendChild(iconSpan);
			td.appendChild(labelSpan);
			td.appendChild(valueSpan);
			tr.appendChild(td);
			tableBody.appendChild(tr);
		}

		const tableFoot = document.createElement('tfoot');
		const footerLines = tooltip.footer || [];
		footerLines.forEach(footer => {
			const tr = document.createElement('tr');
			tr.style.borderWidth = 0;
			const td = document.createElement('td');
			td.style.borderWidth = 0;
			td.style.paddingTop = '8px';
			td.style.marginTop = '4px';
			td.style.borderTop = '1px solid rgba(255,255,255,0.1)';
			td.style.fontSize = '12px';
			td.style.fontWeight = '700';
			td.style.color = 'rgba(255,255,255,0.8)';
			td.innerText = footer;
			tr.appendChild(td);
			tableFoot.appendChild(tr);
		});

		const tableRoot = tooltipEl.querySelector('table');
		while (tableRoot.firstChild) tableRoot.firstChild.remove();
		tableRoot.appendChild(tableHead);
		tableRoot.appendChild(tableBody);
		tableRoot.appendChild(tableFoot);

		safeCreateIcons(tooltipEl);
	}

	const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
	tooltipEl.style.opacity = 1;

	// Boundary Detection: If caret is on the right side, shift tooltip left
	const chartWidth = chart.width;
	const tooltipWidth = tooltipEl.offsetWidth || 160;
	const x = tooltip.caretX;

	if (x + (tooltipWidth / 2) > chartWidth) {
		// Overflow Right -> Align right edge of tooltip with caret or near it
		tooltipEl.style.left = positionX + x + 'px';
		tooltipEl.style.transform = 'translate(-100%, 0)';
	} else if (x - (tooltipWidth / 2) < 0) {
		// Overflow Left -> Align left edge
		tooltipEl.style.left = positionX + x + 'px';
		tooltipEl.style.transform = 'translate(0, 0)';
	} else {
		// Centered
		tooltipEl.style.left = positionX + x + 'px';
		tooltipEl.style.transform = 'translate(-50%, 0)';
	}

	tooltipEl.style.top = positionY + tooltip.caretY + 'px';
}


/**
 * Calculates statistics from the current state items.
 */
function calculateStats() {
	const typeCounts = {};
	const statusCounts = {};
	const ratingCounts = { 'Bad': 0, 'Ok': 0, 'Good': 0, 'Masterpiece': 0 };
	const consumedByType = {}; // time by type (normal)
	const consumedByTypeStrict = {}; // time by type (strict)
	const consumedByStatus = {}; // time by status
	let totalMinutes = 0;
	let totalMinutesStrict = 0;

	// Apply Global Filters (Types + Timeframe) to the calculation
	let filteredItems = state.items.filter(item => activeMediaTypes.includes(item.type));

	// Apply Timeframe Filter
	filteredItems = filteredItems.filter(item => isItemInTimeframe(item, state.activeTimeframe));

	let totalItems = filteredItems.length;
	let completedItems = 0;
	let totalRatings = 0;
	let ratedCount = 0;

	// Calculate stats based ONLY on filtered items
	filteredItems.forEach(item => {
		// Type Stats
		typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;

		// Status Stats
		statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;

		if (item.status === 'Completed') completedItems++;
		if (item.rating && item.rating > 0) {
			const r = Number(item.rating);
			let bucket = 'Ok';

			// User defined 1-4 scale:
			if (r === 1) bucket = 'Bad';
			else if (r === 2) bucket = 'Ok';
			else if (r === 3) bucket = 'Good';
			else if (r === 4) bucket = 'Masterpiece';

			// Legacy/Scale 10 detections
			if (r > 4) {
				if (r <= 3) bucket = 'Bad';
				else if (r <= 6) bucket = 'Ok';
				else if (r <= 8) bucket = 'Good';
				else bucket = 'Masterpiece';
			}

			ratingCounts[bucket]++;
			totalRatings += r;
			ratedCount++;
		}

		// Consumption Stats (Normal)
		const minsNormal = getItemConsumedMinutes(item, false);
		if (minsNormal > 0) {
			totalMinutes += minsNormal;
			consumedByType[item.type] = (consumedByType[item.type] || 0) + minsNormal;
			consumedByStatus[item.status] = (consumedByStatus[item.status] || 0) + minsNormal;
		}

		// Consumption Stats (Strict)
		const minsStrict = getItemConsumedMinutes(item, true);
		if (minsStrict > 0) {
			totalMinutesStrict += minsStrict;
			consumedByTypeStrict[item.type] = (consumedByTypeStrict[item.type] || 0) + minsStrict;
		}
	});

	const avgRating = ratedCount > 0 ? (totalRatings / ratedCount).toFixed(1) : '0.0';

	return { 
		typeCounts, statusCounts, ratingCounts, totalItems, completedItems, avgRating, filteredItems, 
		totalMinutes, consumedByType, consumedByStatus,
		totalMinutesStrict, consumedByTypeStrict
	};
}

/**
 * Renders the stats modal content.
 */
export function openStatsModal() {
	if (window.closeModal) window.closeModal();
	if (window.closeExportModal) window.closeExportModal();
	if (window.closeInfoModal) window.closeInfoModal();

	const modal = document.getElementById('statsModal');
	modal.classList.remove('hidden');
	setTimeout(() => {
		modal.classList.remove('opacity-0');
		document.getElementById('statsModalContent').classList.remove('scale-95');
	}, 10);

	renderGlobalFilters();
	renderTimeframeFilters();
	updateActiveOptions();
	updateCharts();
}
window.openStatsModal = openStatsModal;

window.setChartType = (chartName, type) => {
	const newTypes = { ...state.statsChartTypes };
	newTypes[chartName] = type;
	setState('statsChartTypes', newTypes);
	updateCharts();
	updateActiveOptions();
};

window.setMediaGrowthMode = (mode) => {
	const newTypes = { ...state.statsChartTypes };
	newTypes.mediaGrowthMode = mode;
	setState('statsChartTypes', newTypes);
	updateCharts();
};


function updateCharts() {
	const stats = calculateStats();
	renderMetrics(stats);
	renderCharts(stats);
	renderGrowthChart(stats);
	renderMediaGrowthChart(stats);
	renderRatingChart(stats);
	renderConsumptionGrowthChart(stats);
	renderConsumptionSpreadChart(stats);
	updateStrictTrackingUI();
}

/**
 * Renders the global media type filter buttons.
 */
function renderGlobalFilters() {
	// Make container sticky and full width styling
	const container = document.getElementById('globalFilters');
	if (!container) return;

	container.className = "sticky top-0 z-30 bg-white dark:bg-[#121214] pt-3 pb-4 mb-0 px-8 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2 justify-center transition-all shadow-sm";

	container.innerHTML = MEDIA_TYPES.map(type => {
		const isActive = activeMediaTypes.includes(type);
		const baseColorClass = TYPE_COLOR_MAP[type] || 'text-zinc-600 bg-zinc-100';

		// If active, use the color class. If not, use a grayed out style.
		// We need to parse the color class or just override it safely.
		// A simple way is to use opacity for inactive state so we keep the color identity.

		const combinedClass = isActive
			? baseColorClass + ' opacity-100 ring-2 ring-offset-2 dark:ring-offset-zinc-900 shadow-sm'
			: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 opacity-60 hover:opacity-100';

		const icon = ICON_MAP[type] || 'circle';

		return `
            <button onclick="window.toggleGlobalFilter('${type}')" 
                class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all duration-200 border border-transparent ${combinedClass}">
                <i data-lucide="${icon}" class="w-4 h-4"></i>
                ${type}
            </button>
        `;
	}).join('');

	if (window.lucide) window.lucide.createIcons();
}

/**
 * Helper to get the prioritized date for timeline charts.
 * Prioritizes completedAt for Completed/Anticipating items.
 */
function getItemTimelineDate(item) {
	if (item.completedAt && ['Completed', 'Anticipating'].includes(item.status)) {
		return item.completedAt;
	}
	return item.updatedAt || item.createdAt;
}

/**
 * Calculates if an item falls within the selected timeframe based on prioritized date.
 */
function isItemInTimeframe(item, timeframe) {
	if (timeframe === 'all' || !timeframe) return true;
	const prioritizedDate = getItemTimelineDate(item);
	if (!prioritizedDate) return false;

	const updatedDate = new Date(prioritizedDate);
	const now = new Date();

	switch (timeframe) {
		case 'ytd':
			return updatedDate.getFullYear() === now.getFullYear();
		case '1y':
			const oneYearAgo = new Date(now);
			oneYearAgo.setFullYear(now.getFullYear() - 1);
			return updatedDate >= oneYearAgo;
		case '2y':
			const twoYearsAgo = new Date(now);
			twoYearsAgo.setFullYear(now.getFullYear() - 2);
			return updatedDate >= twoYearsAgo;
		case '2ytd':
			return updatedDate.getFullYear() >= now.getFullYear() - 1;
		case '5y':
			const fiveYearsAgo = new Date(now);
			fiveYearsAgo.setFullYear(now.getFullYear() - 5);
			return updatedDate >= fiveYearsAgo;
		case '10y':
			const tenYearsAgo = new Date(now);
			tenYearsAgo.setFullYear(now.getFullYear() - 10);
			return updatedDate >= tenYearsAgo;
		case 'custom':
			const start = state.statsCustomStart ? new Date(state.statsCustomStart) : null;
			const end = state.statsCustomEnd ? new Date(state.statsCustomEnd) : null;
			if (start && updatedDate < start) return false;
			if (end && updatedDate > end) return false;
			return true;
		default:
			return true;
	}
}

/**
 * Renders the timeframe filter buttons.
 */
/**
 * Updates the visual state of chart type buttons to highlight the active options.
 */
function updateActiveOptions() {
	const buttons = document.querySelectorAll('[data-chart-option]');
	buttons.forEach(btn => {
		const option = btn.getAttribute('data-chart-option');
		const value = btn.getAttribute('data-chart-value');
		const isActive = state.statsChartTypes && state.statsChartTypes[option] === value;

		if (isActive) {
			btn.classList.add('bg-white', 'dark:bg-zinc-700', 'text-zinc-900', 'dark:text-white', 'shadow-sm', 'border', 'border-zinc-200', 'dark:border-zinc-600');
			btn.classList.remove('text-zinc-500', 'dark:text-zinc-400');
		} else {
			btn.classList.remove('bg-white', 'dark:bg-zinc-700', 'text-zinc-900', 'dark:text-white', 'shadow-sm', 'border', 'border-zinc-200', 'dark:border-zinc-600');
			btn.classList.add('text-zinc-500', 'dark:text-zinc-400');
		}
	});
}

function renderTimeframeFilters() {
	const container = document.getElementById('timeframeFilters');
	if (!container) return;

	container.className = "sticky top-[68px] z-30 bg-white dark:bg-[#121214] pb-4 mb-4 px-8 flex flex-wrap gap-2 justify-center transition-all border-b border-zinc-200 dark:border-zinc-800";

	const timeframes = [
		{ id: 'all', label: 'All Time', icon: 'infinity' },
		{ id: 'ytd', label: 'YTD', icon: 'calendar-days' },
		{ id: '1y', label: '1 Year', icon: 'calendar' },
		{ id: '2y', label: '2 Years', icon: 'calendar' },
		{ id: '2ytd', label: '2YTD', icon: 'calendar' },
		{ id: '5y', label: '5 Years', icon: 'history' },
		{ id: '10y', label: '10 Years', icon: 'history' },
		{ id: 'custom', label: 'Custom', icon: 'settings-2' }
	];

	let html = timeframes.map(tf => {
		const isActive = state.activeTimeframe === tf.id;
		const activeClass = isActive 
			? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-md ring-2 ring-zinc-800 dark:ring-zinc-200 ring-offset-2 dark:ring-offset-zinc-900' 
			: 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700';

		return `
			<button onclick="window.setStatsTimeframe('${tf.id}')"
				class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${activeClass}">
				<i data-lucide="${tf.icon}" class="w-3.5 h-3.5"></i>
				${tf.label}
			</button>
		`;
	}).join('');

	if (state.activeTimeframe === 'custom') {
		const startVal = state.statsCustomStart || '';
		const endVal = state.statsCustomEnd || '';
		html += `
			<div class="flex items-center gap-2 ml-4 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-left-2 transition-all">
				<span class="text-[10px] font-bold text-zinc-400 uppercase">Range:</span>
				<input type="date" value="${startVal}" onchange="window.updateStatsCustomDate('start', this.value)" 
					class="bg-transparent text-[10px] font-bold text-zinc-600 dark:text-zinc-300 outline-none focus:text-indigo-500 transition-colors">
				<span class="text-zinc-400">to</span>
				<input type="date" value="${endVal}" onchange="window.updateStatsCustomDate('end', this.value)" 
					class="bg-transparent text-[10px] font-bold text-zinc-600 dark:text-zinc-300 outline-none focus:text-indigo-500 transition-colors">
			</div>
		`;
	}

	container.innerHTML = html;
	if (window.lucide) window.lucide.createIcons();
}

/**
 * Gets the start date for a given timeframe.
 */
function getTimeframeStartDate(timeframe) {
	if (timeframe === 'all' || !timeframe) return null;
	const now = new Date();
	const d = new Date(now);

	switch (timeframe) {
		case 'ytd':
			return new Date(now.getFullYear(), 0, 1);
		case '1y':
			d.setFullYear(now.getFullYear() - 1);
			return d;
		case '2y':
			d.setFullYear(now.getFullYear() - 2);
			return d;
		case '2ytd':
			return new Date(now.getFullYear() - 1, 0, 1);
		case '5y':
			d.setFullYear(now.getFullYear() - 5);
			return d;
		case '10y':
			d.setFullYear(now.getFullYear() - 10);
			return d;
		case 'custom':
			return state.statsCustomStart ? new Date(state.statsCustomStart) : null;
		default:
			return null;
	}
}

window.setStatsTimeframe = (timeframe) => {
	setState('activeTimeframe', timeframe);
	renderTimeframeFilters();
	updateCharts();
	updateActiveOptions();
};

window.updateStatsCustomDate = (type, value) => {
	if (type === 'start') setState('statsCustomStart', value);
	else setState('statsCustomEnd', value);
	updateCharts();
};

window.toggleGlobalFilter = (type) => {
	const idx = activeMediaTypes.indexOf(type);
	if (idx === -1) {
		activeMediaTypes.push(type);
	} else {
		activeMediaTypes.splice(idx, 1);
	}
	renderGlobalFilters();
	updateCharts();
};

export function closeStatsModal() {
	const modal = document.getElementById('statsModal');
	modal.classList.add('opacity-0');
	document.getElementById('statsModalContent').classList.add('scale-95');
	setTimeout(() => {
		modal.classList.add('hidden');
	}, 300);
}
window.closeStatsModal = closeStatsModal;

window.toggleChart = (containerId) => {
	const container = document.getElementById(containerId);
	const chevron = document.getElementById(`chevron-${containerId}`);

	if (container.classList.contains('hidden')) {
		container.classList.remove('hidden');
		chevron.classList.remove('rotate-180');

		// Trigger valid resize for chart since it was hidden
		setTimeout(() => {
			let instance = null;
			if (containerId === 'typeChartContainer') instance = typeChartInstance;
			else if (containerId === 'statusChartContainer') instance = statusChartInstance;
			else if (containerId === 'growthChartContainer') instance = growthChartInstance;
			else if (containerId === 'mediaGrowthChartContainer') instance = mediaGrowthChartInstance;
			else if (containerId === 'ratingChartContainer') instance = ratingChartInstance;
			else if (containerId === 'consumptionGrowthContainer') instance = consumptionGrowthChartInstance;
			else if (containerId === 'consumptionSpreadContainer') instance = consumptionSpreadChartInstance;

			if (instance) {
				instance.resize();
				instance.update('none');
			}
		}, 50);

		if (window.lucide) window.lucide.createIcons();
	} else {
		container.classList.add('hidden');
		chevron.classList.add('rotate-180');
	}
};

function renderMetrics(stats) {
	const container = document.getElementById('keyMetrics');
	if (!container) return;

	// Use generic labels that rely on the filter context

	const completedPlusAnticipating = stats.completedItems + (stats.statusCounts['Anticipating'] || 0);

	// Total Time calculation
	const totalTimeFormatted = formatMinutes(stats.totalMinutes);

	const metrics = [
		{ label: 'Total Items', value: stats.totalItems, icon: 'layers', color: 'text-indigo-500' },
		{ label: 'Time Spent', value: totalTimeFormatted, icon: 'clock', color: 'text-amber-500' },
		{ label: 'Completed + Anticipating', value: completedPlusAnticipating, icon: 'check-circle', color: 'text-emerald-500' },
		{ label: 'Avg Rating', value: stats.avgRating, icon: 'star', color: 'text-amber-500' }
	];

	container.innerHTML = metrics.map(m => `
        <div class="bg-white dark:bg-[#18181b] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
            <div>
                <p class="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">${m.label}</p>
                <p class="text-xl font-black text-zinc-800 dark:text-white mt-1 leading-none">${m.value}</p>
            </div>
            <div class="w-9 h-9 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center ${m.color}">
                <i data-lucide="${m.icon}" class="w-4.5 h-4.5"></i>
            </div>
        </div>
    `).join('');

	if (window.lucide) window.lucide.createIcons();
}


// Renders the key metrics cards

/**
 * Renders a high-fidelity HTML legend for charts.
 */
function renderCustomHTMLLegend(containerId, labels, colors, icons, values, isRating = false, chartName = null) {
	const container = document.getElementById(containerId);
	if (!container) return;

	const ratingStarMap = { 'Bad': 1, 'Ok': 2, 'Good': 3, 'Masterpiece': 4 };

	container.innerHTML = labels.map((label, i) => {
		const color = colors[i];
		const value = values[i];
		if (value === 0) return '';

		let iconHtml = '';
		if (isRating) {
			const count = ratingStarMap[label] || 0;
			iconHtml = `<div class="flex gap-0.5">${Array(count).fill(`<i data-lucide="star" class="w-3 h-3 fill-current"></i>`).join('')}</div>`;
		} else {
			const icon = (icons && icons[i]) || 'circle';
			iconHtml = `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i>`;
		}

		// Add handler if chartName is provided
		const clickHandler = chartName ? `onclick="window.toggleStatsLegend('${chartName}', ${i}, this)"` : '';
		let cursorClass = chartName ? 'cursor-pointer hover:opacity-80' : 'cursor-default';


		// Check persistent state for visual style
		if (chartName && hiddenLegendLabels[chartName] && hiddenLegendLabels[chartName].has(label)) {
			cursorClass += ' opacity-40 line-through grayscale';
		}

		return `
            <div ${clickHandler} class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100/50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-700/30 transition-all hover:scale-105 select-none ${cursorClass}" style="color: ${color}">
                ${iconHtml}
                <span class="text-[10px] font-black uppercase tracking-wider">${label}</span>
                <span class="text-[10px] font-bold opacity-60 ml-0.5">${value}</span>
            </div>
        `;
	}).join('');

	if (window.lucide) window.lucide.createIcons();
}

/**
 * Track hidden items per chart type to persist across re-renders.
 * @type {{status: Set<string>, rating: Set<string>}}
 */
const hiddenLegendLabels = {
	status: new Set(),
	rating: new Set()
};

/**
 * Global handler for toggling chart data visibility via legend.
 */
window.toggleStatsLegend = (chartName, index, element) => {
	let instance = null;
	if (chartName === 'status') instance = statusChartInstance;
	else if (chartName === 'rating') instance = ratingChartInstance;

	if (instance) {
		// Toggle visibility
		instance.toggleDataVisibility(index);
		instance.update();

		// Toggle visual state of the legend item
		element.classList.toggle('opacity-40');
		element.classList.toggle('line-through');
		element.classList.toggle('grayscale');

		// Update persistent state
		const label = instance.data.labels[index];
		if (label) {
			const set = hiddenLegendLabels[chartName];
			if (set) {
				if (set.has(label)) set.delete(label);
				else set.add(label);
			}
		}
	}
};

/**
 * Applies the persistent hidden state to a chart instance.
 * @param {Object} chartInstance - The Chart.js instance.
 * @param {string} chartName - The name of the chart ('status' or 'rating').
 */
function applyHiddenState(chartInstance, chartName) {
	if (chartInstance && chartInstance.data && chartInstance.data.labels) {
		const hiddenSet = hiddenLegendLabels[chartName];
		if (!hiddenSet) return;

		chartInstance.data.labels.forEach((label, index) => {
			if (hiddenSet.has(label)) {
				chartInstance.toggleDataVisibility(index);
			}
		});
		chartInstance.update();
	}
}

/**
 * Helper to get scales based on chart type for distribution charts.
 */
function getScales(chartType) {
	const isDark = document.documentElement.classList.contains('dark');
	const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
	const textColor = isDark ? '#a1a1aa' : '#71717a';

	if (chartType === 'bar') {
		return {
			x: {
				grid: { display: false },
				ticks: { color: textColor, font: { size: 10, weight: 'bold' } }
			},
			y: {
				beginAtZero: true,
				grid: { color: gridColor },
				ticks: { color: textColor, font: { size: 10 } }
			}
		};
	}
	if (chartType === 'polarArea') {
		return {
			r: {
				grid: { color: gridColor },
				angleLines: { color: gridColor },
				ticks: { display: false }
			}
		};
	}
	return {}; // No scales for pie/doughnut
}

/**
 * Renders or updates the Chart.js instances.
 */
function renderCharts(stats) {
	const typeCtx = document.getElementById('typeChart');
	const statusCtx = document.getElementById('statusChart');

	if (!typeCtx || !statusCtx) return;

	// Use persisted chart types with safe fallbacks
	const chartTypes = state.statsChartTypes || {};
	const getType = (name, fallback) => chartTypes[name] || fallback;

	const typeChartType = getType('typeChart', 'doughnut');
	const statusChartType = getType('statusChart', 'doughnut');
	const ratingChartType = getType('ratingChart', 'doughnut');
	const growthChartType = getType('growthChart', 'line');
	const mediaGrowthChartType = getType('mediaGrowthChart', 'line');

	// Register plugin safely
	if (typeof ChartDataLabels !== 'undefined') {
		Chart.register(ChartDataLabels);
	}

	// --- Type Chart ---
	const typeLabels = Object.keys(stats.typeCounts).sort();
	const typeData = typeLabels.map(l => stats.typeCounts[l]);
	const typeColors = typeLabels.map(l => getTypeColorHex(l));

	if (typeChartInstance) typeChartInstance.destroy();

	typeChartInstance = new Chart(typeCtx, {
		type: typeChartType,
		data: {
			labels: typeLabels,
			datasets: [{
				data: typeData,
				backgroundColor: typeColors,
				borderWidth: 0,
				borderRadius: 5,
				spacing: 2
			}]
		},
		options: {
			...COMMON_CHART_OPTIONS,
			cutout: typeChartType === 'doughnut' ? '60%' : 0,
			scales: getScales(typeChartType),
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				legend: { display: false },
				datalabels: {
					...COMMON_CHART_OPTIONS.plugins.datalabels,
					display: (ctx) => ['doughnut', 'pie', 'polarArea'].includes(typeChartType)
				}
			}
		}
	});



	// --- Status Chart ---
	const statusOrder = ['Completed', 'Reading/Watching', 'Planning', 'Paused', 'Dropped', 'Anticipating'];
	const rawStatusLabels = Object.keys(stats.statusCounts).sort((a, b) => {
		const idxA = statusOrder.indexOf(a);
		const idxB = statusOrder.indexOf(b);
		return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
	});
	const statusData = rawStatusLabels.map(l => stats.statusCounts[l]);
	const statusColors = rawStatusLabels.map(l => getStatusColorHex(l));
	const statusIcons = rawStatusLabels.map(l => STATUS_ICON_MAP[l] || 'circle');

	if (statusChartInstance) statusChartInstance.destroy();

	statusChartInstance = new Chart(statusCtx, {
		type: statusChartType,
		data: {
			labels: rawStatusLabels,
			datasets: [{
				data: statusData,
				backgroundColor: statusColors,
				borderWidth: 0,
				borderRadius: 5,
				spacing: 2
			}]
		},
		options: {
			...COMMON_CHART_OPTIONS,
			cutout: statusChartType === 'doughnut' ? '60%' : 0,
			scales: getScales(statusChartType),
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				title: { display: false },
				legend: { display: false },
				datalabels: {
					...COMMON_CHART_OPTIONS.plugins.datalabels,
					display: (ctx) => ['doughnut', 'pie', 'polarArea'].includes(statusChartType)
				}
			}
		}
	});

	// Apply persistent hidden state
	applyHiddenState(statusChartInstance, 'status');

	// Pass 'status' as the chartName argument
	renderCustomHTMLLegend('statusLegend', rawStatusLabels, statusColors, statusIcons, statusData, false, 'status');
}

function getTypeColorHex(type) {
	const colors = {
		'Anime': '#7c3aed', 'Manga': '#db2777', 'Book': '#2563eb', 'Movie': '#dc2626', 'Series': '#d97706'
	};
	return colors[type] || '#71717a';
}

function getStatusColorHex(status) {
	const colors = {
		'Planning': '#52525b', 'Watching': '#0284c7', 'Reading': '#0284c7', 'Reading/Watching': '#0284c7',
		'Completed': '#059669', 'Paused': '#ea580c', 'On Hold': '#ea580c', 'Dropped': '#dc2626',
		'Anticipating': '#c026d3'
	};
	return colors[status] || '#71717a';
}

function renderGrowthChart(stats) {
	const ctx = document.getElementById('growthChart');
	if (!ctx) return;

	const growthChartType = (state.statsChartTypes && state.statsChartTypes.growthChart) || 'line';

	// Use filtered items and prioritized date for growth chart!
	const sortedItems = [...stats.filteredItems]
		.filter(i => getItemTimelineDate(i))
		.sort((a, b) => new Date(getItemTimelineDate(a)) - new Date(getItemTimelineDate(b)));

	if (sortedItems.length === 0) {
		// Render empty chart or clear it
		if (growthChartInstance) growthChartInstance.destroy();
		return;
	}

	const dateMap = new Map();
	sortedItems.forEach(item => {
		try {
			const date = new Date(getItemTimelineDate(item)).toISOString().split('T')[0];
			dateMap.set(date, (dateMap.get(date) || 0) + 1);
		} catch (e) { }
	});

	const uniqueDates = Array.from(dateMap.keys()).sort();
	let cumulative = 0;
	const labels = [];
	const data = [];

	const startDate = getTimeframeStartDate(state.activeTimeframe);
	let filteredSortedItems = sortedItems;

	if (startDate) {
		const startIso = startDate.toISOString().split('T')[0];
		// Calculate items edited BEFORE the timeframe
		const baselineItems = sortedItems.filter(i => new Date(getItemTimelineDate(i)) < startDate);
		cumulative = baselineItems.length;

		// Filter items to strictly during the timeframe
		filteredSortedItems = sortedItems.filter(i => new Date(getItemTimelineDate(i)) >= startDate);

		// If the first date isn't exactly the start date, prepend the start date with the baseline
		const firstItemDate = filteredSortedItems.length > 0 ? new Date(getItemTimelineDate(filteredSortedItems[0])).toISOString().split('T')[0] : null;
		if (firstItemDate !== startIso) {
			labels.push(startIso);
			data.push(cumulative);
		}
	}

	const subDateMap = new Map();
	filteredSortedItems.forEach(item => {
		try {
			const date = new Date(getItemTimelineDate(item)).toISOString().split('T')[0];
			subDateMap.set(date, (subDateMap.get(date) || 0) + 1);
		} catch (e) { }
	});

	const subDates = Array.from(subDateMap.keys()).sort();
	subDates.forEach(date => {
		cumulative += subDateMap.get(date);
		labels.push(date);
		data.push(cumulative);
	});

	if (growthChartInstance) growthChartInstance.destroy();

	const isDark = document.documentElement.classList.contains('dark');
	const accentColor = isDark ? '#fbbf24' : '#f59e0b';
	const fillColor = isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(245, 158, 11, 0.1)';

	const lineOptions = JSON.parse(JSON.stringify(COMMON_CHART_OPTIONS));
	if (lineOptions.plugins.datalabels) lineOptions.plugins.datalabels.display = false;

	growthChartInstance = new Chart(ctx, {
		type: growthChartType,
		data: {
			labels: labels,
			datasets: [{
				label: 'Total Items',
				data: data,
				borderColor: accentColor,
				backgroundColor: fillColor,
				borderWidth: 2,
				fill: true,
				tension: 0.4,
				pointRadius: 0,
				pointHoverRadius: 4
			}]
		},
		options: {
			...lineOptions,
			scales: {
				x: {
					grid: { display: false },
					ticks: {
						display: true,
						color: isDark ? '#a1a1aa' : '#71717a',
						font: { size: 10 },
						maxRotation: 45,
						autoSkip: true,
						maxTicksLimit: 10
					}
				},
				y: {
					grid: {
						color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
						borderDash: [5, 5]
					},
					ticks: {
						display: true,
						color: isDark ? '#a1a1aa' : '#71717a',
						font: { family: "'Inter', sans-serif", size: 10 }
					},
					beginAtZero: true
				}
			},
			interaction: { intersect: false, mode: 'index' },
			plugins: {
				...lineOptions.plugins,
				legend: { display: false },
				datalabels: { display: false },
				tooltip: {
					enabled: false,
					external: externalTooltipHandler
				}
			}
		}
	});
}

function renderMediaGrowthChart(stats) {
	const ctx = document.getElementById('mediaGrowthChart');
	if (!ctx) return;

	const mediaGrowthChartType = (state.statsChartTypes && state.statsChartTypes.mediaGrowthChart) || 'line';
	const mediaGrowthMode = (state.statsChartTypes && state.statsChartTypes.mediaGrowthMode) || 'stacked';

	const sortedItems = [...stats.filteredItems]
		.filter(i => getItemTimelineDate(i))
		.sort((a, b) => new Date(getItemTimelineDate(a)) - new Date(getItemTimelineDate(b)));

	if (sortedItems.length === 0) {
		if (mediaGrowthChartInstance) mediaGrowthChartInstance.destroy();
		return;
	}

	let dates = new Set();
	sortedItems.forEach(item => {
		try {
			dates.add(new Date(getItemTimelineDate(item)).toISOString().split('T')[0]);
		} catch (e) { }
	});
	
	const startDate = getTimeframeStartDate(state.activeTimeframe);
	let startIso = null;
	if (startDate) {
		startIso = startDate.toISOString().split('T')[0];
		dates.add(startIso);
	}
	
	const sortedDates = Array.from(dates).sort();

	// Initialize tracking for each media type
	const typeData = {};
	MEDIA_TYPES.forEach(type => {
		typeData[type] = {
			counts: {},
			cumulative: []
		};
	});

	sortedItems.forEach(item => {
		try {
			const date = new Date(getItemTimelineDate(item)).toISOString().split('T')[0];
			if (typeData[item.type]) {
				typeData[item.type].counts[date] = (typeData[item.type].counts[date] || 0) + 1;
			}
		} catch (e) { }
	});

	// Calculate Baselines if timeframe is active
	sortedDates.forEach(date => {
		MEDIA_TYPES.forEach(type => {
			const prevTotal = typeData[type].cumulative.length > 0
				? typeData[type].cumulative[typeData[type].cumulative.length - 1]
				: 0;
			
			// If this is the startIso and we have a startDate, initialize with baseline
			if (date === startIso && typeData[type].cumulative.length === 0) {
				const baselineCount = sortedItems.filter(i => i.type === type && new Date(getItemTimelineDate(i)) < startDate).length;
				typeData[type].cumulative.push(baselineCount);
			} else {
				const dayCount = typeData[type].counts[date] || 0;
				typeData[type].cumulative.push(prevTotal + dayCount);
			}
		});
	});

	if (mediaGrowthChartInstance) mediaGrowthChartInstance.destroy();

	if (mediaGrowthChartInstance) mediaGrowthChartInstance.destroy();

	const isLine = mediaGrowthChartType === 'line';

	const datasets = MEDIA_TYPES.map(type => {
		const color = getTypeColorHex(type);
		const fillColor = color + '22';

		return {
			label: type,
			data: typeData[type].cumulative,
			borderColor: color,
			backgroundColor: isLine ? fillColor : color,
			borderWidth: isLine ? 2 : 0,
			fill: true,
			tension: 0.4,
			pointRadius: 0,
			pointHoverRadius: 4,
			stack: 'mediaStack',
		};
	}).filter(ds => activeMediaTypes.includes(ds.label));


	const isDark = document.documentElement.classList.contains('dark');
	const lineOptions = JSON.parse(JSON.stringify(COMMON_CHART_OPTIONS));
	if (lineOptions.plugins.datalabels) lineOptions.plugins.datalabels.display = false;

	mediaGrowthChartInstance = new Chart(ctx, {
		type: mediaGrowthChartType,
		data: {
			labels: sortedDates,
			datasets: datasets
		},
		options: {
			...lineOptions,
			scales: {
				x: {
					grid: { display: false },
					ticks: {
						display: true,
						color: isDark ? '#a1a1aa' : '#71717a',
						font: { size: 10 },
						maxRotation: 45,
						autoSkip: true,
						maxTicksLimit: 10
					}
				},
				y: {
					stacked: true,
					grid: {
						color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)',
						borderDash: [5, 5]
					},
					ticks: {
						display: true,
						color: isDark ? '#a1a1aa' : '#71717a',
						font: { family: "'Inter', sans-serif", size: 10 },
						callback: value => Math.abs(value)
					},
					beginAtZero: true
				}
			},
			interaction: { intersect: false, mode: 'index' },
			plugins: {
				...lineOptions.plugins,
				legend: { display: false },
				tooltip: {
					enabled: false,
					external: externalTooltipHandler
				},
				datalabels: { display: false }
			}
		}
	});
}






function renderRatingChart(stats) {
	const ctx = document.getElementById('ratingChart');
	if (!ctx) return;

	const ratingChartType = (state.statsChartTypes && state.statsChartTypes.ratingChart) || 'doughnut';

	const rawLabels = ['Bad', 'Ok', 'Good', 'Masterpiece'];
	const data = rawLabels.map(l => stats.ratingCounts[l]);

	if (ratingChartInstance) ratingChartInstance.destroy();

	const isDark = document.documentElement.classList.contains('dark');
	const ratingColors = [
		isDark ? '#ef4444' : '#dc2626', // Bad - Red
		isDark ? '#f59e0b' : '#d97706', // Ok - Amber
		isDark ? '#3b82f6' : '#2563eb', // Good - Blue
		isDark ? '#10b981' : '#059669' // Masterpiece - Emerald
	];

	ratingChartInstance = new Chart(ctx, {
		type: ratingChartType,
		data: {
			labels: rawLabels,
			datasets: [{
				label: 'Items',
				data: data,
				backgroundColor: ratingColors,
				borderRadius: 4,
				borderSkipped: false
			}]
		},
		options: {
			...COMMON_CHART_OPTIONS,
			cutout: ratingChartType === 'doughnut' ? '60%' : 0,
			scales: getScales(ratingChartType),
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				legend: { display: false }, // Using HTML legend
				datalabels: {
					...COMMON_CHART_OPTIONS.plugins.datalabels,
					display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0
				}
			}
		}
	});

	// Apply persistent hidden state
	applyHiddenState(ratingChartInstance, 'rating');

	renderCustomHTMLLegend('ratingLegend', rawLabels, ratingColors, [], data, true, 'rating');
}


// ============================================================================
// CONSUMPTION TIME CALCULATIONS
// ============================================================================

/**
 * Parses progress strings like "Ep 12", "Ch. 5", "15/24" to extract the current count.
 */
function parseProgressValue(str) {
	if (!str || typeof str !== 'string') return 0;
	
	// Pattern 1: Look for "current / total" (e.g., "15 / 24")
	const slashMatch = str.match(/(\d+)\s*\/\s*\d+/);
	if (slashMatch) return parseInt(slashMatch[1]);
	
	// Pattern 2: Look for numbers following common prefixes
	const prefixMatch = str.match(/(?:ep|episode|ch|chapter|v|vol|volume|p|page|part|#)\s*(\d+)/gi);
	if (prefixMatch) {
		const lastMatch = prefixMatch[prefixMatch.length - 1];
		const num = lastMatch.match(/\d+/);
		if (num) return parseInt(num[0]);
	}
	
	// Pattern 3: Discrete numbers, skipping those that look like standalone years
	const allNums = str.match(/\d+/g);
	if (allNums) {
		// Heuristic: If multiple numbers, pick the one that isn't a year (1900-2100)
		if (allNums.length > 1) {
			const nonYear = allNums.find(n => {
				const v = parseInt(n);
				return v < 1900 || v > 2100;
			});
			if (nonYear) return parseInt(nonYear);
		}
		// If only one number and it looks like a year, be skeptical unless it's small
		const firstVal = parseInt(allNums[0]);
		if (firstVal >= 1900 && firstVal <= 2100 && str.toLowerCase().includes('started')) return 0;
		return firstVal;
	}
	
	return 0;
}

/**
 * Calculates estimated minutes spent on a single item.
 */
function getItemConsumedMinutes(item, strict = false) {
	if (!['Completed', 'Anticipating'].includes(item.status)) return 0;

	const type = item.type;
	const isCompleted = item.status === 'Completed';
	const rereads = parseInt(item.rereadCount || 0);
	const multiplier = 1 + rereads;
	let progress = parseProgressValue(item.progress);

	// Defaults (mins)
	const DEFAULT_ANIME_DUR = 24;
	const DEFAULT_MANGA_MINS_PER_CH = 5;
	const DEFAULT_MOVIE_DUR = 100;
	const DEFAULT_WORDS_PER_MIN = 250;

	if (['Anime', 'Series'].includes(type)) {
		let totalEp = item.episodeCount || 12; // Default to 12 if missing
		let count = isCompleted ? totalEp : progress;
		if (item.episodeCount && count > item.episodeCount) count = item.episodeCount;
		
		const explicitDur = item.avgDurationMinutes;
		const hasExplicitData = explicitDur && explicitDur > 0;
		if (strict && !hasExplicitData && !item.episodeCount) return 0;
		
		let dur = hasExplicitData ? explicitDur : DEFAULT_ANIME_DUR;
		if (dur > 240 && count > 1) return dur * multiplier;
		return count * dur * multiplier;
	}

	if (type === 'Manga') {
		let totalCh = item.chapterCount || 60; // Default to 60 chapters (5 hours) if missing 
		let count = isCompleted ? totalCh : progress;
		if (item.chapterCount && count > item.chapterCount) count = item.chapterCount;
		
		if (strict && !item.chapterCount && !item.progress && !isCompleted) return 0;
		
		return count * DEFAULT_MANGA_MINS_PER_CH * multiplier;
	}

	if (type === 'Book') {
		const MAX_BOOK_MINS = 20000;
		
		let mins = 0;
		const hasWordData = item.wordCount && item.wordCount > 100;
		
		if (strict && !hasWordData) return 0;

		if (hasWordData) {
			mins = item.wordCount / DEFAULT_WORDS_PER_MIN;
		} else if (isCompleted) {
			mins = 100000 / DEFAULT_WORDS_PER_MIN; // 100k words default = 400 mins
		}
		
		return Math.min(mins, MAX_BOOK_MINS) * multiplier;
	}

	if (type === 'Movie') {
		const explicitDur = item.avgDurationMinutes;
		if (strict && !explicitDur) return 0;
		
		const dur = explicitDur || (isCompleted ? DEFAULT_MOVIE_DUR : 0);
		return dur * multiplier;
	}

	return 0;
}

/**
 * Formats minutes into human-readable string (e.g., "1d 12h 30m").
 */
function formatMinutes(totalMins) {
	if (!totalMins || totalMins <= 0) return '0m';
	
	const minsInDay = 1440;
	const minsInHour = 60;

	const days = Math.floor(totalMins / minsInDay);
	const hours = Math.floor((totalMins % minsInDay) / minsInHour);
	const mins = Math.round(totalMins % minsInHour);

	let parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

	return parts.slice(0, 2).join(' '); // Keep it concise for UI
}

// ============================================================================
// CONSUMPTION CHARTS
// ============================================================================

function renderConsumptionGrowthChart(stats) {
	const ctx = document.getElementById('consumptionGrowthChart');
	if (!ctx) return;

	const chartType = (state.statsChartTypes && state.statsChartTypes.consumptionGrowthChart) || 'line';
	if (consumptionGrowthChartInstance) consumptionGrowthChartInstance.destroy();

	const sortedItems = [...stats.filteredItems]
		.filter(i => getItemTimelineDate(i))
		.sort((a, b) => new Date(getItemTimelineDate(a)) - new Date(getItemTimelineDate(b)));

	if (sortedItems.length === 0) return;

	let dates = new Set();
	sortedItems.forEach(item => {
		try { dates.add(new Date(getItemTimelineDate(item)).toISOString().split('T')[0]); } catch (e) { }
	});

	const startDate = getTimeframeStartDate(state.activeTimeframe);
	let startIsoStr = null;
	if (startDate) {
		startIsoStr = startDate.toISOString().split('T')[0];
		dates.add(startIsoStr);
	}

	const sortedDates = Array.from(dates).sort();

	// Initialize tracking for each media type
	const typeData = {};
	MEDIA_TYPES.forEach(type => {
		typeData[type] = {
			counts: {},
			cumulative: []
		};
	});

	sortedItems.forEach(item => {
		try {
			const date = new Date(getItemTimelineDate(item)).toISOString().split('T')[0];
			const mins = getItemConsumedMinutes(item, state.statsStrictTrackingMomentum);
			if (typeData[item.type] && mins > 0) {
				typeData[item.type].counts[date] = (typeData[item.type].counts[date] || 0) + mins;
			}
		} catch (e) { }
	});

	// Calculate Cumulative Stats
	sortedDates.forEach(date => {
		MEDIA_TYPES.forEach(type => {
			const prevTotal = typeData[type].cumulative.length > 0
				? typeData[type].cumulative[typeData[type].cumulative.length - 1]
				: 0;

			if (date === startIsoStr && typeData[type].cumulative.length === 0) {
				// Base: sum items edited BEFORE the timeframe
				const baselineMins = sortedItems
					.filter(i => i.type === type && new Date(getItemTimelineDate(i)) < startDate)
					.reduce((sum, i) => sum + getItemConsumedMinutes(i, state.statsStrictTrackingMomentum), 0);
				typeData[type].cumulative.push(baselineMins);
			} else {
				const dayMins = typeData[type].counts[date] || 0;
				typeData[type].cumulative.push(prevTotal + dayMins);
			}
		});
	});

	const isDark = document.documentElement.classList.contains('dark');
	const isLine = chartType === 'line';
	const datasets = MEDIA_TYPES.map(type => {
		const color = getTypeColorHex(type);
		return {
			label: type,
			data: typeData[type].cumulative,
			borderColor: color,
			backgroundColor: isLine ? color + '22' : color,
			fill: true,
			tension: 0.4,
			pointRadius: 0,
			borderWidth: isLine ? 2 : 0,
			stack: 'consumptionStack'
		};
	}).filter(ds => activeMediaTypes.includes(ds.label));

	consumptionGrowthChartInstance = new Chart(ctx, {
		type: chartType,
		data: {
			labels: sortedDates,
			datasets: datasets
		},
		options: {
			...COMMON_CHART_OPTIONS,
			scales: {
				x: {
					grid: { display: false },
					ticks: {
						color: isDark ? '#71717a' : '#a1a1aa',
						font: { size: 10 },
						maxRotation: 45,
						autoSkip: true,
						maxTicksLimit: 10
					}
				},
				y: {
					beginAtZero: true,
					stacked: true,
					grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
					ticks: {
						color: isDark ? '#71717a' : '#a1a1aa',
						font: { size: 10 },
						callback: v => formatMinutes(v)
					}
				}
			},
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				legend: { display: false },
				datalabels: { display: false }
			}
		}
	});
}

function renderConsumptionSpreadChart(stats) {
	const ctx = document.getElementById('consumptionSpreadChart');
	if (!ctx) return;

	const chartType = (state.statsChartTypes && state.statsChartTypes.consumptionSpreadChart) || 'doughnut';
	const existingChart = Chart.getChart(ctx);
	if (existingChart) existingChart.destroy();

	const useStrict = state.statsStrictTrackingSpread;
	const consumedData = useStrict ? stats.consumedByTypeStrict : stats.consumedByType;

	const labels = Object.keys(consumedData).sort();
	const data = labels.map(l => consumedData[l]);
	const isDark = document.documentElement.classList.contains('dark');
	const colors = labels.map(l => {
		const base = TYPE_COLOR_MAP[l] || 'text-zinc-400';
		// Heuristic to get color from classes
		if (base.includes('violet')) return isDark ? '#8b5cf6' : '#7c3aed';
		if (base.includes('pink')) return isDark ? '#ec4899' : '#db2777';
		if (base.includes('blue')) return isDark ? '#3b82f6' : '#2563eb';
		if (base.includes('red')) return isDark ? '#ef4444' : '#dc2626';
		if (base.includes('amber')) return isDark ? '#f59e0b' : '#d97706';
		return '#71717a';
	});

	consumptionSpreadChartInstance = new Chart(ctx, {
		type: chartType,
		data: {
			labels: labels,
			datasets: [{
				data: data,
				backgroundColor: colors,
				borderWidth: 0
			}]
		},
		options: {
			...COMMON_CHART_OPTIONS,
			cutout: chartType === 'doughnut' ? '70%' : 0,
			scales: getScales(chartType),
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				legend: { display: false },
				datalabels: {
					...COMMON_CHART_OPTIONS.plugins.datalabels,
					display: (ctx) => ['doughnut', 'pie', 'polarArea'].includes(chartType),
					formatter: (value, ctx) => {
						let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
						if (sum === 0) return '0%';
						return (value * 100 / sum).toFixed(0) + "%";
					}
				},
				tooltip: {
					enabled: false,
					external: externalTooltipHandler,
					callbacks: {
						label: (ctx) => `${ctx.label}: ${formatMinutes(ctx.parsed)}`
					}
				}
			}
		}
	});

	if (window.lucide) window.lucide.createIcons();
	renderCustomHTMLLegend('consumptionSpreadLegend', labels, colors, labels.map(l => ICON_MAP[l]), labels.map(l => formatMinutes(consumedData[l])), false);
}

// ============================================================================
// UI INTERACTIONS
// ============================================================================

window.toggleStrictTracking = (type) => {
	if (type === 'Momentum') {
		setState('statsStrictTrackingMomentum', !state.statsStrictTrackingMomentum);
	} else if (type === 'Spread') {
		setState('statsStrictTrackingSpread', !state.statsStrictTrackingSpread);
	}
	updateCharts();
};

function updateStrictTrackingUI() {
	// Momentum Toggle
	const mSw = document.getElementById('momentumStrictSwitch');
	const mKnob = document.getElementById('momentumStrictKnob');
	if (mSw && mKnob) {
		if (state.statsStrictTrackingMomentum) {
			mSw.classList.remove('bg-zinc-200', 'dark:bg-zinc-800');
			mSw.classList.add('bg-indigo-500');
			mKnob.classList.add('translate-x-4');
		} else {
			mSw.classList.add('bg-zinc-200', 'dark:bg-zinc-800');
			mSw.classList.remove('bg-indigo-500');
			mKnob.classList.remove('translate-x-4');
		}
	}

	// Spread Toggle
	const sSw = document.getElementById('spreadStrictSwitch');
	const sKnob = document.getElementById('spreadStrictKnob');
	if (sSw && sKnob) {
		if (state.statsStrictTrackingSpread) {
			sSw.classList.remove('bg-zinc-200', 'dark:bg-zinc-800');
			sSw.classList.add('bg-indigo-500');
			sKnob.classList.add('translate-x-4');
		} else {
			sSw.classList.add('bg-zinc-200', 'dark:bg-zinc-800');
			sSw.classList.remove('bg-indigo-500');
			sKnob.classList.remove('translate-x-4');
		}
	}
}
