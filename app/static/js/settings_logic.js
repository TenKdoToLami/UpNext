/**
 * @fileoverview Settings modal logic.
 * Handles configuration, rendering, and state management for the settings modal.
 * @module settings_logic
 */

import { state, saveAppSettings } from './state.js';
import { safeCreateIcons, hslToHex } from './dom_utils.js';
import { renderGrid, renderFilters } from './render_utils.js';
import { showToast } from './toast.js';
import { MEDIA_TYPES, STATUS_TYPES, STATUS_ICON_MAP, TYPE_COLOR_MAP, ICON_MAP, FEATURE_GROUPS } from './constants.js';
import { saveTag, renameTag, deleteTag } from './api_service.js';

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// Buffer for settings changes
let pendingAppSettings = null;

// Track collapsed states locally for the session - all groups collapsed by default
const collapsedGroups = new Set([
	'core_assets',
	'categorization',
	'tracking',
	'reviews',
	'series_info',
	'metadata',
	'personal',
	'calendar',
	'stats'
]);

/**
 * Initializes the settings modal state.
 */
export function openSettingsModal() {
	const modal = document.getElementById('settingsModal');
	if (modal) {
		modal.classList.remove('hidden');
		void modal.offsetWidth;
		modal.classList.remove('opacity-0');

		const content = document.getElementById('settingsModalContent');
		if (content) content.classList.remove('scale-95');

		// Initialize Pending State (Deep Clone)
		pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));

		// Ensure state is up to date and render
		renderSettings();

		// Load External Config (Keys & Priorities)
		loadExternalConfig();

		// Reset to default tab (Features)
		switchSettingsTab('features');
	}
}

/**
 * Closes the settings modal.
 */
export function closeSettingsModal() {
	const modal = document.getElementById('settingsModal');
	modal.classList.add('opacity-0');
	document.getElementById('settingsModalContent').classList.add('scale-95');
	setTimeout(() => modal.classList.add('hidden'), 200);

	// Clear pending state
	pendingAppSettings = null;
}

/**
 * Saves the pending settings and closes the modal.
 */
export async function saveSettingsAndClose() {
	const btn = document.querySelector('button[onclick="window.saveSettingsAndClose()"]');
	if (btn) btn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i> Saving...';

	// Cancel any pending auto-save for app settings to avoid race
	if (typeof saveSettingsTimeout !== 'undefined' && saveSettingsTimeout) {
		clearTimeout(saveSettingsTimeout);
	}

	// 1. Save API Keys First (Sequential to ensure service updates)
	// Gather keys from inputs
	const keysToUpdate = {};
	const tmdbKey = document.getElementById('setting-tmdbApiKey')?.value?.trim();
	const googleBooksKey = document.getElementById('setting-googlebooksApiKey')?.value?.trim();
	const comicVineKey = document.getElementById('setting-comicvineApiKey')?.value?.trim();

	if (tmdbKey) keysToUpdate.tmdb = tmdbKey;
	if (googleBooksKey) keysToUpdate.googlebooks = googleBooksKey;
	if (comicVineKey) keysToUpdate.comicvine = comicVineKey;

	try {
		if (Object.keys(keysToUpdate).length > 0) {
			await fetch('/api/external/update-key', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(keysToUpdate)
			});

			// clear inputs
			if (tmdbKey) document.getElementById('setting-tmdbApiKey').value = '';
			if (googleBooksKey) document.getElementById('setting-googlebooksApiKey').value = '';
			if (comicVineKey) document.getElementById('setting-comicvineApiKey').value = '';
		}
	} catch (err) {
		console.error("Key save failed", err);
		showToast("Failed to save API keys", "error");
	}

	// 2. Save Config (AppSettings + Priorities) in ONE Batch
	const configUpdate = {};

	// App Settings
	if (pendingAppSettings) {
		configUpdate.appSettings = pendingAppSettings;
		// Update local state immediately
		state.appSettings = { ...state.appSettings, ...pendingAppSettings };
	}

	// Priorities
	const prioritiesObj = {};
	['Anime', 'Manga', 'Book', 'Series', 'Movie'].forEach(type => {
		const select = document.getElementById(`priority-${type.toLowerCase()}`);
		if (select) {
			prioritiesObj[type] = select.value;
		}
	});
	if (Object.keys(prioritiesObj).length > 0) {
		configUpdate.searchPriorities = prioritiesObj;
	}

	// Send Config Update
	if (Object.keys(configUpdate).length > 0) {
		try {
			await fetch('/api/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(configUpdate)
			});
		} catch (err) {
			console.error("Config save failed", err);
			showToast("Failed to save settings", "error");
		}
	}

	// Apply Changes to UI
	applySettingsToGlobalUI();

	// Close Modal
	setTimeout(() => {
		closeSettingsModal();
		if (btn) btn.innerHTML = 'Save Changes';
		showToast('Settings saved successfully', 'success');
	}, 500);
}

/**
 * Applies the current app settings to the global UI.
 * 
 * Performs:
 * 1. Global Theme Application
 * 2. Active Filter Sanitization (removes disabled tabs if currently selected)
 * 3. Rerendering of Filters and Grid
 * 4. Toggling of Feature Buttons (Calendar, Stats)
 */
export function applySettingsToGlobalUI() {
	// 1. Theme
	const isDark = state.theme === 'dark';
	if (isDark) document.documentElement.classList.add('dark');
	else document.documentElement.classList.remove('dark');

	// 2. Sanitize Active Filters 
	// If the currently selected type/status was just disabled, switch to 'All'
	if (state.appSettings.disabledTypes && state.appSettings.disabledTypes.length > 0) {
		state.filterTypes = state.filterTypes.filter(t => !state.appSettings.disabledTypes.includes(t));
		if (state.filterTypes.length === 0) state.filterTypes = ['All'];
	}
	if (state.appSettings.disabledStatuses && state.appSettings.disabledStatuses.length > 0) {
		state.filterStatuses = state.filterStatuses.filter(s => !state.appSettings.disabledStatuses.includes(s));
		if (state.filterStatuses.length === 0) state.filterStatuses = ['All'];
	}

	// 3. Render UI Components
	renderFilters();
	renderGrid();

	// 4. Toggle Feature Buttons in Header
	const calendarBtn = document.getElementById('calendarBtn');
	if (calendarBtn) {
		if (state.appSettings.disabledFeatures.includes('calendar')) calendarBtn.classList.add('hidden');
		else calendarBtn.classList.remove('hidden');
	}

	const statsBtn = document.getElementById('statsBtn');
	if (statsBtn) {
		if (state.appSettings.disabledFeatures.includes('stats')) statsBtn.classList.add('hidden');
		else statsBtn.classList.remove('hidden');
	}
}

/**
 * Switches the active settings tab.
 * @param {string} tabId 
 */
export function switchSettingsTab(tabId) {
	// Update Tabs
	document.querySelectorAll('.settings-tab-btn').forEach(btn => {
		btn.classList.remove('active', 'bg-white', 'dark:bg-zinc-900', 'shadow-sm', 'border-zinc-200', 'dark:border-zinc-800', 'text-indigo-500');
		btn.classList.add('text-zinc-500', 'dark:text-zinc-400', 'border-transparent');
		if (btn.id === `tab-${tabId}`) {
			btn.classList.add('active', 'bg-white', 'dark:bg-zinc-900', 'shadow-sm', 'border-zinc-200', 'dark:border-zinc-800', 'text-indigo-500');
			btn.classList.remove('text-zinc-500', 'dark:text-zinc-400', 'border-transparent');
		}
	});

	// Update Panels
	document.querySelectorAll('.settings-panel').forEach(panel => {
		panel.classList.add('hidden');
	});
	const target = document.getElementById(`settings-${tabId}`);
	if (target) target.classList.remove('hidden');
}


// =============================================================================
// INTERACTION HANDLERS
// =============================================================================

/**
 * Toggles a feature group (Enable/Disable).
 * @param {HTMLInputElement} checkbox 
 */
export function toggleFeature(checkbox) {
	try {
		const feature = checkbox.dataset.feature;
		const isEnabled = checkbox.checked;

		// Ensure pending set exists
		if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));

		const disabledFeatures = new Set(pendingAppSettings.disabledFeatures);
		if (isEnabled) disabledFeatures.delete(feature);
		else disabledFeatures.add(feature);

		pendingAppSettings.disabledFeatures = Array.from(disabledFeatures);

		// Optimized Visual Update (No Full Re-render)
		updateFeatureVisuals(feature, isEnabled);

	} catch (e) {
		console.error("Toggle Error:", e);
		showToast("Error toggling feature: " + e.message, "error");
	}
}

/**
 * Updates the visual state of a feature group without re-rendering.
 */
function updateFeatureVisuals(featureId, isEnabled) {
	const container = document.getElementById(`settings-group-${featureId}`);
	if (!container) return;

	const card = container.querySelector('.master-card');
	const subOptions = document.getElementById(`settings-sub-${featureId}`);
	const group = FEATURE_GROUPS.find(g => g.id === featureId);
	const color = group?.color || 'zinc';
	const ringClass = `ring-${color}-500/20`;

	// Update Master Card
	if (card) {
		if (isEnabled) {
			card.classList.add('ring-1', ringClass);
			card.classList.remove('opacity-75');
		} else {
			card.classList.remove('ring-1', ringClass);
			card.classList.add('opacity-75');
		}
	}

	// Update Sub Options
	if (subOptions) {
		if (isEnabled) {
			subOptions.classList.remove('opacity-50', 'grayscale', 'pointer-events-none');
		} else {
			subOptions.classList.add('opacity-50', 'grayscale', 'pointer-events-none');
		}

		// Update disabled state of inputs
		const inputs = subOptions.querySelectorAll('input');
		inputs.forEach(input => input.disabled = !isEnabled);
	}
}

/**
 * Toggles a specific field visibility.
 * @param {string} fieldId 
 * @param {boolean} isVisible 
 */
export function toggleHiddenField(fieldId, isVisible) {
	// Ensure pending set exists
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));

	// Constraint: Calendar Views
	if (!isVisible) {
		if (fieldId === 'calendar_upcoming' && pendingAppSettings.hiddenFields.includes('calendar_month')) {
			showToast("At least one calendar view must be enabled.", "warning");
			// Revert checkbox explicitly since we are not re-rendering
			const checkbox = document.querySelector(`input[onchange*="${fieldId}"]`);
			if (checkbox) checkbox.checked = true;
			return;
		}
		if (fieldId === 'calendar_month' && pendingAppSettings.hiddenFields.includes('calendar_upcoming')) {
			showToast("At least one calendar view must be enabled.", "warning");
			// Revert checkbox explicitly
			const checkbox = document.querySelector(`input[onchange*="${fieldId}"]`);
			if (checkbox) checkbox.checked = true;
			return;
		}
	}

	const hiddenFields = new Set(pendingAppSettings.hiddenFields);
	if (isVisible) hiddenFields.delete(fieldId);
	else hiddenFields.add(fieldId);

	pendingAppSettings.hiddenFields = Array.from(hiddenFields);

	// No render needed - checkbox state already matches user intent
}

/**
 * Toggles collapse state of a group.
 * @param {string} groupId 
 */
export function toggleGroupCollapse(groupId) {
	if (collapsedGroups.has(groupId)) {
		collapsedGroups.delete(groupId);
	} else {
		collapsedGroups.add(groupId);
	}
	// This one affects layout (hidden class), so we might need to toggle class manually
	// renderSettings(); // Avoid this if possible

	const subContainer = document.getElementById(`settings-sub-${groupId}`);
	const chevron = document.getElementById(`chevron-${groupId}`);

	if (subContainer) {
		if (subContainer.classList.contains('hidden')) {
			subContainer.classList.remove('hidden');
			if (chevron) chevron.classList.add('rotate-180');
		} else {
			subContainer.classList.add('hidden');
			if (chevron) chevron.classList.remove('rotate-180');
		}
	}
}

/**
 * Toggles a media type visibility.
 * @param {string} type 
 * @param {boolean} checked 
 */
export function toggleMediaType(type, checked) {
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));

	let disabled = new Set(pendingAppSettings.disabledTypes);
	if (checked) {
		disabled.delete(type);
	} else {
		disabled.add(type);
	}
	pendingAppSettings.disabledTypes = Array.from(disabled);
	// No render needed
}

/**
 * Toggles a status visibility.
 * @param {string} status 
 * @param {boolean} checked 
 */
export function toggleStatus(status, checked) {
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));

	let disabled = new Set(pendingAppSettings.disabledStatuses);
	if (checked) {
		disabled.delete(status);
	} else {
		disabled.add(status);
	}
	pendingAppSettings.disabledStatuses = Array.from(disabled);
	// No render needed
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Renders the settings features tab content, including feature groups and their sub-options.
 * Handles the state of disabled feature groups (visual gray-out) and collapsed sections.
 */
export function renderSettings() {
	const container = document.getElementById('settings-features-container');
	// Use Pending State if available, else Global State
	const currentSettings = pendingAppSettings || state.appSettings;

	if (container) {
		container.innerHTML = FEATURE_GROUPS.map(group => {
			const isGroupDisabled = currentSettings.disabledFeatures.includes(group.id);
			const isCollapsed = collapsedGroups.has(group.id);

			// NOTE: We allow expanding even if disabled to see what's inside (though grayed out)

			const colorMap = {
				'indigo': { text: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10', ring: 'ring-indigo-500/20' },
				'emerald': { text: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', ring: 'ring-emerald-500/20' },
				'amber': { text: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', ring: 'ring-amber-500/20' },
				'zinc': { text: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', ring: 'ring-zinc-500/20' },
				'blue': { text: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', ring: 'ring-blue-500/20' },
				'fuchsia': { text: 'text-fuchsia-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', ring: 'ring-fuchsia-500/20' },
				'violet': { text: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10', ring: 'ring-violet-500/20' },
				'cyan': { text: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10', ring: 'ring-cyan-500/20' },
				'teal': { text: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10', ring: 'ring-teal-500/20' }
			};
			const theme = colorMap[group.color] || colorMap['zinc'];

			const fieldsHtml = group.fields.map(field => {
				const isFieldHidden = currentSettings.hiddenFields.includes(field.id);
				const isLocked = field.locked === true;

				// Locked fields: always checked, disabled, with lock icon
				if (isLocked) {
					const affectsBadges = (field.affects || []).map(a =>
						`<span class="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-[9px] font-bold rounded uppercase">${a}</span>`
					).join('');

					return `
                    <div class="flex items-center justify-between p-3 ml-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-900/30 transition-all opacity-75">
                        <div class="flex flex-col flex-1 mr-4 gap-1">
                            <span class="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <i data-lucide="lock" class="w-3 h-3 text-zinc-400"></i>
                                ${field.label}
                            </span>
                            <span class="text-xs text-zinc-400 font-medium">${field.desc}</span>
                            ${affectsBadges ? `<div class="flex flex-wrap gap-1 mt-0.5">${affectsBadges}</div>` : ''}
                        </div>
                        <div class="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Required</div>
                    </div>
                `;
				}

				// Badges showing where this field appears
				const affectsBadges = (field.affects || []).map(a =>
					`<span class="px-1.5 py-0.5 bg-${group.color}-50 dark:bg-${group.color}-500/10 text-${group.color}-600 dark:text-${group.color}-400 text-[9px] font-bold rounded uppercase">${a}</span>`
				).join('');

				return `
                    <div class="flex items-center justify-between p-3 ml-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/50 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                        <div class="flex flex-col flex-1 mr-4 gap-1">
                            <span class="text-xs font-bold text-zinc-700 dark:text-zinc-300">${field.label}</span>
                            <span class="text-xs text-zinc-400 font-medium">${field.desc}</span>
                            ${affectsBadges ? `<div class="flex flex-wrap gap-1 mt-0.5">${affectsBadges}</div>` : ''}
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer"
                                onchange="window.toggleHiddenField('${field.id}', this.checked)"
                                ${!isFieldHidden ? 'checked' : ''} 
                                ${isGroupDisabled ? 'disabled' : ''}>
                            <div class="w-9 h-5 bg-zinc-200 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-${group.color}-600 peer-disabled:bg-zinc-300 dark:peer-disabled:bg-zinc-600 peer-disabled:opacity-70"></div>
                        </label>
                    </div>
                `;
			}).join('');

			const cardRing = !isGroupDisabled ? `ring-1 ${theme.ring}` : '';
			const cardOpacity = isGroupDisabled ? 'opacity-75' : '';
			const rotateClass = !isCollapsed ? 'rotate-180' : '';

			return `
                <div id="settings-group-${group.id}" class="space-y-3 transition-all duration-300">
                    <!-- Master Toggle Card -->
                    <div class="master-card flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all ${cardRing} ${cardOpacity}">
                        <!-- Clickable Header Area for Collapse -->
                        <div class="flex-1 flex items-center gap-3 cursor-pointer select-none" onclick="window.toggleGroupCollapse('${group.id}')">
                            <i data-lucide="chevron-down" id="chevron-${group.id}" class="w-4 h-4 text-zinc-400 transition-transform duration-300 ${rotateClass}"></i>
                            <div class="p-2 rounded-lg ${theme.bg} ${theme.text} transition-colors">
                                <i data-lucide="${group.icon}" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="font-bold text-zinc-900 dark:text-white text-sm">${group.label}</div>
                                <div class="text-[10px] text-zinc-500 dark:text-zinc-400">${group.desc}</div>
                            </div>
                        </div>

                        <!-- Separate Toggle Switch -->
                        <label class="relative inline-flex items-center cursor-pointer ml-4">
                            <input type="checkbox" class="sr-only peer" 
                                data-feature="${group.id}" 
                                onchange="window.toggleFeature(this)" 
                                ${!isGroupDisabled ? 'checked' : ''}>
                            <div class="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-${group.color}-300 dark:peer-focus:ring-${group.color}-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-${group.color}-600"></div>
                        </label>
                    </div>

                    <!-- Sub Options Container -->
                    ${fieldsHtml ? `
                    <div id="settings-sub-${group.id}" class="space-y-2 border-l-2 border-zinc-100 dark:border-zinc-800 ml-6 pl-2 transition-all duration-300 ease-in-out ${isCollapsed ? 'hidden' : ''} ${isGroupDisabled ? 'opacity-50 grayscale pointer-events-none' : ''}">
                        ${fieldsHtml}
                    </div>` : ''}
                </div>
            `;
		}).join('');
	}

	// 2. Content -> Active Media Types
	const typeContainer = document.getElementById('typeVisibilityContainer');
	if (typeContainer) {
		typeContainer.innerHTML = MEDIA_TYPES.map(type => {
			const isDisabled = currentSettings.disabledTypes.includes(type);
			const colorClass = TYPE_COLOR_MAP[type].split(' ')[0]; // Extract text color
			return `
                 <label class="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${ICON_MAP[type]}" class="w-4 h-4 text-zinc-400 group-hover:text-indigo-500 transition-colors"></i>
                        <span class="text-sm font-bold text-zinc-700 dark:text-zinc-300">${type}</span>
                    </div>
                    <input type="checkbox"
                        onchange="window.toggleMediaType('${type}', this.checked)" 
                        class="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        ${!isDisabled ? 'checked' : ''}>
                </label>
            `;
		}).join('');
	}

	// 3. Content -> Active Statuses
	const statusContainer = document.getElementById('statusVisibilityContainer');
	if (statusContainer) {
		// Use STATUS_TYPES
		statusContainer.innerHTML = STATUS_TYPES.map(status => {
			const isDisabled = currentSettings.disabledStatuses.includes(status);
			return `
                 <label class="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div class="flex items-center gap-2">
                         <i data-lucide="${STATUS_ICON_MAP[status]}" class="w-4 h-4 text-zinc-400"></i>
                        <span class="text-sm font-bold text-zinc-700 dark:text-zinc-300">${status}</span>
                    </div>
                    <input type="checkbox"
                         onchange="window.toggleStatus('${status}', this.checked)"
                        class="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        ${!isDisabled ? 'checked' : ''}>
                </label>
            `;
		}).join('');
	}

	// 4. Other Settings
	const autoLaunchToggle = document.getElementById('setting-autoLaunchDb');
	if (autoLaunchToggle) {
		autoLaunchToggle.checked = !!currentSettings.autoLaunchDb;
	}

	const openWindowToggle = document.getElementById('setting-openWindowOnStart');
	if (openWindowToggle) {
		// Default to true if undefined
		const currentVal = currentSettings.openWindowOnStart !== undefined ? currentSettings.openWindowOnStart : true;
		openWindowToggle.checked = currentVal;
	}

	const trayActionSelect = document.getElementById('setting-trayClickAction');
	if (trayActionSelect) {
		trayActionSelect.value = currentSettings.trayClickAction || 'native';
	}

	const closeBehaviorSelect = document.getElementById('setting-closeBehavior');
	if (closeBehaviorSelect) {
		closeBehaviorSelect.value = currentSettings.closeBehavior || 'ask';
	}

	// 5. Tags Settings
	const tagsContainer = document.getElementById('settings-tags-container');
	if (tagsContainer) {
		const sortedTags = Object.values(state.allTags || {}).sort((a, b) => a.name.localeCompare(b.name));

		const createHtml = `
		<div class="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-500/5 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
			<div class="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
				<i data-lucide="plus" class="w-5 h-5"></i>
			</div>
			<input type="text" id="newTagName" placeholder="Create new tag..." 
				class="flex-1 bg-transparent border-0 border-b border-indigo-200 dark:border-indigo-500/30 text-sm focus:ring-0 focus:border-indigo-500 p-0 pb-1 text-zinc-800 dark:text-zinc-200 placeholder:text-indigo-300 dark:placeholder:text-indigo-500/50"
				onkeydown="if(event.key === 'Enter') window.addNewTagHandler(this.value)">
			<button onclick="window.addNewTagHandler(document.getElementById('newTagName').value)" 
				class="text-xs font-bold uppercase tracking-wide px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm shadow-indigo-500/20">Add</button>
		</div>`;

		const listHtml = sortedTags.map(tag => `
			<div class="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group">
				<div class="relative w-10 h-10 shrink-0">
					<input type="color" 
						value="${tag.color}" 
						class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
						title="Change Color"
						onchange="window.saveTagColor('${tag.name.replace(/'/g, "\\'")}', this.value)">
					<div class="w-full h-full rounded-full border-2 border-white dark:border-zinc-700 shadow-sm transition-transform group-hover:scale-105" style="background-color: ${tag.color}"></div>
				</div>
					
				<div class="flex-1 min-w-0">
					<input type="text" 
						value="${tag.name.replace(/"/g, '&quot;')}"
						class="w-full bg-transparent font-bold text-zinc-800 dark:text-zinc-200 text-sm mb-1 border-0 border-b border-transparent focus:border-indigo-500 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all p-0 pb-0.5 focus:ring-0 truncate"
						title="Rename Tag"
						onchange="window.renameTagHandler('${tag.name.replace(/'/g, "\\'")}', this.value)">

					<input type="text"
						value="${(tag.description || '').replace(/"/g, '&quot;')}"
						placeholder="Add description..."
						class="w-full bg-transparent border-0 border-b border-transparent group-hover:border-zinc-200 dark:group-hover:border-zinc-700 hover:border-zinc-300 transition-all text-xs text-zinc-500 dark:text-zinc-400 focus:ring-0 focus:border-indigo-500 p-0 pb-0.5 placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
						onchange="window.saveTagDesc('${tag.name.replace(/'/g, "\\'")}', this.value)">
				</div>

				<button onclick="window.deleteTagHandler('${tag.name.replace(/'/g, "\\'")}')" 
					class="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Delete Tag">
					<i data-lucide="trash-2" class="w-4 h-4"></i>
				</button>
			</div>
		`).join('');

		tagsContainer.innerHTML = createHtml + (listHtml || '<div class="text-zinc-400 dark:text-zinc-600 italic text-sm text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl mt-4">No tags found. Create one above.</div>');
	}

	// 6. Image Settings
	const imgFormat = document.getElementById('setting-imageFormat');
	if (imgFormat) {
		imgFormat.value = currentSettings.imageSettings?.format || 'image/webp';
	}

	const imgQuality = document.getElementById('setting-imageQuality');
	const qualityVal = document.getElementById('qualityVal');
	if (imgQuality) {
		const q = currentSettings.imageSettings?.quality || 0.85;
		imgQuality.value = q;
		if (qualityVal) qualityVal.innerText = Math.round(q * 100) + '%';
	}

	const targetWidth = currentSettings.imageSettings?.width || 800;
	updateImageWidthButtons(targetWidth);

	// 7. Sync Guide & Quality Slider
	syncImageSettingsUI();

	// Scope icon creation to the modal content to avoid global flicker/reflow
	const modalContent = document.getElementById('settingsModalContent');
	safeCreateIcons(modalContent);
}

/**
 * Toggles the auto-launch preference from settings.
 * @param {boolean} checked 
 */
export function toggleAutoLaunchSetting(checked) {
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));
	pendingAppSettings.autoLaunchDb = checked;
}

/**
 * Toggles the open window on start preference from settings.
 * @param {boolean} checked 
 */
export function toggleOpenWindowOnStart(checked) {
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));
	pendingAppSettings.openWindowOnStart = checked;
}

/**
 * Sets the tray click action preference from settings.
 * @param {string} value - 'native' or 'browser'
 */
export function setTrayClickAction(value) {
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));
	pendingAppSettings.trayClickAction = value;
}

/**
 * Sets the close behavior preference from settings.
 * @param {string} value - 'ask', 'minimize', or 'exit'
 */
export function setCloseBehavior(value) {
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));
	pendingAppSettings.closeBehavior = value;
}

/**
 * Saves all API keys.
 * Called when the user clicks Save in the API Keys section.
 */
export async function saveApiKeys() {
	const tmdbKey = document.getElementById('setting-tmdbApiKey')?.value?.trim();
	const googleBooksKey = document.getElementById('setting-googlebooksApiKey')?.value?.trim();
	const comicVineKey = document.getElementById('setting-comicvineApiKey')?.value?.trim();

	// Construct payload with only non-empty values (unless clearing?)
	// Actually, user might want to clear a key.
	// If input is empty but placeholder indicates a key exists, we shouldn't overwrite unless intentional?
	// Standard practice: If value is present, update. If empty, ignore unless explicit clear action.
	// However, here we just send what's in the box if it's not empty?
	// Better: Send map of keys. Backend update_keys updates provided keys.
	const keysToUpdate = {};
	if (tmdbKey) keysToUpdate.tmdb = tmdbKey;
	if (googleBooksKey) keysToUpdate.googlebooks = googleBooksKey;
	if (comicVineKey) keysToUpdate.comicvine = comicVineKey;

	if (Object.keys(keysToUpdate).length === 0) {
		showToast('No API keys entered', 'warning');
		return;
	}

	try {
		const response = await fetch('/api/external/update-key', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(keysToUpdate)
		});

		if (response.ok) {
			showToast('API keys saved successfully', 'success');

			// Mask inputs
			if (tmdbKey) {
				const el = document.getElementById('setting-tmdbApiKey');
				el.value = '';
				el.placeholder = '••••••••••••••••';
			}
			if (googleBooksKey) {
				const el = document.getElementById('setting-googlebooksApiKey');
				el.value = '';
				el.placeholder = '••••••••••••••••';
			}
			if (comicVineKey) {
				const el = document.getElementById('setting-comicvineApiKey');
				el.value = '';
				el.placeholder = '••••••••••••••••';
			}

		} else {
			showToast('Failed to save API keys', 'error');
		}
	} catch (error) {
		console.error('Failed to save API keys:', error);
		showToast('Failed to save API keys', 'error');
	}
}

/**
 * Legacy wrapper for TMDB specific save (keeping for backward compat if needed, or remove)
 * We can redirect to generic save.
 */
export async function saveTmdbApiKey() {
	return saveApiKeys();
}

/**
 * Loads the external configuration (API keys & Search Priorities) when settings modal opens.
 */
export async function loadExternalConfig() {
	try {
		const response = await fetch('/api/config');
		if (response.ok) {
			const config = await response.json();

			// 1. API Keys
			const keys = config.apiKeys || {};
			const tmdbInput = document.getElementById('setting-tmdbApiKey');
			if (tmdbInput) {
				tmdbInput.value = '';
				tmdbInput.placeholder = keys.tmdb ? '••••••••••••••••' : 'Enter your TMDB API key...';
			}

			const gbInput = document.getElementById('setting-googlebooksApiKey');
			if (gbInput) {
				gbInput.value = '';
				gbInput.placeholder = keys.googlebooks ? '••••••••••••••••' : 'Enter your Google Books API key...';
			}

			const cvInput = document.getElementById('setting-comicvineApiKey');
			if (cvInput) {
				cvInput.value = '';
				cvInput.placeholder = keys.comicvine ? '••••••••••••••••' : 'Enter your Comic Vine API key...';
			}

			// 2. Search Priorities
			const priorities = config.searchPriorities || {};
			// Priorities: Anime, Manga, Book, Series, Movie
			['Anime', 'Manga', 'Book', 'Series', 'Movie'].forEach(type => {
				const val = priorities[type];
				if (val) {
					const select = document.getElementById(`priority-${type.toLowerCase()}`);
					if (select) select.value = val;
				}
			});
		}
	} catch (error) {
		console.error('Failed to load external config:', error);
	}
}

/**
 * Saves a tag color change.
 * @param {string} name 
 * @param {string} color 
 */
export function saveTagColor(name, color) {
	const t = state.allTags[name];
	if (t) {
		saveTag(name, color, t.description).then(() => {
			renderSettings();
			renderGrid();
			if (window.renderGenericTags) window.renderGenericTags();
		});
	}
}

/**
 * Saves a tag description change.
 * @param {string} name 
 * @param {string} desc 
 */
export function saveTagDesc(name, desc) {
	const t = state.allTags[name];
	if (t) {
		saveTag(name, t.color, desc);
	}
}

// Tag Management Handlers
/**
 * Handles adding a new tag from the settings UI.
 * @param {string} name - The name of the new tag.
 */
export function addNewTagHandler(name) {
	if (!name || !name.trim()) return;
	const cleanName = name.trim();
	if (state.allTags && state.allTags[cleanName]) {
		showToast('Tag already exists', 'error');
		return;
	}
	const color = hslToHex(Math.floor(Math.random() * 360), 70, 85);
	saveTag(cleanName, color, "").then(() => {
		showToast('Tag created');
		renderSettings();
	});
}

/**
 * Handles renaming an existing tag, with confirmation for merging if the new name exists.
 * @param {string} oldName - Current tag name.
 * @param {string} newName - New tag name.
 */
export async function renameTagHandler(oldName, newName) {
	if (!newName || !newName.trim()) {
		renderSettings(); // Revert
		return;
	}
	const cleanName = newName.trim();
	if (oldName === cleanName) return;

	if (state.allTags && state.allTags[cleanName]) {
		const confirmed = await showConfirm(
			'Merge Tags?',
			`Tag "${cleanName}" already exists. Do you want to merge "${oldName}" into it? This will update all items using the old tag.`,
			'Merge',
			'info'
		);
		if (!confirmed) {
			renderSettings(); // Revert
			return;
		}
	}

	renameTag(oldName, cleanName).then(() => {
		showToast('Tag renamed');
		renderSettings();
		renderGrid();
	}).catch(() => {
		showToast('Rename failed', 'error');
		renderSettings();
	});
}

/**
 * Handles deleting a tag with confirmation.
 * @param {string} name - Tag name to delete.
 */
export async function deleteTagHandler(name) {
	const confirmed = await showConfirm(
		'Delete Tag',
		`Are you sure you want to delete tag "${name}"? It will be removed from all items.`,
		'Delete',
		'danger'
	);

	if (confirmed) {
		deleteTag(name).then(() => {
			showToast('Tag deleted');
			renderSettings();
			renderGrid();
		});
	}
}

/**
 * Shows a confirmation modal using the global application modal.
 * @param {string} title 
 * @param {string} message 
 * @param {string} confirmText 
 * @param {'danger'|'info'} type 
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message, confirmText = 'Confirm', type = 'danger') {
	return new Promise((resolve) => {
		if (window.showConfirmationModal) {
			// Map 'danger' to 'warning' for the calendar modal style
			const modalType = type === 'danger' ? 'warning' : 'info';
			window.showConfirmationModal(
				title,
				message,
				() => resolve(true),
				modalType,
				() => resolve(false),
				confirmText
			);
		} else {
			// Fallback
			resolve(confirm(`${title}\n${message}`));
		}
	});
}


/**
 * Update the search priority configuration.
 * @param {string} type - 'Anime', 'Movie', 'Series'
 * @param {string} source - 'anilist', 'tmdb', 'tvmaze'
 */
window.savePrioritySearch = async function (type, source) {
	try {
		const response = await fetch('/api/external/priority', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, source })
		});

		if (response.ok) {
			showToast(`${type} priority updated`);
		} else {
			showToast('Failed to update priority', 'error');
		}
	} catch (e) {
		console.error(e);
		showToast('Connection failed', 'error');
	}
};

/**
 * Loads current config (including priorities) from the backend.
 * Checks /api/config or similar if available, or we might need to expose it.
 * But currently we don't have a direct endpoint for full config.
 * We can reuse loadApiKeyStatus logic or add a new call.
 * 
 * Ideally we fetch this on modal open.
 */
// We need to inject this loading into openSettingsModal or loadApiKeyStatus or similar.
// For now, let's assume we can fetch it when rendering the Connections tab.
// I will update loadApiKeyStatus to also fetch priorities if I can modify the backend to return them,
// OR I create a separate loader.

// Since I cannot easily modify loadAttributes easily without viewing it, I will add a new function here
// and call it from openSettingsModal (via window export or editing openSettingsModal).

window.loadSearchPriorities = async function () {
	// We don't have a GET endpoint for priorities yet.
	// I should probably add one or include it in /api/keys which I recall exists?
	// Let's check api.py for GET /api/keys or config.
};

/**
 * Updates a specific image setting.
 * @param {string} key - 'format', 'quality', or 'width'
 * @param {*} value 
 */
export function setImageSetting(key, value) {
	if (!pendingAppSettings) pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));
	if (!pendingAppSettings.imageSettings) pendingAppSettings.imageSettings = { format: 'image/webp', quality: 0.85, width: 800 };

	pendingAppSettings.imageSettings[key] = value;

	if (key === 'width') {
		updateImageWidthButtons(value);
	}

	syncImageSettingsUI();
}

/**
 * Synchronizes dependencies between image settings (Quality slider visibility, Guide rows).
 */
function syncImageSettingsUI() {
	const currentSettings = pendingAppSettings || state.appSettings;
	const format = currentSettings.imageSettings?.format || 'image/webp';

	// 1. Quality Slider Visibility
	const slider = document.getElementById('qualitySliderContainer');
	if (slider) {
		if (format === 'image/png') slider.classList.add('hidden');
		else slider.classList.remove('hidden');
	}

	// 2. Render Guide
	renderImageGuide();
}

/**
 * Renders the dynamic image guide table based on the currently selected resolution.
 */
function renderImageGuide() {
	const body = document.getElementById('imageGuideBody');
	if (!body) return;

	const currentSettings = pendingAppSettings || state.appSettings;
	const activeWidth = currentSettings.imageSettings?.width || 800;
	const activeMime = currentSettings.imageSettings?.format || 'image/webp';
	const activeQuality = currentSettings.imageSettings?.quality || 0.85;

	const widths = [400, 600, 800, 1000, 1200];
	const currentIndex = widths.indexOf(activeWidth);

	// Determine which widths to show: Previous, Active, Next
	const showWidths = [];
	if (currentIndex > 0) showWidths.push(widths[currentIndex - 1]);
	showWidths.push(widths[currentIndex]);
	if (currentIndex < widths.length - 1) showWidths.push(widths[currentIndex + 1]);

	// Data Stats (Estimated for 2:3 ratio)
	const stats = {
		'image/jpeg': { label: 'JPEG', baseQuality: 0.9, perf: 'Ultra Fast', perfLevel: 1, color: 'indigo', sizes: { 400: 50, 600: 115, 800: 260, 1000: 420, 1200: 650 } },
		'image/webp': { label: 'WebP', baseQuality: 0.85, perf: 'Fast', perfLevel: 1, color: 'emerald', sizes: { 400: 35, 600: 80, 800: 180, 1000: 300, 1200: 450 } },
		'image/avif': { label: 'AVIF', baseQuality: 0.7, perf: 'Moderate', perfLevel: 2, color: 'teal', sizes: { 400: 25, 600: 60, 800: 130, 1000: 220, 1200: 350 } },
		'image/png': { label: 'PNG', baseQuality: 1.0, perf: 'Heavy I/O', perfLevel: 3, color: 'red', sizes: { 400: 500, 600: 1500, 800: 4000, 1000: 6500, 1200: 9000 } }
	};

	const rows = [];

	showWidths.forEach(w => {
		const isCurrentWidth = w === activeWidth;

		Object.entries(stats).forEach(([mime, data]) => {
			const isCurrentFormat = mime === activeMime;
			const isMatch = isCurrentWidth && isCurrentFormat;

			// Highlight logic: Emerald for exact match, subtle Indigo for current width context
			let rowBg = '';
			let statusBadge = '';
			if (isMatch) {
				rowBg = 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/30';
				statusBadge = `<span class="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1"><i data-lucide="check-circle" class="w-2.5 h-2.5"></i> Active Configuration</span>`;
			} else if (isCurrentWidth) {
				rowBg = 'bg-indigo-50/30 dark:bg-indigo-500/5';
				statusBadge = `<span class="text-[8px] font-bold text-indigo-400 uppercase">Selected Res</span>`;
			}

			let sizeKB = data.sizes[w];
			let label = data.label;

			if (mime === 'image/png') {
				label += ' (Lossless)';
			} else {
				const q = isMatch ? activeQuality : data.baseQuality;
				label += ` (${Math.round(q * 100)}%)`;

				// Very rough estimation scalar if user has custom quality selected
				if (isMatch && activeQuality !== data.baseQuality) {
					// This is VERY approximate, but better than showing static 90% size for 50% quality
					// We use a non-linear scalar to avoid underestimating too much at low quality
					const scalar = Math.pow(activeQuality / data.baseQuality, 1.2);
					sizeKB *= scalar;
				}
			}

			const sizeStr = sizeKB >= 1000 ? `~${(sizeKB / 1000).toFixed(1)} MB` : `~${sizeKB.toFixed(0)} KB`;
			const itemsPerGB = Math.round(1024 * 1024 / sizeKB).toLocaleString();

			// Render Performance Bars
			const level = data.perfLevel;
			const barClass = level === 1 ? 'bg-emerald-500' : (level === 2 ? 'bg-blue-500' : 'bg-red-500');
			const bars = `
                <div class="flex items-end gap-0.5 justify-end" title="Processing Overhead: ${data.perf}">
                    <div class="w-1.5 h-1.5 rounded-t-[1px] ${level >= 1 ? barClass : 'bg-zinc-200 dark:bg-zinc-800'}"></div>
                    <div class="w-1.5 h-2.5 rounded-t-[1px] ${level >= 2 ? barClass : 'bg-zinc-200 dark:bg-zinc-800'}"></div>
                    <div class="w-1.5 h-4 rounded-t-[1px] ${level >= 3 ? barClass : 'bg-zinc-200 dark:bg-zinc-800'}"></div>
                </div>
            `;

			rows.push(`
                <tr class="${rowBg} transition-colors border-l-2 ${isMatch ? 'border-emerald-500' : 'border-transparent'}">
                    <td class="px-4 py-2">
                        <div class="flex flex-col">
                            <span class="font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">${label}</span>
                            ${statusBadge}
                        </div>
                    </td>
                    <td class="px-3 py-2 text-zinc-500 font-mono">${w}px</td>
                    <td class="px-3 py-2 text-zinc-500 text-right whitespace-nowrap">${sizeStr}</td>
                    <td class="px-3 py-2 text-right">
                        <span class="font-bold ${isMatch ? 'text-emerald-500' : `text-${data.color}-500`}">${itemsPerGB}</span>
                    </td>
                    <td class="px-4 py-2">
                        ${bars}
                    </td>
                </tr>
            `);
		});
	});

	body.innerHTML = rows.join('');

	// Re-initialize icons in the table
	const settingsPanel = document.getElementById('settings-images');
	if (settingsPanel && typeof lucide !== 'undefined') {
		lucide.createIcons({
			attrs: { class: 'lucide-custom' },
			nameAttr: 'data-lucide'
		});
	}
}

/**
 * Updates the visual state of the width selection buttons.
 */
function updateImageWidthButtons(activeWidth) {
	document.querySelectorAll('.image-width-btn').forEach(btn => {
		const btnWidth = parseInt(btn.id.replace('width-btn-', ''));
		if (btnWidth === activeWidth) {
			btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-md');
			btn.classList.remove('bg-white', 'text-zinc-500', 'border-zinc-200', 'dark:bg-zinc-900', 'dark:text-zinc-400', 'dark:border-zinc-800');
		} else {
			btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-md');
			btn.classList.add('bg-white', 'text-zinc-500', 'border-zinc-200', 'dark:bg-zinc-900', 'dark:text-zinc-400', 'dark:border-zinc-800');
		}
	});
}

// Window Bindings
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettingsAndClose = saveSettingsAndClose;
window.switchSettingsTab = switchSettingsTab;
window.toggleFeature = toggleFeature;
window.toggleHiddenField = toggleHiddenField;
window.toggleGroupCollapse = toggleGroupCollapse;
window.toggleMediaType = toggleMediaType;
window.toggleStatus = toggleStatus;
window.toggleAutoLaunchSetting = toggleAutoLaunchSetting;
window.toggleOpenWindowOnStart = toggleOpenWindowOnStart;
window.setTrayClickAction = setTrayClickAction;
window.setCloseBehavior = setCloseBehavior;
window.setImageSetting = setImageSetting;
