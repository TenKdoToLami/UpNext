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

/**
 * Initializes a custom autocomplete dropdown for an input element.
 * @param {HTMLElement} inputEl - The input element to bind to
 * @param {string} dropdownId - The ID for the dropdown element
 * @param {Function} getItemsListFn - Function that returns an array of string items to filter
 * @param {Function} onSelectCallback - Callback executed with selected item string
 */
export function initCustomAutocomplete(inputEl, dropdownId, getItemsListFn, onSelectCallback) {
	if (!inputEl) return;
	if (inputEl.dataset.autocompleteBound) return; // Prevent duplicate binding ticks
	inputEl.dataset.autocompleteBound = "true";

	const container = inputEl.parentElement;
	if (!container) return;

	// Enforce relative position for absolute dropdown anchoring
	container.style.position = 'relative';

	let dropdown = document.getElementById(dropdownId);
	if (!dropdown) {
		dropdown = document.createElement('div');
		dropdown.id = dropdownId;
		dropdown.className = 'absolute z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-48 overflow-y-auto hidden w-full left-0 top-full mt-1 custom-scrollbar';
		container.appendChild(dropdown);
	}

	let selectedIndex = -1;
	let currentMatches = [];

	function updateDropdownPosition() {
		const rect = container.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;
		const dropdownHeight = 200; // max-h-48 is approx 192px

		if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
			dropdown.classList.remove('top-full', 'mt-1');
			dropdown.classList.add('bottom-full', 'mb-1');
		} else {
			dropdown.classList.remove('bottom-full', 'mb-1');
			dropdown.classList.add('top-full', 'mt-1');
		}
	}

	function handleInput(e) {
		const val = e.target.value.trim().toLowerCase();
		if (!val) { dropdown.classList.add('hidden'); selectedIndex = -1; return; }

		const items = getItemsListFn();
		currentMatches = items.filter(item => item.toLowerCase().includes(val));

		if (currentMatches.length === 0) { dropdown.classList.add('hidden'); selectedIndex = -1; return; }

		dropdown.innerHTML = '';
		selectedIndex = -1; // Reset selection

		currentMatches.forEach((match, index) => {
			const item = document.createElement('div');
			item.className = 'px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm text-zinc-700 dark:text-zinc-200 transition-colors font-medium autocomplete-item';
			item.innerText = match;
			item.onclick = (event) => {
				event.stopPropagation();
				onSelectCallback(match);
				dropdown.classList.add('hidden');
			};
			dropdown.appendChild(item);
		});

		dropdown.classList.remove('hidden');
		updateDropdownPosition();
	}

	function updateSelection() {
		const items = dropdown.querySelectorAll('.autocomplete-item');
		items.forEach((item, index) => {
			if (index === selectedIndex) {
				item.classList.add('bg-zinc-100', 'dark:bg-zinc-800', 'font-black');
				item.scrollIntoView({ block: 'nearest' });
			} else {
				item.classList.remove('bg-zinc-100', 'dark:bg-zinc-800', 'font-black');
			}
		});
	}

	inputEl.addEventListener('input', handleInput);
	inputEl.addEventListener('focus', handleInput);

	inputEl.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			let handled = false;
			if (!dropdown.classList.contains('hidden')) {
				dropdown.classList.add('hidden');
				selectedIndex = -1;
				handled = true;
			}
			if (document.activeElement === inputEl) {
				inputEl.blur();
				handled = true;
			}
			if (handled) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
			}
			return;
		}

		if (dropdown.classList.contains('hidden')) return;

		const items = dropdown.querySelectorAll('.autocomplete-item');
		if (items.length === 0) return;

		if (e.key === 'ArrowDown' || e.key === 'Tab') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % items.length;
			updateSelection();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + items.length) % items.length;
			updateSelection();
		} else if (e.key === 'Enter') {
			if (selectedIndex >= 0) {
				e.preventDefault();
				e.stopImmediatePropagation();
				items[selectedIndex].click();
			}
		}
	}, { capture: true });

	document.addEventListener('click', (e) => {
		if (!container.contains(e.target)) dropdown.classList.add('hidden');
	});
}
