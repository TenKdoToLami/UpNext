/**
 * @fileoverview Global application state management for UpNext.
 * Contains the central state object and state mutation helpers.
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

	// Export state (legacy, may be unused)
	exportFieldStates: {},

	// Theme state
	theme: 'dark'
};

/**
 * Updates a single state property.
 * Provides a centralized way to modify state for future reactivity.
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
	state.currentAlternateTitles = [];
	state.currentChildren = [];
	state.currentLinks = [];
}
