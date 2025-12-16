/**
 * @fileoverview API service for UpNext.
 * Handles communication with the backend API endpoints.
 * @module api_service
 */

import { state } from './state.js';
import { renderFilters, renderGrid } from './render_utils.js';
import { safeCreateIcons } from './dom_utils.js';

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Fetches all library items from the API and updates the UI.
 * @returns {Promise<void>}
 */
export async function loadItems() {
	const response = await fetch('/api/items');
	state.items = await response.json();
	renderFilters();
	renderGrid();
	safeCreateIcons();
}

// ============================================================================
// ITEM OPERATIONS
// ============================================================================

/**
 * Deletes an item after user confirmation.
 * @param {string} id - The item ID to delete
 * @returns {Promise<boolean>} True if deleted, undefined if cancelled
 */
export async function deleteItem(id) {
	if (!confirm('Delete this entry?')) return;
	await fetch(`/api/items/${id}`, { method: 'DELETE' });
	return true;
}

/**
 * Fetches a single item by ID.
 * @param {string} id - The item ID
 * @returns {Promise<Object|null>} The item data or null if not found
 */
export async function getItem(id) {
	const response = await fetch(`/api/items/${id}`);
	if (!response.ok) return null;
	return response.json();
}

/**
 * Saves an item (create or update).
 * @param {FormData} formData - Form data containing the item and optional image
 * @returns {Promise<Object>} The saved item
 */
export async function saveItem(formData) {
	const response = await fetch('/api/items', {
		method: 'POST',
		body: formData
	});
	return response.json();
}

// ============================================================================
// AUTOCOMPLETE DATA
// ============================================================================

/**
 * Fetches autocomplete suggestions for universe and series fields.
 * @returns {Promise<Object>} Object with universes and series arrays
 */
export async function getAutocompleteData() {
	const response = await fetch('/api/autocomplete');
	return response.json();
}
