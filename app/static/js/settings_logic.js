/**
 * @fileoverview Settings modal logic.
 * Handles configuration, rendering, and state management for the settings modal.
 * @module settings_logic
 */

import { state, saveAppSettings } from './state.js';
import { safeCreateIcons } from './dom_utils.js';
import { renderGrid, renderFilters } from './render_utils.js';
import { showToast } from './toast.js';
import { MEDIA_TYPES, STATUS_TYPES, STATUS_ICON_MAP, TYPE_COLOR_MAP, ICON_MAP, FEATURE_GROUPS } from './constants.js';
import { saveTag, renameTag, deleteTag } from './api_service.js';

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// Buffer for settings changes
let pendingAppSettings = null;

// Track collapsed states locally for the session (or could accept them reset on reopen)
const collapsedGroups = new Set();

/**
 * Initializes the settings modal state.
 */
export function openSettingsModal() {
	const modal = document.getElementById('settingsModal');
	if (modal) {
		modal.classList.remove('hidden');
		// Force reflow
		void modal.offsetWidth;
		modal.classList.remove('opacity-0');

		const content = document.getElementById('settingsModalContent');
		if (content) content.classList.remove('scale-95');

		// Initialize Pending State (Deep Clone)
		pendingAppSettings = JSON.parse(JSON.stringify(state.appSettings));

		// Ensure state is up to date and render
		renderSettings();

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

	// Persist Changes
	if (pendingAppSettings) {
		await saveAppSettings(pendingAppSettings);
	}

	// Apply Changes to UI (Main.js should import and expose applyStateToUI, or we trigger it here if possible)
	// Since applyStateToUI is in main.js and it's not exported yet, we might need to handle this.
	// Ideally, we trigger a global event or call a shared function.
	// For now, assuming applyStateToUI is global or we can access it via window if main.js exposes it?
	// Actually main.js is the consumer, so we can return/resolve, or dispatch event.
	// But since this replaces logic in "main.js", we can export a function that main.js calls?
	// Better: We dispatch a custom event that main.js listens to, OR generic "render everything".

	// For now, let's assume we can trigger the UI refresh.
	// Simplest way: Call the global render functions directly.
	applySettingsToGlobalUI();

	// Close Modal
	setTimeout(() => {
		closeSettingsModal();
		if (btn) btn.innerHTML = 'Save Changes';
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
		autoLaunchToggle.checked = !!currentSettings.autoLaunchLastDb;
	}

	const openWindowToggle = document.getElementById('setting-openWindowOnStart');
	if (openWindowToggle) {
		// Default to true if undefined
		const currentVal = currentSettings.openWindowOnStart !== undefined ? currentSettings.openWindowOnStart : true;
		openWindowToggle.checked = currentVal;
	}

	const customDomainInput = document.getElementById('setting-customDomain');
	if (customDomainInput) {
		customDomainInput.value = currentSettings.customDomain || '';
	}

	const trayActionSelect = document.getElementById('setting-trayClickAction');
	if (trayActionSelect) {
		trayActionSelect.value = currentSettings.trayClickAction || 'native';
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

function hslToHex(h, s, l) {
	l /= 100;
	const a = s * Math.min(l, 1 - l) / 100;
	const f = n => {
		const k = (n + h / 30) % 12;
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color).toString(16).padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}
