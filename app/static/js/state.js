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
 * Updates a single state property.
 * @param {string} key - The state property to update
 * @param {*} value - The new value
 */
export function setState(key, value) {
	state[key] = value;
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

