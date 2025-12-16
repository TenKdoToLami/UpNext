/**
 * @fileoverview Export utilities for the UpNext application.
 * Handles export modal operations, format selection, field filtering, and export triggering.
 * @module export_utils
 */

import { state } from './state.js';
import {
	ALL_EXPORT_FIELDS,
	EXPORT_CONFIG,
	MEDIA_TYPES,
	STATUS_TYPES,
	RATING_LABELS,
	TEXT_COLORS,
	ICON_MAP,
	STATUS_ICON_MAP
} from './constants.js';

// ============================================================================
// STATE
// ============================================================================

/** @type {ExportState} Current export modal state */
let exportState = {
	category: null,
	filterTypes: [],
	filterStatuses: [],
	filterRatings: [],
	fieldStates: {}
};

// ============================================================================
// MODAL OPERATIONS
// ============================================================================

/**
 * Opens the export modal and resets it to initial state.
 * Closes any other open modals first.
 * @export
 */
export function openExportModal() {
	try {
		if (typeof window.closeModal === 'function') window.closeModal();
		if (typeof window.closeInfoModal === 'function') window.closeInfoModal();
	} catch (e) { /* Ignore errors from closing other modals */ }

	const modal = document.getElementById('exportModal');
	if (!modal) {
		alert('Error: Export modal not found. Please refresh the page.');
		return;
	}

	const content = document.getElementById('exportContent');
	resetExportModal();
	modal.classList.remove('hidden');

	setTimeout(() => {
		modal.classList.remove('opacity-0');
		if (content) content.classList.remove('scale-95');
	}, 10);

	refreshIcons();
}

/**
 * Closes the export modal with fade animation.
 * @export
 */
export function closeExportModal() {
	const modal = document.getElementById('exportModal');
	if (!modal) return;

	const content = document.getElementById('exportContent');
	modal.classList.add('opacity-0');
	if (content) content.classList.add('scale-95');

	setTimeout(() => modal.classList.add('hidden'), 200);
}

/**
 * Resets the export modal to its initial state.
 * @private
 */
function resetExportModal() {
	exportState = {
		category: null,
		filterTypes: [],
		filterStatuses: [],
		filterRatings: [],
		fieldStates: {}
	};

	const step1 = document.getElementById('exportStep1');
	const step2 = document.getElementById('exportStep2');
	const footer = document.getElementById('exportFooter');

	if (step1) step1.classList.remove('hidden');
	if (step2) step2.classList.add('hidden');
	if (footer) footer.classList.add('hidden');

	document.querySelectorAll('.export-category-tile').forEach(tile => {
		tile.classList.remove(
			'border-indigo-500', 'border-emerald-500', 'border-amber-500',
			'bg-indigo-500/10', 'bg-emerald-500/10', 'bg-amber-500/10'
		);
		tile.classList.add('border-zinc-800');
	});
}

// ============================================================================
// CATEGORY & FORMAT SELECTION
// ============================================================================

/**
 * Selects an export category and displays the appropriate options.
 * @param {'visual'|'raw'|'full'} category - The export category to select
 * @export
 */
export function selectExportCategory(category) {
	exportState.category = category;

	const elements = {
		step1: document.getElementById('exportStep1'),
		step2: document.getElementById('exportStep2'),
		footer: document.getElementById('exportFooter'),
		visual: document.getElementById('visualExportOptions'),
		raw: document.getElementById('rawExportOptions'),
		full: document.getElementById('fullExportOptions'),
		filters: document.getElementById('exportFilters')
	};

	if (elements.step1) elements.step1.classList.add('hidden');
	if (elements.step2) elements.step2.classList.remove('hidden');
	if (elements.footer) elements.footer.classList.remove('hidden');

	// Hide all option panels
	['visual', 'raw', 'full'].forEach(key => {
		if (elements[key]) elements[key].classList.add('hidden');
	});

	// Show selected category panel
	if (elements[category]) elements[category].classList.remove('hidden');

	// Show/hide filters based on category
	if (elements.filters) {
		elements.filters.classList.toggle('hidden', category === 'full');
	}

	// Initialize filters and fields for visual/raw exports
	if (category !== 'full') {
		renderExportFilters();
		updateExportOptions();
	}

	refreshIcons();
}

/**
 * Returns to the category selection step.
 * @export
 */
export function backToExportCategories() {
	resetExportModal();
	refreshIcons();
}

/**
 * Gets the currently selected export format based on category.
 * @returns {string} The selected format identifier
 * @private
 */
function getCurrentFormat() {
	const selector = exportState.category === 'visual'
		? 'input[name="visualFormat"]:checked'
		: 'input[name="rawFormat"]:checked';
	const input = document.querySelector(selector);
	return input?.value || (exportState.category === 'visual' ? 'html_accordion' : 'json_raw');
}

/**
 * Updates export options when format changes.
 * @export
 */
export function updateExportOptions() {
	const format = getCurrentFormat();
	const config = EXPORT_CONFIG[format];
	if (!config) return;

	renderFieldCheckboxes(format, config);
	refreshIcons();
}

// ============================================================================
// FIELD RENDERING
// ============================================================================

/**
 * Renders field selection checkboxes for the current export format.
 * @param {string} format - The export format identifier
 * @param {Object} config - The format configuration
 * @private
 */
function renderFieldCheckboxes(format, config) {
	const containerId = exportState.category === 'visual' ? 'visualFieldsContainer' : 'rawFieldsContainer';
	const container = document.getElementById(containerId);
	if (!container) return;

	const fieldsHtml = ALL_EXPORT_FIELDS
		.filter(field => field.id !== 'isHidden') // Hidden handled separately
		.filter(field => !config.excluded?.includes(field.id))
		.map(field => createFieldCheckbox(field, config))
		.join('');

	const hiddenOptionsHtml = state.isHidden ? createHiddenOptionsSection() : '';
	container.innerHTML = fieldsHtml + hiddenOptionsHtml;
}

/**
 * Creates HTML for a single field checkbox.
 * @param {Object} field - Field configuration
 * @param {Object} config - Export format configuration
 * @returns {string} HTML string for the checkbox
 * @private
 */
function createFieldCheckbox(field, config) {
	const isMandatory = config.mandatory?.includes(field.id);
	const isChecked = isMandatory || (exportState.fieldStates[field.id] ?? true);
	const colorClass = field.color || 'text-zinc-300';
	const cursorClass = isMandatory ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-zinc-800';
	const onclick = isMandatory ? '' : `toggleVisualField('${field.id}')`;

	return `
        <div class="flex items-center justify-between bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-700/50 transition-colors ${cursorClass}"
            onclick="${onclick}">
            <span class="text-xs font-medium ${colorClass}">
                ${field.label}${isMandatory ? ' <span class="text-zinc-500 text-[9px]">(Required)</span>' : ''}
            </span>
            <div class="w-4 h-4 rounded border border-zinc-600 flex items-center justify-center transition-colors ${isChecked ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent'}">
                ${isChecked ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
            </div>
        </div>
    `;
}

/**
 * Creates the hidden items options section (only shown when hidden mode is active).
 * @returns {string} HTML string for hidden options
 * @private
 */
function createHiddenOptionsSection() {
	const includeHidden = exportState.fieldStates['includeHidden'] ?? true;
	const showHiddenTag = exportState.fieldStates['isHidden'] ?? true;

	return `
        <div class="col-span-3 mt-3 pt-3 border-t border-red-500/20">
            <div class="flex items-center gap-2 mb-2">
                <i data-lucide="shield-alert" class="w-4 h-4 text-red-400"></i>
                <span class="text-xs font-bold text-red-400 uppercase tracking-wider">Hidden Items Options</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
                ${createHiddenOptionCheckbox('includeHidden', 'Include Hidden Items', includeHidden)}
                ${createHiddenOptionCheckbox('isHidden', 'Show Hidden Tag', showHiddenTag)}
            </div>
        </div>
    `;
}

/**
 * Creates a hidden option checkbox HTML.
 * @param {string} id - Field identifier
 * @param {string} label - Display label
 * @param {boolean} isChecked - Whether the checkbox is checked
 * @returns {string} HTML string
 * @private
 */
function createHiddenOptionCheckbox(id, label, isChecked) {
	return `
        <div class="flex items-center justify-between bg-red-500/10 p-2.5 rounded-lg border border-red-500/30 transition-colors cursor-pointer hover:bg-red-500/20"
            onclick="toggleVisualField('${id}')">
            <span class="text-xs font-medium text-red-300">${label}</span>
            <div class="w-4 h-4 rounded border border-red-500/50 flex items-center justify-center transition-colors ${isChecked ? 'bg-red-500 border-red-500' : 'bg-transparent'}">
                ${isChecked ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
            </div>
        </div>
    `;
}

/**
 * Toggles a field's selection state.
 * @param {string} id - Field identifier to toggle
 * @export
 */
export function toggleVisualField(id) {
	const format = getCurrentFormat();
	const config = EXPORT_CONFIG[format];

	if (!config || config.mandatory?.includes(id)) return;

	const field = ALL_EXPORT_FIELDS.find(f => f.id === id);
	if (!field && id !== 'includeHidden') return;

	const currentState = exportState.fieldStates[id] ?? true;
	exportState.fieldStates[id] = !currentState;
	updateExportOptions();
}

// ============================================================================
// FILTER RENDERING
// ============================================================================

/** Color configurations for filter tiles */
const FILTER_COLORS = {
	type: {
		'Anime': { text: 'text-violet-400', border: 'border-violet-500/50', bg: 'bg-violet-500/10', activeBorder: 'border-violet-400', activeBg: 'bg-violet-500/25' },
		'Manga': { text: 'text-pink-400', border: 'border-pink-500/50', bg: 'bg-pink-500/10', activeBorder: 'border-pink-400', activeBg: 'bg-pink-500/25' },
		'Book': { text: 'text-blue-400', border: 'border-blue-500/50', bg: 'bg-blue-500/10', activeBorder: 'border-blue-400', activeBg: 'bg-blue-500/25' },
		'Movie': { text: 'text-red-400', border: 'border-red-500/50', bg: 'bg-red-500/10', activeBorder: 'border-red-400', activeBg: 'bg-red-500/25' },
		'Series': { text: 'text-amber-400', border: 'border-amber-500/50', bg: 'bg-amber-500/10', activeBorder: 'border-amber-400', activeBg: 'bg-amber-500/25' }
	},
	status: {
		'Planning': { text: 'text-zinc-400', border: 'border-zinc-500/50', bg: 'bg-zinc-500/10', activeBorder: 'border-zinc-400', activeBg: 'bg-zinc-500/25' },
		'Reading/Watching': { text: 'text-sky-400', border: 'border-sky-500/50', bg: 'bg-sky-500/10', activeBorder: 'border-sky-400', activeBg: 'bg-sky-500/25' },
		'Dropped': { text: 'text-red-400', border: 'border-red-500/50', bg: 'bg-red-500/10', activeBorder: 'border-red-400', activeBg: 'bg-red-500/25' },
		'On Hold': { text: 'text-amber-400', border: 'border-amber-500/50', bg: 'bg-amber-500/10', activeBorder: 'border-amber-400', activeBg: 'bg-amber-500/25' },
		'Anticipating': { text: 'text-purple-400', border: 'border-purple-500/50', bg: 'bg-purple-500/10', activeBorder: 'border-purple-400', activeBg: 'bg-purple-500/25' },
		'Completed': { text: 'text-emerald-400', border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', activeBorder: 'border-emerald-400', activeBg: 'bg-emerald-500/25' }
	},
	rating: {
		1: { text: 'text-red-400', border: 'border-red-500/50', bg: 'bg-red-500/10', activeBorder: 'border-red-400', activeBg: 'bg-red-500/25' },
		2: { text: 'text-amber-400', border: 'border-amber-500/50', bg: 'bg-amber-500/10', activeBorder: 'border-amber-400', activeBg: 'bg-amber-500/25' },
		3: { text: 'text-blue-400', border: 'border-blue-500/50', bg: 'bg-blue-500/10', activeBorder: 'border-blue-400', activeBg: 'bg-blue-500/25' },
		4: { text: 'text-emerald-400', border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', activeBorder: 'border-emerald-400', activeBg: 'bg-emerald-500/25' }
	}
};

/** Statuses that should show the rating filter */
const RATING_RELEVANT_STATUSES = ['Dropped', 'On Hold', 'Anticipating', 'Completed'];

/**
 * Renders all filter sections (type, status, rating).
 * @private
 */
function renderExportFilters() {
	renderTypeFilters();
	renderStatusFilters();
	renderRatingFilters();
	refreshIcons();
}

/**
 * Renders media type filter buttons.
 * @private
 */
function renderTypeFilters() {
	const container = document.getElementById('exportTypeFilters');
	if (!container) return;

	const allSelected = exportState.filterTypes.length === 0;
	let html = createFilterTile('All', 'grid-2x2', allSelected, 'toggleExportTypeFilter', "'All'");

	MEDIA_TYPES.forEach(type => {
		const isActive = exportState.filterTypes.includes(type);
		const colors = FILTER_COLORS.type[type];
		const icon = ICON_MAP[type] || 'circle';
		html += createColoredFilterTile(type, icon, isActive, colors, 'toggleExportTypeFilter', `'${type}'`);
	});

	container.innerHTML = html;
}

/**
 * Renders status filter buttons.
 * @private
 */
function renderStatusFilters() {
	const container = document.getElementById('exportStatusFilters');
	if (!container) return;

	const allSelected = exportState.filterStatuses.length === 0;
	let html = createFilterTile('Any', 'layers', allSelected, 'toggleExportStatusFilter', "'All'");

	STATUS_TYPES.forEach(status => {
		const isActive = exportState.filterStatuses.includes(status);
		const colors = FILTER_COLORS.status[status];
		const icon = STATUS_ICON_MAP[status] || 'circle';
		html += createColoredFilterTile(status, icon, isActive, colors, 'toggleExportStatusFilter', `'${status}'`);
	});

	container.innerHTML = html;
}

/**
 * Renders rating filter buttons (conditionally visible).
 * @private
 */
function renderRatingFilters() {
	const container = document.getElementById('exportRatingFilters');
	const section = document.getElementById('exportRatingSection');
	if (!container || !section) return;

	const showRating = exportState.filterStatuses.length === 0 ||
		exportState.filterStatuses.some(s => RATING_RELEVANT_STATUSES.includes(s));

	if (!showRating) {
		section.classList.add('hidden');
		exportState.filterRatings = [];
		return;
	}

	section.classList.remove('hidden');
	const allSelected = exportState.filterRatings.length === 0;
	let html = createFilterTile('Any', 'star', allSelected, 'toggleExportRatingFilter', "'All'");

	[1, 2, 3, 4].forEach(rating => {
		const isActive = exportState.filterRatings.includes(rating);
		const colors = FILTER_COLORS.rating[rating];
		const stars = '⭐'.repeat(rating);
		html += createRatingFilterTile(rating, stars, isActive, colors);
	});

	container.innerHTML = html;
}

/**
 * Creates a standard filter tile (for "All/Any" options).
 * @private
 */
function createFilterTile(label, icon, isActive, handler, value) {
	const activeClass = isActive
		? 'bg-white text-black border-white shadow-lg shadow-white/20 scale-105'
		: 'bg-zinc-900/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-500';
	const iconSize = isActive ? 'w-6 h-6' : 'w-5 h-5';

	return `
        <button type="button" onclick="${handler}(${value})"
            class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-bold transition-all border-2 ${activeClass}">
            <i data-lucide="${icon}" class="${iconSize}"></i>
            <span>${label}</span>
        </button>
    `;
}

/**
 * Creates a colored filter tile for types/statuses.
 * @private
 */
function createColoredFilterTile(label, icon, isActive, colors, handler, value) {
	const border = isActive ? colors.activeBorder : colors.border;
	const bg = isActive ? colors.activeBg : colors.bg;
	const scale = isActive ? 'scale-105 shadow-md' : '';
	const iconSize = isActive ? 'w-6 h-6' : 'w-5 h-5';

	return `
        <button type="button" onclick="${handler}(${value})"
            class="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-bold transition-all border-2 ${border} ${bg} ${colors.text} ${scale}">
            <i data-lucide="${icon}" class="${iconSize}"></i>
            <span>${label}</span>
        </button>
    `;
}

/**
 * Creates a rating filter tile with star display.
 * @private
 */
function createRatingFilterTile(rating, stars, isActive, colors) {
	const border = isActive ? colors.activeBorder : colors.border;
	const bg = isActive ? colors.activeBg : colors.bg;
	const scale = isActive ? 'scale-105 shadow-md' : '';

	return `
        <button type="button" onclick="toggleExportRatingFilter(${rating})"
            class="flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-xs font-bold transition-all border-2 ${border} ${bg} ${colors.text} ${scale}">
            <span class="text-sm">${stars}</span>
            <span>${RATING_LABELS[rating]}</span>
        </button>
    `;
}

// ============================================================================
// FILTER TOGGLE HANDLERS
// ============================================================================

/**
 * Toggles a media type filter.
 * @param {string} type - Type to toggle ('All' resets selection)
 * @export
 */
export function toggleExportTypeFilter(type) {
	if (type === 'All') {
		exportState.filterTypes = [];
	} else {
		const idx = exportState.filterTypes.indexOf(type);
		if (idx === -1) {
			exportState.filterTypes.push(type);
		} else {
			exportState.filterTypes.splice(idx, 1);
		}
		// Reset to "Any" if all types selected
		if (exportState.filterTypes.length === MEDIA_TYPES.length) {
			exportState.filterTypes = [];
		}
	}
	renderExportFilters();
}

/**
 * Toggles a status filter.
 * @param {string} status - Status to toggle ('All' resets selection)
 * @export
 */
export function toggleExportStatusFilter(status) {
	if (status === 'All') {
		exportState.filterStatuses = [];
	} else {
		const idx = exportState.filterStatuses.indexOf(status);
		if (idx === -1) {
			exportState.filterStatuses.push(status);
		} else {
			exportState.filterStatuses.splice(idx, 1);
		}
		if (exportState.filterStatuses.length === STATUS_TYPES.length) {
			exportState.filterStatuses = [];
		}
	}
	renderExportFilters();
}

/**
 * Toggles a rating filter.
 * @param {string|number} rating - Rating to toggle ('All' resets selection)
 * @export
 */
export function toggleExportRatingFilter(rating) {
	if (rating === 'All') {
		exportState.filterRatings = [];
	} else {
		const ratingNum = parseInt(rating);
		const idx = exportState.filterRatings.indexOf(ratingNum);
		if (idx === -1) {
			exportState.filterRatings.push(ratingNum);
		} else {
			exportState.filterRatings.splice(idx, 1);
		}
		if (exportState.filterRatings.length === Object.keys(RATING_LABELS).length) {
			exportState.filterRatings = [];
		}
	}
	renderExportFilters();
}

// ============================================================================
// EXPORT TRIGGER
// ============================================================================

/**
 * Triggers the export download based on current settings.
 * @export
 */
export function triggerExport() {
	// Full export has a dedicated endpoint
	if (exportState.category === 'full') {
		window.location.href = '/api/export/full';
		closeExportModal();
		return;
	}

	const format = getCurrentFormat();

	// DB export doesn't need config/fields
	if (format === 'db') {
		window.location.href = '/api/export?format=db';
		closeExportModal();
		return;
	}

	const config = EXPORT_CONFIG[format];
	if (!config) return;

	// Collect selected fields
	const selectedFields = ALL_EXPORT_FIELDS
		.filter(f => {
			if (config.excluded?.includes(f.id)) return false;
			if (config.mandatory?.includes(f.id)) return true;
			return exportState.fieldStates[f.id] ?? true;
		})
		.map(f => f.backendField);

	// Build export parameters
	const params = new URLSearchParams({
		format,
		fields: selectedFields.join(','),
		filterTypes: exportState.filterTypes.join(','),
		filterStatuses: exportState.filterStatuses.join(','),
		filterRatings: exportState.filterRatings.join(','),
		excludeHidden: (!state.isHidden || !(exportState.fieldStates['includeHidden'] ?? true)).toString(),
		includeCovers: (exportState.fieldStates['coverUrl'] ?? true).toString()
	});

	window.location.href = `/api/export?${params.toString()}`;
	closeExportModal();
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Refreshes Lucide icons in the DOM.
 * @private
 */
function refreshIcons() {
	if (window.lucide?.createIcons) {
		window.lucide.createIcons();
	}
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/** @deprecated Use updateExportOptions instead */
export function renderExportFields() {
	updateExportOptions();
}

/** @deprecated Use toggleVisualField instead */
export function toggleExportField(id) {
	toggleVisualField(id);
}
