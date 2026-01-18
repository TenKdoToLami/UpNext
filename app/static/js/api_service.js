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
 * Creates a new database.
 * @param {string} dbName - The name of the new database.
 * @returns {Promise<{status: string, message?: string, db_name?: string}>}
 */
export async function createDatabase(dbName) {
	try {
		const response = await fetch('/api/database/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ db_name: dbName })
		});
		return await response.json();
	} catch (e) {
		console.error('Failed to create DB:', e);
		return { status: 'error', message: e.message };
	}
}

/**
 * Deletes a database.
 * @param {string} dbName - The name of the database to delete.
 * @returns {Promise<{status: string, message?: string}>}
 */
export async function deleteDatabase(dbName) {
	try {
		const response = await fetch('/api/database/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ db_name: dbName })
		});
		return await response.json();
	} catch (e) {
		console.error('Failed to delete DB:', e);
		return { status: 'error', message: e.message };
	}
}

/**
 * Checks for system updates via the backend.
 * @returns {Promise<Object>} Update status object.
 */

/**
 * Checks for system updates via the backend.
 * @returns {Promise<Object>} Update status object.
 */
export async function checkSystemUpdate() {
	try {
		const response = await fetch('/api/system/check_update');
		if (!response.ok) throw new Error('Failed to check for updates');
		return await response.json();
	} catch (e) {
		console.error('Failed to check updates:', e);
		return { error: e.message };
	}
}

/**
 * Shuts down the backend application.
 */
export async function shutdownApp() {
	try {
		await fetch('/api/system/shutdown', { method: 'POST' });
		return true;
	} catch (e) {
		console.error('Shutdown failed:', e);
		return false;
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

		// 1. Fetch Items (Critical)
		const itemsRes = await fetch('/api/items');
		if (!itemsRes.ok) throw new Error('Failed to fetch items');
		state.items = await itemsRes.json();

		// 2. Fetch Tags (Optional)
		try {
			const tagsRes = await fetch('/api/tags');
			if (tagsRes.ok) state.allTags = await tagsRes.json();
		} catch (e) {
			console.warn('Failed to fetch tags:', e);
		}

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

/**
 * Saves a tag's metadata to the backend and updates local state.
 * @param {string} name 
 * @param {string} color 
 * @param {string} description 
 */
export async function saveTag(name, color, description = "") {
	try {
		const res = await fetch('/api/tags', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, color, description })
		});
		if (res.ok) {
			const tagData = await res.json();
			state.allTags[name] = tagData;
			return tagData;
		}
	} catch (e) {
		console.error('Failed to save tag:', e);
		throw e;
	}
}


/**
 * Renames a tag and updates items.
 * @param {string} oldName 
 * @param {string} newName 
 */
export async function renameTag(oldName, newName) {
	if (oldName === newName) return;
	try {
		const res = await fetch('/api/tags/rename', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ oldName, newName })
		});
		if (res.ok) {
			const newTagData = await res.json();
			// Update State
			if (state.allTags[oldName]) delete state.allTags[oldName];
			state.allTags[newName] = newTagData;

			// Update Items
			state.items.forEach(item => {
				if (item.tags && item.tags.includes(oldName)) {
					// Replace logic
					const idx = item.tags.indexOf(oldName);
					if (idx !== -1) {
						if (item.tags.includes(newName)) {
							item.tags.splice(idx, 1); // Remove old, new exists
						} else {
							item.tags[idx] = newName;
						}
					}
				}
			});
			return newTagData;
		}
	} catch (e) {
		console.error('Failed to rename tag:', e);
		throw e;
	}
}

/**
 * Deletes a tag and removes it from items.
 * @param {string} name 
 */
export async function deleteTag(name) {
	try {
		const res = await fetch(`/api/tags/${encodeURIComponent(name)}`, {
			method: 'DELETE'
		});
		if (res.ok) {
			if (state.allTags[name]) delete state.allTags[name];
			// Update Items
			state.items.forEach(item => {
				if (item.tags) {
					item.tags = item.tags.filter(t => t !== name);
				}
			});
		}
	} catch (e) {
		console.error('Failed to delete tag:', e);
		throw e;
	}
}


window.loadItems = loadItems;
