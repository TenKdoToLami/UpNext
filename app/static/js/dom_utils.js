/**
 * @fileoverview DOM utility functions for UpNext.
 * Provides safe DOM manipulation helpers and icon management.
 * @module dom_utils
 */

// ============================================================================
// ICON MANAGEMENT
// ============================================================================

/**
 * Safely initializes Lucide icons in the DOM.
 * Catches and logs any errors to prevent breaking the UI.
 */
export function safeCreateIcons() {
	if (window.lucide?.createIcons) {
		try {
			window.lucide.createIcons();
		} catch (e) {
			console.warn('Lucide icon creation failed:', e);
		}
	}
}

// ============================================================================
// SAFE DOM ACCESSORS
// ============================================================================

/**
 * Safely sets the value of an input element.
 * @param {string} id - Element ID
 * @param {string} val - Value to set
 */
export function safeVal(id, val) {
	const el = document.getElementById(id);
	if (el) el.value = val;
}

/**
 * Safely sets the innerText of an element.
 * @param {string} id - Element ID
 * @param {string} val - Text to set
 */
export function safeText(id, val) {
	const el = document.getElementById(id);
	if (el) el.innerText = val;
}

/**
 * Safely sets the innerHTML of an element.
 * @param {string} id - Element ID
 * @param {string} val - HTML to set
 */
export function safeHtml(id, val) {
	const el = document.getElementById(id);
	if (el) el.innerHTML = val;
}

/**
 * Safely sets the checked state of a checkbox/radio.
 * @param {string} id - Element ID
 * @param {boolean} val - Checked state
 */
export function safeCheck(id, val) {
	const el = document.getElementById(id);
	if (el) el.checked = val;
}

// ============================================================================
// UI INTERACTIONS
// ============================================================================

/**
 * Toggles text expansion for "Read More" / "Show Less" functionality.
 * @param {string} id - Item ID
 * @param {string} type - Content type (e.g., 'desc', 'review', 'modal-review')
 */
export function toggleExpand(id, type) {
	const textEl = document.getElementById(`${type}-${id}`);
	const btnEl = document.getElementById(`btn-${type}-${id}`);
	if (!textEl || !btnEl) return;

	const clampClass = type === 'modal-review' ? 'line-clamp-4' : 'line-clamp-3';
	const isCollapsed = textEl.classList.contains(clampClass);

	if (isCollapsed) {
		// Expand
		textEl.classList.remove(clampClass);
		if (type === 'modal-review') {
			textEl.classList.add('max-h-80', 'overflow-y-auto', 'custom-scrollbar', 'pr-2');
		}
		btnEl.innerText = 'Show Less';
	} else {
		// Collapse
		textEl.classList.add(clampClass);
		if (type === 'modal-review') {
			textEl.classList.remove('max-h-80', 'overflow-y-auto', 'custom-scrollbar', 'pr-2');
			textEl.scrollTop = 0;
		}
		btnEl.innerText = 'Read More';
	}
}
