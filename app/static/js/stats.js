/**
 * @fileoverview Statistics dashboard logic.
 * Handles calculation and rendering of library statistics using Chart.js.
 * @module stats
 */

import { state } from './state.js';
import { TYPE_COLOR_MAP, STATUS_COLOR_MAP, MEDIA_TYPES, ICON_MAP, STATUS_ICON_MAP, STAR_FILLS } from './constants.js';

let typeChartInstance = null;
let statusChartInstance = null;
let growthChartInstance = null;
let ratingChartInstance = null;
let activeMediaTypes = [...MEDIA_TYPES]; // Global filter, default all active
let chartTypes = {
	typeChart: 'doughnut',
	statusChart: 'doughnut',
	ratingChart: 'doughnut',
	growthChart: 'line'
};

// Reusable chart options for consistency
const COMMON_CHART_OPTIONS = {
	responsive: true,
	maintainAspectRatio: false,
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
			backgroundColor: 'rgba(24, 24, 27, 0.9)',
			titleFont: { family: "'Outfit', sans-serif", size: 13 },
			bodyFont: { family: "'Inter', sans-serif", size: 12 },
			padding: 12,
			cornerRadius: 8,
			displayColors: true,
			boxPadding: 4
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
 * Calculates statistics from the current state items.
 */
function calculateStats() {
	const typeCounts = {};
	const statusCounts = {};
	const ratingCounts = { 'Bad': 0, 'Ok': 0, 'Good': 0, 'Masterpiece': 0 };

	// Apply Global Filter First
	// Apply Global Filter
	const filteredItems = state.items.filter(item => activeMediaTypes.includes(item.type));

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
	});

	const avgRating = ratedCount > 0 ? (totalRatings / ratedCount).toFixed(1) : '0.0';

	// For metrics, we need to pass a fallback for planned items if it doesn't exist in filtered set
	// But it will exist in statusCounts if any items have that status
	return { typeCounts, statusCounts, ratingCounts, totalItems, completedItems, avgRating, filteredItems };
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
	updateCharts();
}
window.openStatsModal = openStatsModal;

window.setChartType = (chartName, type) => {
	if (chartTypes[chartName]) {
		chartTypes[chartName] = type;
		updateCharts();
	}
};

function updateCharts() {
	const stats = calculateStats();
	renderMetrics(stats);
	renderCharts(stats);
	renderGrowthChart(stats);
	renderRatingChart(stats);
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

window.toggleGlobalFilter = (type) => {
	const idx = activeMediaTypes.indexOf(type);
	if (idx === -1) {
		activeMediaTypes.push(type);
	} else {
		// Prevent deselecting all? Optional. Let's allow it for now.
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
			else if (containerId === 'ratingChartContainer') instance = ratingChartInstance;

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

	const metrics = [
		{ label: 'Total Items', value: stats.totalItems, icon: 'layers', color: 'text-indigo-500' },
		{ label: 'Completed + Anticipating', value: completedPlusAnticipating, icon: 'check-circle', color: 'text-emerald-500' },
		{ label: 'Avg Rating', value: stats.avgRating, icon: 'star', color: 'text-amber-500' },
		{ label: 'Planned', value: stats.statusCounts['Planning'] || 0, icon: 'calendar', color: 'text-blue-500' }
	];

	container.innerHTML = metrics.map(m => `
        <div class="bg-white dark:bg-[#18181b] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
            <div>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider">${m.label}</p>
                <p class="text-2xl font-black text-zinc-800 dark:text-white mt-1">${m.value}</p>
            </div>
            <div class="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center ${m.color}">
                <i data-lucide="${m.icon}" class="w-5 h-5"></i>
            </div>
        </div>
    `).join('');

	if (window.lucide) window.lucide.createIcons();
}

// Helper to determine scale config
const getScales = (chartType) => {
	if (chartType === 'bar' || chartType === 'line') {
		const isDark = document.documentElement.classList.contains('dark');
		return {
			y: {
				beginAtZero: true,
				grid: { display: false },
				ticks: { display: true, color: isDark ? '#a1a1aa' : '#71717a', font: { size: 10 } }
			},
			x: {
				grid: { display: false },
				ticks: { color: isDark ? '#a1a1aa' : '#71717a', font: { size: 10 } }
			}
		};
	} else if (chartType === 'polarArea') {
		return {
			r: {
				grid: { display: false },
				ticks: { display: false, backdropPadding: 0, backdropColor: 'transparent' }
			}
		};
	}
	return { x: { display: false }, y: { display: false } };
};

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
 * Renders or updates the Chart.js instances.
 */
function renderCharts(stats) {
	const typeCtx = document.getElementById('typeChart');
	const statusCtx = document.getElementById('statusChart');

	if (!typeCtx || !statusCtx) return;

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
		type: chartTypes.typeChart,
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
			cutout: chartTypes.typeChart === 'doughnut' ? '60%' : 0,
			scales: getScales(chartTypes.typeChart),
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				legend: { display: false }
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
		type: chartTypes.statusChart,
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
			cutout: chartTypes.statusChart === 'doughnut' ? '60%' : 0,
			scales: getScales(chartTypes.statusChart),
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				title: { display: false },
				legend: { display: false } // Using HTML legend
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

	// Use filtered items for growth chart too!
	const sortedItems = [...stats.filteredItems] // Using the filtered list from calculateStats
		.filter(i => i.createdAt)
		.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

	if (sortedItems.length === 0) {
		// Render empty chart or clear it
		if (growthChartInstance) growthChartInstance.destroy();
		return;
	}

	const dateMap = new Map();
	sortedItems.forEach(item => {
		try {
			const date = new Date(item.createdAt).toISOString().split('T')[0];
			dateMap.set(date, (dateMap.get(date) || 0) + 1);
		} catch (e) { }
	});

	const uniqueDates = Array.from(dateMap.keys()).sort();
	let cumulative = 0;
	const labels = [];
	const data = [];

	uniqueDates.forEach(date => {
		cumulative += dateMap.get(date);
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
		type: chartTypes.growthChart,
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
				legend: { display: false },
				tooltip: COMMON_CHART_OPTIONS.plugins.tooltip,
				datalabels: { display: false }
			}
		}
	});
}

function renderRatingChart(stats) {
	const ctx = document.getElementById('ratingChart');
	if (!ctx) return;

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
		type: chartTypes.ratingChart,
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
			cutout: chartTypes.ratingChart === 'doughnut' ? '60%' : 0,
			scales: getScales(chartTypes.ratingChart),
			plugins: {
				...COMMON_CHART_OPTIONS.plugins,
				legend: { display: false }, // Using HTML legend
				tooltip: COMMON_CHART_OPTIONS.plugins.tooltip,
				datalabels: {
					...COMMON_CHART_OPTIONS.plugins.datalabels,
					display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0
				}
			}
		}
	});

	// Apply persistent hidden state
	applyHiddenState(ratingChartInstance, 'rating');

	// Pass 'rating' as the chartName argument
	renderCustomHTMLLegend('ratingLegend', rawLabels, ratingColors, [], data, true, 'rating');
}
