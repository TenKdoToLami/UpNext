/**
 * @fileoverview Global application state management for UpNext.
 * Contains the central state object and state mutation helpers.
 * 
 * This module is designed to be a lightweight Redux-like store.
 * You can import 'state' to read data and 'setState' to mutate it.
 * @module state
 */

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
	theme: 'dark'
};

/**
 * Keys that should be persisted to LocalStorage.
 */
const PERSISTED_KEYS = [
	'viewMode', 'sortBy', 'sortOrder', 'showDetails',
	'isHidden', 'isMultiSelect', 'filterHiddenOnly', 'theme'
];

/**
 * Saves specific application state to localStorage.
 */
function saveUIState() {
	const data = {};
	PERSISTED_KEYS.forEach(key => {
		data[key] = state[key];
	});
	localStorage.setItem('upnext_ui_state', JSON.stringify(data));
}

/**
 * Loads persisted state from localStorage.
 */
export function loadUIState() {
	try {
		const stored = localStorage.getItem('upnext_ui_state');
		if (stored) {
			const data = JSON.parse(stored);
			PERSISTED_KEYS.forEach(key => {
				if (data[key] !== undefined) {
					state[key] = data[key];
				}
			});
		}
	} catch (e) {
		console.error("Failed to load UI state:", e);
	}
}

/**
 * Updates a single state property and persists if needed.
 * @param {string} key - The state property to update
 * @param {*} value - The new value
 */
export function setState(key, value) {
	state[key] = value;
	if (PERSISTED_KEYS.includes(key)) {
		saveUIState();
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

