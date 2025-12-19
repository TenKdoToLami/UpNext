/**
 * @fileoverview API service for UpNext.
 * Handles communication with the backend API endpoints for data fetching and persistence.
 * @module api_service
 */

import { state } from './state.js';
import { renderFilters, renderGrid } from './render_utils.js';
import { safeCreateIcons } from './dom_utils.js';

/**
 * Fetches all library items from the API and updates the local state and UI.
 * This is the primary data loading function called on app initialization and refreshes.
 * @returns {Promise<void>}
 */
export async function loadItems() {
	try {
		const response = await fetch('/api/items');
		if (!response.ok) throw new Error('Failed to fetch items');

		state.items = await response.json();

		// Refresh UI
		renderFilters();
		renderGrid();
		safeCreateIcons();
	} catch (error) {
		console.error('Error loading library items:', error);
	}
}

/**
 * Deletes a media item by its ID.
 * Prompts user for confirmation before proceeding.
 * @param {string} id - The unique identifier of the item to delete.
 * @returns {Promise<boolean>} True if successfully deleted, false or undefined otherwise.
 */
export async function deleteItem(id) {
	if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
		return false;
	}

	try {
		const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
		if (!response.ok) throw new Error('Delete operation failed');
		return true;
	} catch (error) {
		console.error('Error deleting item:', error);
		alert('Failed to delete item. Please try again.');
		return false;
	}
}

/**
 * Saves a media item (creates a new one or updates an existing one).
 * Uses FormData to support potential binary image uploads.
 * @param {FormData} formData - FormData object containing 'data' (JSON string) and optional 'image'.
 * @returns {Promise<Object>} The API response containing the saved item.
 * @throws {Error} If the save operation fails.
 */
export async function saveItem(formData) {
	const response = await fetch('/api/items', {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.message || 'Failed to save item');
	}

	return response.json();
}

