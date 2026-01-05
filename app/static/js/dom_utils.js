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
export function safeCreateIcons(root) {
	if (typeof window.lucide === 'undefined') return;

	try {
		// Use standard Lucide createIcons which handles kebab-case to PascalCase conversion
		// and safeguards against missing icons automatically.
		if (root) {
			window.lucide.createIcons({ root });
		} else {
			window.lucide.createIcons();
		}
	} catch (e) {
		console.warn('Lucide createIcons failed:', e);
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

	const isModal = ['modal-review', 'detail-desc', 'detail-notes', 'detail-review'].includes(type);
	const clampClass = isModal ? 'line-clamp-6' : 'line-clamp-3';
	const isCollapsed = textEl.classList.contains(clampClass);

	if (isCollapsed) {
		// Expand
		textEl.classList.remove(clampClass);
		if (isModal) {
			textEl.classList.add('max-h-96', 'overflow-y-auto', 'custom-scrollbar', 'pr-2');
		}
		btnEl.innerText = 'Show Less';
	} else {
		// Collapse
		textEl.classList.add(clampClass);
		if (isModal) {
			textEl.classList.remove('max-h-96', 'overflow-y-auto', 'custom-scrollbar', 'pr-2');
			textEl.scrollTop = 0;
		}
		btnEl.innerText = 'Read More';
	}
}

// ============================================================================
// PERFORMANCE & LAYOUT
// ============================================================================

/**
 * Debounces a function execution.
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Checks if an element has overflowed its container and toggles a visibility class on a target element.
 * @param {string} contentId - ID of the content element to check for overflow
 * @param {string} targetId - ID of the target element (e.g., button) to toggle
 * @param {string} toggleClass - Class to toggle (default: 'hidden')
 */
export function checkOverflow(contentId, targetId, toggleClass = 'hidden') {
	const content = document.getElementById(contentId);
	const target = document.getElementById(targetId);
	if (!content || !target) return;

	// Use a small buffer (e.g., 4px) to account for sub-pixel rendering differences
	if (content.scrollHeight > content.clientHeight + 4) {
		target.classList.remove(toggleClass);
	} else {
		target.classList.add(toggleClass);
	}
}

/**
 * Converts HSL color values to a Hex string.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color string
 */
export function hslToHex(h, s, l) {
	l /= 100;
	const a = (s * Math.min(l, 1 - l)) / 100;
	const f = (n) => {
		const k = (n + h / 30) % 12;
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generates a random pastel hex color.
 * @returns {string} Hex color string
 */
export function getRandomPastelHex() {
	const hue = Math.floor(Math.random() * 360);
	return hslToHex(hue, 70, 85);
}
