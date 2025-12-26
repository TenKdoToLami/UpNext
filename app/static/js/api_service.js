/**
 * @fileoverview API service for UpNext.
 * Handles communication with the backend API endpoints for data fetching and persistence.
 * @module api_service
 */

import { state } from './state.js';
import { renderFilters, renderGrid, showGridLoading, hideGridLoading } from './render_utils.js';
import { safeCreateIcons } from './dom_utils.js';
import { showToast } from './toast.js';

/**
 * Checks the status of available databases and selection requirements.
 * @returns {Promise<{needsSelection: boolean, available: string[], active?: string}>} Status object.
 */
export async function getDbStatus() {
	try {
		const response = await fetch('/api/database/status');
		if (!response.ok) throw new Error('Failed to fetch DB status');
		return await response.json();
	} catch (e) {
		console.error('Failed to fetch DB status:', e);
		return { needsSelection: false, available: [] };
	}
}

/**
 * Sends a request to switch the active database.
 * @param {string} dbName - The filename of the database to select.
 * @returns {Promise<{status: string, message?: string}>} Success/error status with message.
 */
export async function selectDatabase(dbName) {
	try {
		const response = await fetch('/api/database/select', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ db_name: dbName })
		});
		return await response.json();
	} catch (e) {
		console.error('Failed to select DB:', e);
		return { status: 'error', message: e.message };
	}
}

/**
 * Fetches all library items from the API and updates the local state and UI.
 * This is the primary data loading function called on app initialization and refreshes.
 * @returns {Promise<void>}
 */
export async function loadItems() {
	try {
		showGridLoading();
		const response = await fetch('/api/items');
		if (!response.ok) throw new Error('Failed to fetch items');

		state.items = await response.json();

		// Refresh UI
		renderFilters();
		renderGrid();
		safeCreateIcons();
		hideGridLoading();
	} catch (error) {
		console.error('Error loading library items:', error);
		hideGridLoading();
	}
}

/**
 * Deletes a media item by its ID.
 * Prompts user for confirmation using the global styled modal if available,
 * otherwise falls back to a native confirmation dialog.
 *
 * @param {string} id - The unique identifier of the item to delete.
 * @returns {Promise<boolean>} True if successfully deleted, false otherwise.
 */
export async function deleteItem(id) {
	return new Promise((resolve) => {
		const performDelete = async () => {
			try {
				const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
				if (!response.ok) throw new Error('Delete operation failed');
				resolve(true);
			} catch (error) {
				console.error('Error deleting item:', error);
				showToast('Failed to delete item. Please try again.', 'error');
				resolve(false);
			}
		};

		if (typeof window.showConfirmationModal === 'function') {
			window.showConfirmationModal(
				'Delete Entry?',
				'Are you sure you want to delete this entry? This action cannot be undone.',
				performDelete,
				'warning',
				() => resolve(false) // On cancel
			);
		} else {
			if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
				resolve(false);
				return;
			}
			performDelete();
		}
	});
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


