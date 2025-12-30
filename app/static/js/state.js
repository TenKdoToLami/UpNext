// state.js
/**
 * @fileoverview Global application state management for UpNext.
 * Contains the central state object and state mutation helpers.
 * 
 * This module is designed to be a lightweight Redux-like store.
 * You can import 'state' to read data and 'setState' to mutate it.
 * @module state
 */

import { FEATURE_GROUPS } from './constants.js';

/**
 * Global application state object.

 * @type {Object}
 */
export const state = {
	// Library data
	items: [],

	// Form state (for add/edit modal)
	currentAuthors: [],
	currentAbbreviations: [],
	currentAlternateTitles: [],
	currentChildren: [],
	currentLinks: [],

	// Filter state
	filterTypes: ['All'],
	filterStatuses: ['All'],
	filterRatings: [],

	// View preferences
	viewMode: 'grid',
	sortBy: 'updatedAt',
	sortOrder: 'desc',
	showDetails: false,

	// Display modes
	isHidden: false,
	isMultiSelect: false,
	filterHiddenOnly: false,

	// Wizard navigation state
	currentStep: 1,
	maxReachedStep: 1,
	isEditMode: false,
	TOTAL_STEPS: 11,

	// Theme state
	theme: 'dark',

	// Persistent Module States
	statsChartTypes: {
		typeChart: 'doughnut',
		statusChart: 'doughnut',
		ratingChart: 'doughnut',
		growthChart: 'line'
	},
	calendarView: 'month',

	// Global Application Settings (User Preference)
	appSettings: {
		hiddenFields: [],     // Fields to hide (e.g. 'rereadCount')
		disabledFeatures: [], // Features to disable (e.g. 'calendar')
		disabledTypes: [],    // Media Types to hide (e.g. 'Manga')
		disabledStatuses: []  // Statuses to hide (e.g. 'Dropped')
	}
};

/**
 * Keys that should be persisted to LocalStorage.
 */
const PERSISTED_KEYS = [
	'viewMode', 'sortBy', 'sortOrder', 'showDetails',
	'isHidden', 'isMultiSelect', 'filterHiddenOnly', 'theme',
	'statsChartTypes', 'calendarView', 'appSettings'
];

/**
 * Helper to wait for pywebview to be ready.
 */
function waitForPywebview(timeout = 1000) {
	return new Promise(resolve => {
		if (window.pywebview) return resolve(true);

		const timer = setTimeout(() => resolve(false), timeout);

		window.addEventListener('pywebviewready', () => {
			clearTimeout(timer);
			resolve(true);
		}, { once: true });
	});
}

/**
 * Saves specific application state to persistent storage.
 * Uses pywebview native API if available, falls back to LocalStorage.
 */
async function saveUIState(key, value) {
	const isNative = await waitForPywebview(200);

	if (isNative && window.pywebview.api) {
		try {
			await window.pywebview.api.save_app_config(key, value);
		} catch (e) {
			console.error("Native save failed:", e);
		}
	} else {
		// Fallback or Sync Mirror
		const stored = localStorage.getItem('upnext_ui_state') || '{}';
		const data = JSON.parse(stored);
		data[key] = value;
		localStorage.setItem('upnext_ui_state', JSON.stringify(data));
	}
}

/**
 * Loads persisted state from storage.
 */
export async function loadUIState() {
	let data = {};

	// 1. Try Native Config (Wait briefly)
	const isNative = await waitForPywebview(500);

	if (isNative && window.pywebview.api) {
		try {
			data = await window.pywebview.api.get_app_config();
		} catch (e) {
			console.error("Native load failed:", e);
		}
	}

	// 2. Merge/Fallback to LocalStorage if native empty (or first run)
	if (Object.keys(data).length === 0) {
		try {
			const stored = localStorage.getItem('upnext_ui_state');
			if (stored) data = JSON.parse(stored);
		} catch (e) { console.error(e); }
	}

	// 3. Apply to state
	PERSISTED_KEYS.forEach(key => {
		if (data[key] !== undefined) {
			state[key] = data[key];
		}
	});

	// 4. Trigger UI updates based on loaded state if needed
	// (Caller usually calls applyStateToUI next)
}

/**
 * Updates a single state property and persists if needed.
 * @param {string} key - The state property to update
 * @param {*} value - The new value
 */
export function setState(key, value) {
	state[key] = value;
	if (PERSISTED_KEYS.includes(key)) {
		saveUIState(key, value);
	}
}

/**
 * Resets filter state to defaults.
 */
export function resetFilters() {
	state.filterTypes = ['All'];
	state.filterStatuses = ['All'];
	state.filterRatings = [];
}

/**
 * Resets form state for add/edit modal.
 */
export function resetFormState() {
	state.currentAuthors = [];
	state.currentAbbreviations = [];
	state.currentAlternateTitles = [];
	state.currentChildren = [];
	state.currentLinks = [];
}

// Expose to window for non-module scripts (like legacy calendar logic)
window.state = state;
window.setState = setState;

/**
 * Helper to update and persist app settings directly.
 * Debounces the backend save to prevent rapid I/O from crashing the webview/backend.
 * @param {Object} partialSettings - key/value pairs to merge into appSettings
 */
let saveSettingsTimeout = null;
export function saveAppSettings(partialSettings) {
	state.appSettings = { ...state.appSettings, ...partialSettings };

	if (saveSettingsTimeout) clearTimeout(saveSettingsTimeout);
	saveSettingsTimeout = setTimeout(() => {
		saveUIState('appSettings', state.appSettings);
	}, 1000);
}

/**
 * Checks if a specific field should be visible.
 * Considers both the field's hidden status AND its parent feature group's disabled status.
 * @param {string} fieldId - The ID of the field to check
 * @returns {boolean} True if visible/enabled, false if effectively disabled
 */
export function isFieldVisible(fieldId) {
	// 1. Check if specific field is explicitly hidden
	if (state.appSettings?.hiddenFields?.includes(fieldId)) return false;

	// 2. Find parent feature group and check if it is disabled
	const group = FEATURE_GROUPS.find(g => g.fields.some(f => f.id === fieldId) || g.id === fieldId);

	// If no group found (standalone field?), assume enabled unless hidden above
	if (!group) return true;

	// If group disabled, field is NOT visible
	if (state.appSettings?.disabledFeatures?.includes(group.id)) return false;

	return true;
}

