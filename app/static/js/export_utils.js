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
	fieldStates: {},
	fieldOrder: []
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
		if (typeof window.closeStatsModal === 'function') window.closeStatsModal();
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
		fieldStates: {},
		fieldOrder: []
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
		clipboard: document.getElementById('clipboardExportOptions'),
		filters: document.getElementById('exportFilters')
	};

	if (elements.step1) elements.step1.classList.add('hidden');
	if (elements.step2) elements.step2.classList.remove('hidden');
	if (elements.footer) elements.footer.classList.remove('hidden');

	// Hide all option panels
	['visual', 'raw', 'full', 'clipboard'].forEach(key => {
		if (elements[key]) elements[key].classList.add('hidden');
	});

	// Show selected category panel
	if (elements[category]) elements[category].classList.remove('hidden');

	// Show/hide filters based on category
	if (elements.filters) {
		elements.filters.classList.toggle('hidden', category === 'full');
	}

	// For clipboard, ensure we hide the main download footer
	if (category === 'clipboard' && elements.footer) {
		elements.footer.classList.add('hidden');
	}

	// Initialize filters and fields for visual/raw/clipboard exports
	if (category !== 'full') {
		renderExportFilters();
		updateExportOptions();

		// Auto-generate clipboard text if that's the category selected
		if (category === 'clipboard' && typeof generateClipboardText === 'function') {
			generateClipboardText();
		}
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
	if (exportState.category === 'clipboard') return 'clipboard';

	const selector = exportState.category === 'visual'
		? 'input[name="visualFormat"]:checked'
		: 'input[name="rawFormat"]:checked';
	const input = document.querySelector(selector);
	// Changed to use json_raw as default for non-visual if no selection exists
	return input?.value || (exportState.category === 'visual' ? 'html_accordion' : (exportState.category === 'raw' ? 'json_raw' : null));
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
	// Handle clipboard blocks specifically
	if (format === 'clipboard') {
		renderClipboardBlocks();
	}
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
	let containerId = '';
	if (exportState.category === 'visual') containerId = 'visualFieldsContainer';
	if (exportState.category === 'raw') containerId = 'rawFieldsContainer';
	if (exportState.category === 'clipboard') containerId = 'clipboardFieldsContainer';

	const container = document.getElementById(containerId);
	if (!container) return;

	// Reset container classes
	container.className = format === 'db' ? '' : 'grid grid-cols-3 gap-2';

	if (format === 'db') {
		container.innerHTML = `
			<div class="flex flex-col h-full bg-zinc-900 rounded-xl border border-zinc-700/50 overflow-hidden">
                <div class="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
                    <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-bold">Database & Schema</span>
                    <span id="schemaTableCount" class="text-[10px] text-zinc-500 font-mono"></span>
                </div>
                
                <div id="dbSchemaOutput" class="flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-1 md:grid-cols-2 gap-4 content-start bg-zinc-950/30">
                    <!-- Info Card (First Element) -->
                    <div class="bg-zinc-800/20 border-2 border-dashed border-zinc-800 rounded-lg p-5 flex flex-col justify-center items-center text-center">
                        <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                            <i data-lucide="database" class="w-5 h-5 text-zinc-300"></i>
                        </div>
                        <h3 class="text-sm font-bold text-zinc-200 mb-1">Full Database Backup</h3>
                        <p class="text-xs text-zinc-500 leading-relaxed mb-3">
                            Includes complete structure and data (library.db).
                        </p>
                         <p class="text-[10px] text-amber-500/80 bg-amber-500/10 px-2 py-1.5 rounded border border-amber-500/20">
                            Schema adjustments must be done manually.
                        </p>
                    </div>

                    <div class="col-span-full md:col-span-1 text-center py-12 flex flex-col items-center justify-center h-full">
                        <i data-lucide="loader-2" class="w-6 h-6 text-indigo-500 animate-spin mb-2"></i>
                        <span class="text-xs text-zinc-500">Loading tables...</span>
                    </div>
                </div>
			</div>
		`;
		if (window.lucide?.createIcons) window.lucide.createIcons();

		// Fetch and display schema
		fetch('api/database/schema')
			.then(res => res.json())
			.then(data => {
				const el = document.getElementById('dbSchemaOutput');
				const countEl = document.getElementById('schemaTableCount');
				if (!el) return;

				// Remove loading indicator but keep the first info card
				// The loading indicator is the second child (index 1)
				if (el.children.length > 1) {
					el.removeChild(el.lastElementChild);
				}

				if (data.status === 'success' && data.schema) {
					countEl.textContent = `${data.schema.length} TABLES`;

					data.schema.forEach(sql => {
						// Extract table name
						const tableNameMatch = sql.match(/CREATE\s+TABLE\s+["`]?(\w+)["`]?/i);
						const tableName = tableNameMatch ? tableNameMatch[1] : 'Unknown Table';
						const cleanSql = sql.trim();

						const card = document.createElement('div');
						card.className = 'w-full flex flex-col h-64 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden transition-all hover:border-zinc-700';
						card.innerHTML = `
                            <div class="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2 shrink-0">
                                <i data-lucide="table-2" class="w-3.5 h-3.5 text-indigo-400"></i>
                                <span class="text-xs font-bold text-zinc-300 font-mono truncate" title="${tableName}">${tableName}</span>
                            </div>
                            <pre class="flex-1 p-3 text-[10px] font-mono text-emerald-400/90 overflow-x-auto custom-scrollbar leading-relaxed whitespace-pre">${cleanSql}</pre>
                        `;
						el.appendChild(card);
					});

					if (window.lucide?.createIcons) window.lucide.createIcons();
				} else {
					const errDiv = document.createElement('div');
					errDiv.className = 'col-span-full text-center py-8 text-red-400 text-sm';
					errDiv.textContent = 'Failed to load schema: ' + (data.message || 'Unknown error');
					el.appendChild(errDiv);
				}
			})
			.catch(err => {
				const el = document.getElementById('dbSchemaOutput');
				if (el && el.children.length > 1) el.removeChild(el.lastElementChild);
				if (el) {
					const errDiv = document.createElement('div');
					errDiv.className = 'col-span-full text-center py-8 text-red-400 text-sm';
					errDiv.textContent = 'Error loading schema: ' + err.message;
					el.appendChild(errDiv);
				}
			});

		return;
	}

	const fieldsHtml = ALL_EXPORT_FIELDS
		.filter(field => field.id !== 'isHidden') // Hidden handled separately
		.filter(field => !config.excluded?.includes(field.id))
		.map(field => createFieldCheckbox(field, config))
		.join('');

	// Hidden tags options are relevant for clipboard too if we are in hidden mode
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
	const isDefaultOn = config.defaultOn?.includes(field.id) ?? true;
	const isChecked = isMandatory || (exportState.fieldStates[field.id] ?? isDefaultOn);
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

	const isDefaultOn = config.defaultOn?.includes(id) ?? true;
	const currentState = exportState.fieldStates[id] !== undefined ? exportState.fieldStates[id] : isDefaultOn;

	exportState.fieldStates[id] = !currentState;
	updateExportOptions();

	if (exportState.category === 'clipboard') {
		syncClipboardOrder(id);
		if (typeof generateClipboardText === 'function') {
			generateClipboardText();
		}
	}
}

// ============================================================================
// CLIPBOARD BLOCKS
// ============================================================================

/**
 * Syncs the field order array with selection changes.
 * @param {string} id - Toggled field ID
 */
function syncClipboardOrder(id) {
	// Only sync actual fields that have building blocks
	const field = ALL_EXPORT_FIELDS.find(f => f.id === id);
	if (!field) return;

	const config = EXPORT_CONFIG['clipboard'];
	const isDefaultOn = config.defaultOn?.includes(id) ?? true;
	const isSelected = exportState.fieldStates[id] !== undefined ? exportState.fieldStates[id] : isDefaultOn;

	if (isSelected) {
		// Field was just selected, add to end if not present
		if (!exportState.fieldOrder.includes(id)) {
			exportState.fieldOrder.push(id);
		}
	} else {
		// Field was deselected, remove from order
		exportState.fieldOrder = exportState.fieldOrder.filter(fid => fid !== id);
	}
	renderClipboardBlocks();
}

/**
 * Renders the draggable field blocks for clipboard export.
 */
function renderClipboardBlocks() {
	const container = document.getElementById('clipboardBlocksList');
	if (!container) return;

	const format = 'clipboard';
	const config = EXPORT_CONFIG[format];

	// Initialize order if empty
	if (exportState.fieldOrder.length === 0) {
		const selectedFieldIds = [...(config.mandatory || [])];
		ALL_EXPORT_FIELDS.forEach(f => {
			if (!f.id || config.excluded?.includes(f.id) || selectedFieldIds.includes(f.id)) return;
			const isDefaultOn = config.defaultOn?.includes(f.id) ?? true;
			const isSelected = exportState.fieldStates[f.id] !== undefined ? exportState.fieldStates[f.id] : isDefaultOn;
			if (isSelected) selectedFieldIds.push(f.id);
		});
		exportState.fieldOrder = selectedFieldIds;
	}

	// Generate blocks HTML
	const blocksHtml = exportState.fieldOrder
		.map(id => {
			const field = ALL_EXPORT_FIELDS.find(f => f.id === id);
			if (!field) return '';

			return `
				<div class="clipboard-block flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg cursor-move transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 select-none shadow-sm" data-id="${id}">
					<i data-lucide="grip-vertical" class="w-3 h-3 text-zinc-400"></i>
					<span class="text-xs font-bold text-zinc-700 dark:text-zinc-200">${field.label}</span>
				</div>
			`;
		}).join('');

	container.innerHTML = blocksHtml;

	// Initializing SortableJS
	if (window.Sortable) {
		// Destroy existing instance if it exists
		const existing = Sortable.get(container);
		if (existing) existing.destroy();

		new Sortable(container, {
			animation: 150,
			ghostClass: 'opacity-50',
			onEnd: (evt) => {
				const blocks = container.querySelectorAll('.clipboard-block');
				exportState.fieldOrder = Array.from(blocks).map(b => b.getAttribute('data-id'));
				generateClipboardText();
			}
		});
	}

	if (window.lucide && window.lucide.createIcons) {
		window.lucide.createIcons();
	}
}

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
	if (exportState.category === 'clipboard' && typeof generateClipboardText === 'function') {
		generateClipboardText();
	}
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
	if (exportState.category === 'clipboard' && typeof generateClipboardText === 'function') {
		generateClipboardText();
	}
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
	if (exportState.category === 'clipboard' && typeof generateClipboardText === 'function') {
		generateClipboardText();
	}
}

// ============================================================================
// EXPORT TRIGGER
// ============================================================================

/**
 * Triggers the export download based on current settings.
 * @export
 */
export async function triggerExport() {
	const submitBtn = document.querySelector('#exportFooter button');
	const originalContent = submitBtn ? submitBtn.innerHTML : '';

	try {
		if (submitBtn) {
			submitBtn.disabled = true;
			submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Processing...';
			if (window.lucide?.createIcons) window.lucide.createIcons();
		}

		let relativeUrl = '';

		// Determine URL Path
		if (exportState.category === 'full') {
			relativeUrl = 'api/export/full';
		} else {
			const format = getCurrentFormat();
			if (format === 'db') {
				relativeUrl = 'api/export?format=db';
			} else {
				const config = EXPORT_CONFIG[format];
				if (!config) throw new Error("Invalid configuration for format " + format);

				const selectedFields = ALL_EXPORT_FIELDS
					.filter(f => {
						if (config.excluded?.includes(f.id)) return false;
						if (config.mandatory?.includes(f.id)) return true;
						return exportState.fieldStates[f.id] ?? true;
					})
					.map(f => f.backendField);

				const params = new URLSearchParams({
					format,
					fields: selectedFields.join(','),
					filterTypes: exportState.filterTypes.join(','),
					filterStatuses: exportState.filterStatuses.join(','),
					filterRatings: exportState.filterRatings.join(','),
					excludeHidden: (!state.isHidden || !(exportState.fieldStates['includeHidden'] ?? true)).toString(),
					includeCovers: (exportState.fieldStates['coverUrl'] ?? true).toString()
				});
				relativeUrl = `api/export?${params.toString()}`;
			}
		}

		// NATIVE APP EXPORT (via Python Bridge)
		if (window.pywebview && window.pywebview.api && window.pywebview.api.download_file) {
			console.log("Triggering Native Export via Bridge...");

			// Determine filename request based on format
			const format = exportState.category === 'full' ? 'zip' : getCurrentFormat();
			let filenameEstimate = 'upnext_export.zip';
			if (format === 'db') filenameEstimate = 'library.db';
			if (format === 'csv') filenameEstimate = 'upnext_library.zip'; // CSV is also zipped
			if (format === 'json_raw' || format === 'xml') filenameEstimate = 'upnext_export.zip';
			if (format.startsWith('html')) filenameEstimate = `upnext_${format}.html`;

			const result = await window.pywebview.api.download_file(relativeUrl, filenameEstimate);

			if (result === 'CANCELLED') {
				console.log("Export cancelled by user.");
			} else if (result !== 'OK') {
				throw new Error(result.replace('ERROR: ', ''));
			} else {
				showToast("Export saved successfully!", "success");
			}

			closeExportModal();
			return;
		}

		// BROWSER EXPORT (Fallback)
		console.log("Triggering Browser Export...");
		const res = await fetch('/' + relativeUrl);

		if (!res.ok) {
			// Try to interpret JSON error
			const contentType = res.headers.get("content-type");
			if (contentType && contentType.includes("application/json")) {
				const errorData = await res.json();
				throw new Error(errorData.message || "Export failed on server.");
			}
			throw new Error(`Server returned status ${res.status}`);
		}

		// Handle Download
		const blob = await res.blob();
		const downloadUrl = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = downloadUrl;

		// Try to get filename from headers or default
		const contentDisposition = res.headers.get('Content-Disposition');
		let fileName = 'export.zip';

		// Set correct fallback default based on format
		const currentFormat = exportState.category === 'full' ? 'zip' : getCurrentFormat();
		if (currentFormat === 'db') fileName = 'library.db';
		else if (currentFormat.startsWith('html')) fileName = `upnext_${currentFormat}.html`;

		if (contentDisposition && contentDisposition.includes('filename=')) {
			fileName = contentDisposition.split('filename=')[1].replace(/['"]/g, '');
		}

		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(downloadUrl);
		document.body.removeChild(a);

		closeExportModal();

	} catch (e) {
		console.error("Export Error:", e);
		// Assuming showToast is globally available or we use alert
		if (window.showToast) window.showToast("Export Failed: " + e.message, "error");
		else alert("Export Failed: " + e.message);
	} finally {
		if (submitBtn) {
			submitBtn.disabled = false;
			submitBtn.innerHTML = originalContent;
			if (window.lucide?.createIcons) window.lucide.createIcons();
		}
	}
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
// CLIPBOARD EXPORT LOGIC
// ============================================================================

/**
 * Generates the text for the clipboard export preview based on selected filters and fields.
 * Fetches JSON from the backend, then formats it textually.
 * @export
 */
export async function generateClipboardText() {
	const textarea = document.getElementById('clipboardTextarea');
	if (!textarea) return;

	textarea.value = '';
	textarea.placeholder = 'Generating preview...';

	try {
		const format = 'clipboard';
		const config = EXPORT_CONFIG[format];
		if (!config) throw new Error("Invalid configuration for clipboard");

		// Determine selected fields
		// Build selected fields dynamically based on exact UI state (mandatory + explicitly selected + defaultOn if un-toggled)
		let currentSelectedFieldIds = [...(config.mandatory || [])];
		ALL_EXPORT_FIELDS.forEach(f => {
			if (!f.id || config.excluded?.includes(f.id) || currentSelectedFieldIds.includes(f.id)) return;
			const isDefaultOn = config.defaultOn?.includes(f.id) ?? true;
			const isSelected = exportState.fieldStates[f.id] !== undefined ? exportState.fieldStates[f.id] : isDefaultOn;
			if (isSelected) currentSelectedFieldIds.push(f.id);
		});
		const selectedFields = ALL_EXPORT_FIELDS
			.filter(f => currentSelectedFieldIds.includes(f.id))
			.map(f => f.backendField);

		// Fetch clean JSON from backend
		const params = new URLSearchParams({
			format: 'json_pure',
			fields: selectedFields.join(','),
			filterTypes: exportState.filterTypes.join(','),
			filterStatuses: exportState.filterStatuses.join(','),
			filterRatings: exportState.filterRatings.join(','),
			excludeHidden: (!state.isHidden || !(exportState.fieldStates['includeHidden'] ?? true)).toString(),
			includeCovers: 'false'
		});

		const response = await fetch(`api/export?${params.toString()}`);
		if (!response.ok) throw new Error('Failed to fetch data');

		let data = await response.json();
		// Handle dynamic field order
		const orderedFields = exportState.fieldOrder.length > 0
			? exportState.fieldOrder.map(id => ALL_EXPORT_FIELDS.find(f => f.id === id)).filter(Boolean)
			: ALL_EXPORT_FIELDS.filter(f => currentSelectedFieldIds.includes(f.id));

		// Multi-level sorting based on the defined field order
		data.sort((a, b) => {
			for (const fieldId of exportState.fieldOrder) {
				const field = ALL_EXPORT_FIELDS.find(f => f.id === fieldId);
				if (!field) continue;
				const bField = field.backendField;

				const valA = String(a[bField] || '').toLowerCase();
				const valB = String(b[bField] || '').toLowerCase();

				if (valA < valB) return -1;
				if (valA > valB) return 1;
			}
			return 0;
		});

		let textLines = [];
		for (const item of data) {
			let lineParts = [];
			for (const fieldId of exportState.fieldOrder) {
				const fieldObj = ALL_EXPORT_FIELDS.find(f => f.id === fieldId);
				if (!fieldObj) continue;
				const bField = fieldObj.backendField;

				if (item[bField] !== undefined && item[bField] !== null && item[bField] !== '') {
					let val = item[bField];

					// Skip if rating is 0 (as requested by USER)
					if (bField === 'rating' && (val === 0 || val === '0')) continue;

					if (bField === 'seriesNumber') {
						val = '#' + val;
					}

					if (bField === 'rating') {
						const ratingInt = Math.floor(val);
						val = RATING_LABELS[ratingInt] || val;
					}

					if (bField === 'externalLinks' && Array.isArray(val)) {
						val = val.map(l => l.url || l).join(', ');
					}

					if (bField === 'isHidden') {
						if (val === true || val === 1 || val === '1') val = '[HIDDEN]';
						else continue; // Skip if not hidden
					}

					// Final skip for empty/null values after potential formatting
					if (val === undefined || val === null || String(val).trim() === '') continue;

					lineParts.push(String(val).trim());
				}
			}
			if (lineParts.length > 0) {
				textLines.push(lineParts.join(' - '));
			}
		}

		if (textLines.length === 0) {
			textarea.value = 'No items found matching your filters.';
		} else {
			textarea.value = textLines.join('\n');
		}

		const timestampSpan = document.getElementById('clipboardTimestamp');
		if (timestampSpan) {
			const now = new Date();
			timestampSpan.innerText = '(' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString() + ')';
		}

	} catch (err) {
		textarea.value = '';
		textarea.placeholder = `Error generating preview: ${err.message}`;
		console.error("Clipboard Generation Error:", err);
	}
}

/**
 * Copies the text area content to the clipboard.
 * @export
 */
export async function copyClipboardText() {
	const textarea = document.getElementById('clipboardTextarea');
	if (!textarea) return;

	try {
		if (window.pywebview && window.pywebview.api && window.pywebview.api.copy_to_clipboard) {
			await window.pywebview.api.copy_to_clipboard(textarea.value);
		} else if (navigator.clipboard) {
			await navigator.clipboard.writeText(textarea.value);
		} else {
			throw new Error('Clipboard API not available');
		}
		if (window.showToast) window.showToast("Copied to clipboard!", "success");
	} catch (err) {
		console.error("Copy failed:", err);
		try {
			textarea.select();
			document.execCommand('copy');
			textarea.setSelectionRange(0, 0);
			if (window.showToast) window.showToast("Copied to clipboard!", "success");
		} catch (fallbackErr) {
			if (window.showToast) window.showToast("Failed to copy text", "error");
		}
	}
}

/**
 * Toggles the clipboard text area to cover the screen.
 * @export
 */
export function toggleClipboardMaximize() {
	const wrapper = document.getElementById('clipboardPreviewWrapper');
	const icon = document.getElementById('clipboardMaximizeIcon');
	const text = document.getElementById('clipboardMaximizeText');

	if (!wrapper) return;

	const isMaximized = wrapper.classList.contains('absolute') && wrapper.classList.contains('inset-0');
	const floatingBtn = document.getElementById('clipboardMinimizeFloatingBtn');
	const floatingCopyBtn = document.getElementById('clipboardCopyFloatingBtn');

	if (isMaximized) {
		wrapper.classList.remove('absolute', 'inset-0', 'z-[60]', 'bg-white', 'dark:bg-[#0c0c0e]', 'p-6', 'rounded-3xl');
		wrapper.classList.add('relative', 'flex-1');
		if (icon) icon.setAttribute('data-lucide', 'maximize');
		if (text) text.innerText = 'Maximize';
		if (floatingBtn) floatingBtn.classList.add('hidden');
		if (floatingCopyBtn) floatingCopyBtn.classList.add('hidden');
	} else {
		wrapper.classList.remove('relative', 'flex-1');
		wrapper.classList.add('absolute', 'inset-0', 'z-[60]', 'bg-white', 'dark:bg-[#0c0c0e]', 'p-6', 'rounded-3xl');
		if (icon) icon.setAttribute('data-lucide', 'minimize');
		if (text) text.innerText = 'Minimize';
		if (floatingBtn) floatingBtn.classList.remove('hidden');
		if (floatingCopyBtn) floatingCopyBtn.classList.remove('hidden');
	}

	refreshIcons();
}

/**
 * Toggles text wrapping in the clipboard textarea.
 * @export
 */
export function toggleClipboardWrap() {
	const textarea = document.getElementById('clipboardTextarea');
	const icon = document.getElementById('clipboardWrapIcon');
	const text = document.getElementById('clipboardWrapText');

	if (!textarea) return;

	const isWrapped = !textarea.classList.contains('whitespace-pre');

	if (isWrapped) {
		textarea.classList.add('whitespace-pre');
		if (icon) icon.setAttribute('data-lucide', 'wrap-text');
		if (text) text.innerText = 'Wrap Off';
	} else {
		textarea.classList.remove('whitespace-pre');
		if (icon) icon.setAttribute('data-lucide', 'align-left');
		if (text) text.innerText = 'Wrap On';
	}

	refreshIcons();
}

// Global exposure for event handlers in HTML
window.generateClipboardText = generateClipboardText;
window.copyClipboardText = copyClipboardText;
window.toggleClipboardMaximize = toggleClipboardMaximize;
window.toggleClipboardWrap = toggleClipboardWrap;
