/**
 * @fileoverview Main helper functions for UpNext.
 * Contains modal operations, wizard helpers, form field management, and detail view rendering.
 * @module main_helpers
 */

import { state, isFieldVisible } from './state.js';
import {
	STEP_TITLES, LINK_SUGGESTIONS, TYPE_COLOR_MAP, STATUS_TYPES,
	STATUS_ICON_MAP, STATUS_COLOR_MAP, ICON_MAP,
	RATING_LABELS, RATING_COLORS, TEXT_COLORS, STAR_FILLS, FEATURE_GROUPS
} from './constants.js';
import {
	safeCreateIcons, safeVal, safeText, safeHtml, safeCheck, checkOverflow,
	hslToHex, getRandomPastelHex
} from './dom_utils.js';
import {
	initWizard, validateStep, animateStepChange, getNextValidStep, getPrevValidStep
} from './wizard_logic.js';
import { initEditMode, populateFormFromItem } from './edit_mode.js';
import { loadItemEvents } from './events_carousel.js';
import { saveTag } from './api_service.js';

// =============================================================================
// MODAL OPERATIONS
// =============================================================================

/**
 * Opens the entry modal for creating or editing an item.
 * @param {string|null} id - Item ID for editing, null for new entry
 */
export function openModal(id = null) {
	if (window.closeExportModal) window.closeExportModal();
	if (window.closeInfoModal) window.closeInfoModal();
	if (window.closeStatsModal) window.closeStatsModal();

	try {
		const modal = document.getElementById('modal');
		const form = document.getElementById('entryForm');

		modal.classList.remove('hidden');
		setTimeout(() => {
			modal.classList.remove('opacity-0');
			document.getElementById('modalContent').classList.remove('scale-95');
		}, 10);

		if (form) form.reset();
		resetFormState();
		state.isDirty = false;

		if (id) {
			populateFormFromItem(id);
		}

		renderAltTitles();
		renderChildren();
		updateModalTags();

		if (id) {
			initEditMode(id);
			updateTotalsUIForType(); // Ensure stats UI is configured for this item's type
		} else {
			initWizard(false);
		}
	} catch (e) {
		console.error('Error opening modal:', e);
		initWizard(false);
	}
}

/**
 * Closes the entry modal with animation.
 * Confirms if there are unsaved changes.
 */
/**
 * Closes the entry modal with animation.
 * Confirms if there are unsaved changes.
 */
export function closeModal() {
	if (state.isDirty) {
		showConfirmationModal(
			'Unsaved Changes',
			'You have unsaved changes. Are you sure you want to close this form? Your changes will be lost.',
			() => {
				state.isDirty = false;
				forceCloseModal();
			},
			'warning',
			null,
			'Discard Changes'
		);
		return;
	}
	forceCloseModal();
}

/**
 * Internal helper to force close the modal without checks.
 */
function forceCloseModal() {
	const modal = document.getElementById('modal');
	modal.classList.add('opacity-0');
	document.getElementById('modalContent').classList.add('scale-95');
	setTimeout(() => modal.classList.add('hidden'), 200);
}

/**
 * Shows the custom confirmation modal.
 * @param {string} title - Modal title
 * @param {string} message - Modal message (can be longer)
 * @param {Function} onConfirm - Callback function to execute on confirm
 * @param {string} type - 'warning' (formatted as delete/destructive) or 'info' (default)
 * @param {Function} [onCancel] - Optional callback for cancellation
 * @param {string} [confirmText] - Optional text for confirm button
 */
export function showConfirmationModal(title, message, onConfirm, type = 'info', onCancel = null, confirmText = 'Confirm') {
	const modal = document.getElementById('confirmationModal');
	if (!modal) {
		if (confirm(`${title}\n\n${message}`)) {
			onConfirm();
		} else {
			if (onCancel) onCancel();
		}
		return;
	}

	// Set Content
	document.getElementById('confirmTitle').textContent = title;
	document.getElementById('confirmMessage').textContent = message;
	document.getElementById('btnConfirmAction').textContent = confirmText;

	// Type Styling
	const iconContainer = document.getElementById('confirmIconContainer');
	const confirmBtn = document.getElementById('btnConfirmAction');
	const cancelBtn = document.getElementById('btnCancelAction'); // Ensure we target the cancel button
	const icon = document.getElementById('confirmIcon');

	// Reset Classes
	iconContainer.className = 'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors';
	confirmBtn.className = 'flex-1 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all text-white';

	if (type === 'warning' || type === 'danger') {
		// Red Theme
		iconContainer.classList.add('bg-red-100', 'dark:bg-red-900/20', 'text-red-600', 'dark:text-red-500');
		confirmBtn.classList.add('bg-red-500', 'hover:bg-red-600');
		icon.setAttribute('data-lucide', 'trash-2');
	} else {
		// Default/Brand Theme
		iconContainer.classList.add('bg-zinc-100', 'dark:bg-zinc-800', 'text-zinc-900', 'dark:text-white');
		confirmBtn.classList.add('bg-zinc-900', 'hover:bg-zinc-800', 'dark:bg-white', 'dark:text-black', 'dark:hover:bg-zinc-200');
		icon.setAttribute('data-lucide', 'check-circle-2');
	}

	// Set Callbacks
	confirmBtn.onclick = () => {
		onConfirm();
		closeConfirmationModal();
	};

	const handleCancel = () => {
		if (onCancel) onCancel();
		closeConfirmationModal();
	};

	if (cancelBtn) cancelBtn.onclick = handleCancel;

	// Handle overlay click cancellation
	modal.onclick = (e) => {
		if (e.target === modal) {
			handleCancel();
		}
	};

	// Show
	modal.classList.remove('hidden');
	if (typeof lucide !== 'undefined' && window.lucide && window.lucide.createIcons) {
		window.lucide.createIcons();
	}

	requestAnimationFrame(() => {
		modal.classList.remove('opacity-0');
		const content = modal.querySelector('div');
		if (content) {
			content.classList.remove('scale-95');
			content.classList.add('scale-100');
		}
	});
}

/**
 * Closes the confirmation modal.
 */
export function closeConfirmationModal() {
	const modal = document.getElementById('confirmationModal');
	if (!modal) return;

	modal.classList.add('opacity-0');
	const content = modal.querySelector('div');
	if (content) {
		content.classList.remove('scale-100');
		content.classList.add('scale-95');
	}

	setTimeout(() => {
		modal.classList.add('hidden');
	}, 200);
}

/**
 * Updates the visual state of the rating slider and label.
 * @param {number|string} val - Rating value (1-4)
 */
export function updateRatingVisuals(val) {
	const rVal = parseInt(val, 10);
	const rLabel = document.getElementById('ratingLabel');
	const ratingInput = document.getElementById('rating');

	const ACCENT_CLASS_MAP = {
		1: 'accent-red-500',
		2: 'accent-amber-500',
		3: 'accent-blue-500',
		4: 'accent-emerald-500'
	};

	if (ratingInput) {
		ratingInput.classList.remove('accent-red-500', 'accent-amber-500', 'accent-blue-500', 'accent-emerald-500');
		ratingInput.classList.add(ACCENT_CLASS_MAP[rVal] || 'accent-amber-500');
	}

	if (rLabel) {
		rLabel.innerText = RATING_LABELS[rVal] || RATING_LABELS[2];
		rLabel.className = `text-4xl font-black uppercase tracking-tighter drop-shadow-2xl transition-all transform hover:scale-105 ${TEXT_COLORS[rVal] || TEXT_COLORS[2]}`;
	}
}

/**
 * Resets all form-related state to defaults.
 */
function resetFormState() {
	state.currentAuthors = [];
	state.currentAlternateTitles = [];
	state.currentChildren = [];
	state.currentLinks = [];

	safeVal('itemId', '');
	safeText('currentCoverName', '');
	safeHtml('linksContainer', '');
	safeHtml('childrenContainer', '');
	safeCheck('isHidden', false);
	safeCheck('disableAbbr', true);
	toggleAbbrField(true);
	safeHtml('abbrTagsContainer', '<input id="abbrInput" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Auto-filled from title...">');
	setTimeout(() => {
		const abbrInput = document.getElementById('abbrInput');
		if (abbrInput) abbrInput.addEventListener('keydown', (e) => checkEnterKey(e, 'abbr'));
	}, 0);

	const img = document.getElementById('previewImg');
	const ph = document.getElementById('previewPlaceholder');
	if (img) { img.src = ''; img.classList.add('hidden'); }
	if (ph) ph.classList.remove('hidden');

	// Reset Image Editor State
	if (window.imageEditor && window.imageEditor.resetEditorState) {
		window.imageEditor.resetEditorState();
	}
}


// =============================================================================
// EDIT MODE
// =============================================================================



// =============================================================================
// WIZARD NAVIGATION
// =============================================================================

/** 
 * Advances to the next valid wizard step.
 * If on Step 4 (Image Cover), it implicitly waits for the Image Editor to save the crop.
 */
export async function nextStep() {
	if (!validateStep(state.currentStep)) return;

	// Step 4 Special Logic: If Image Editor is visible, save crop before proceeding
	if (state.currentStep === 4) {
		const editorArea = document.getElementById('imageEditorArea');
		if (editorArea && !editorArea.classList.contains('hidden')) {
			try {
				if (window.imageEditor && window.imageEditor.saveCropPromise) {
					await window.imageEditor.saveCropPromise();
				}
			} catch (e) {
				console.error("Crop save failed", e);
				return; // Stop navigation on failure
			}
		}
	}

	const next = getNextValidStep(state.currentStep);
	if (next > state.TOTAL_STEPS) return;
	animateStepChange(state.currentStep, next, 'right');
	state.currentStep = next;
}

/**
 * Returns to the previous valid wizard step.
 */
export function prevStep() {
	const prev = getPrevValidStep(state.currentStep);
	if (prev < 1) return;
	animateStepChange(state.currentStep, prev, 'left');
	state.currentStep = prev;
}

/**
 * Jumps to a specific wizard step.
 * @param {number} step - Target step number
 */
export function jumpToStep(step) {
	if (step === state.currentStep || step > state.maxReachedStep) return;

	// Only validate if moving forward
	if (step > state.currentStep && !validateStep(state.currentStep)) return;

	const direction = step > state.currentStep ? 'right' : 'left';
	animateStepChange(state.currentStep, step, direction);
	state.currentStep = step;
}


// =============================================================================
// TYPE & STATUS SELECTION
// =============================================================================


// =============================================================================
// AUTOCOMPLETE & TAGS
// =============================================================================

/**
 * Populates autocomplete datalists from existing items.
 */
export function populateAutocomplete() {
	const authors = new Set();
	const universes = new Set();
	const seriesList = new Set();
	const tags = new Set();

	state.items.forEach(item => {
		if (Array.isArray(item.authors)) item.authors.forEach(a => authors.add(a));
		if (Array.isArray(item.tags)) item.tags.forEach(t => tags.add(t));
		if (item.universe) universes.add(item.universe);
		if (item.series) seriesList.add(item.series);
	});

	const fill = (id, set) => {
		const el = document.getElementById(id);
		if (el) el.innerHTML = Array.from(set).sort().map(v => `<option value="${v}">`).join('');
	};

	fill('authorOptions', authors);
	fill('tagOptions', tags);
	fill('universeOptions', universes);
	fill('seriesOptions', seriesList);
}

/**
 * Updates the author tags display in the modal.
 */
export function updateModalTags() {
	const container = document.getElementById('authorTagsContainer');
	const input = document.getElementById('authorInput');

	Array.from(container.children).forEach(c => {
		if (c.tagName === 'SPAN') c.remove();
	});

	state.currentAuthors.forEach(auth => {
		const tag = document.createElement('span');
		tag.className = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs px-2 py-1 rounded flex items-center gap-1 font-medium';
		const safeAuth = auth.replace(/'/g, "\\'");
		tag.innerHTML = `${auth} <button type="button" onclick="window.removeAuthor('${safeAuth}')" class="hover:text-red-400 flex items-center"><i data-lucide="x" class="w-3 h-3"></i></button>`;
		container.insertBefore(tag, input);
	});
}

/**
 * Removes an author from the current list.
 * @param {string} val - Author to remove
 */
export function removeAuthor(val) {
	state.currentAuthors = state.currentAuthors.filter(a => a !== val);
	updateModalTags();
}




/**
 * Handles tag input for autocomplete.
 */
/**
 * Handles tag input for the autocomplete dropdown.
 * @param {Event} e - Input event
 */
function handleTagInput(e) {
	const val = e.target.value.trim().toLowerCase();
	const dropdown = document.getElementById('tagAutocompleteDropdown');
	if (!dropdown) return;

	if (!val) {
		dropdown.classList.add('hidden');
		return;
	}

	const matches = Object.values(state.allTags || {})
		.filter(t => t.name.toLowerCase().includes(val) && !state.currentTags.includes(t.name));

	if (matches.length === 0) {
		dropdown.classList.add('hidden');
		return;
	}

	dropdown.innerHTML = '';
	matches.forEach(match => {
		const item = document.createElement('div');
		item.className = 'px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200 transition-colors';
		item.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ring-1 ring-black/10 flex-shrink-0" style="background-color: ${match.color}"></span> <span class="font-bold flex-shrink-0">${match.name}</span>${match.description ? `<span class="text-xs text-zinc-400 dark:text-zinc-500 ml-auto italic truncate">${match.description}</span>` : ''}`;
		item.onclick = () => {
			if (!state.currentTags.includes(match.name)) {
				state.currentTags.push(match.name);
				renderGenericTags();
				document.getElementById('tagInput').value = '';
				dropdown.classList.add('hidden');
			}
		};
		dropdown.appendChild(item);
	});
	dropdown.classList.remove('hidden');
}

/**
 * Renders generic tags with persistent colors.
 */
export function renderGenericTags() {
	const container = document.getElementById('tagTagsContainer');
	const input = document.getElementById('tagInput');
	if (!container) return; // Might be hidden/not rendered

	// Autocomplete setup
	let dropdown = document.getElementById('tagAutocompleteDropdown');
	if (!dropdown) {
		dropdown = document.createElement('div');
		dropdown.id = 'tagAutocompleteDropdown';
		dropdown.className = 'absolute z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto hidden w-full left-0 top-full mt-1 custom-scrollbar';
		container.style.position = 'relative';
		container.appendChild(dropdown);

		input.addEventListener('input', handleTagInput);
		input.addEventListener('focus', handleTagInput);

		// Close on click outside
		document.addEventListener('click', (e) => {
			if (!container.contains(e.target)) dropdown.classList.add('hidden');
		});
	}

	Array.from(container.children).forEach(c => {
		if (c.tagName === 'SPAN') c.remove();
	});

	state.currentTags.forEach(tag => {
		const tagEl = document.createElement('span');
		tagEl.className = 'text-zinc-800 dark:text-zinc-900 text-xs px-2 py-1 rounded flex items-center gap-1 font-bold shadow-sm border border-black/5 transition-transform hover:scale-105';

		const tagData = state.allTags[tag];
		if (tagData && tagData.color) {
			tagEl.style.backgroundColor = tagData.color;
		} else {
			tagEl.classList.add('bg-zinc-200', 'dark:bg-zinc-700');
		}

		const safeTag = tag.replace(/'/g, "\\'");
		tagEl.innerHTML = `${tag} <button type="button" onclick="window.removeTag('${safeTag}')" class="hover:text-red-700 flex items-center opacity-50 hover:opacity-100 transition-opacity"><i data-lucide="x" class="w-3 h-3"></i></button>`;
		container.insertBefore(tagEl, input);
	});

	if (window.lucide) window.lucide.createIcons();
}

/**
 * Removes a generic tag.
 * @param {string} val 
 */
export function removeTag(val) {
	state.currentTags = state.currentTags.filter(t => t !== val);
	renderGenericTags();
}

/**
 * Handles Enter key for tag inputs.
 * @param {KeyboardEvent} e - Keyboard event
 * @param {'author'|'altTitle'} type - Input type
 */
export function checkEnterKey(e, type) {
	if (e.key !== 'Enter') return;

	e.preventDefault();
	const val = e.target.value.trim();
	if (!val) return;

	// Handle different tag types
	switch (type) {
		case 'author':
			if (!state.currentAuthors.includes(val)) {
				state.currentAuthors.push(val);
				e.target.value = '';
				updateModalTags();
			}
			break;
		case 'altTitle':
			if (!state.currentAlternateTitles.includes(val)) {
				state.currentAlternateTitles.push(val);
				e.target.value = '';
				renderAltTitles();
			}
			break;
		case 'abbr':
			const abbrVal = val.toUpperCase();
			if (!state.currentAbbreviations.includes(abbrVal)) {
				state.currentAbbreviations.push(abbrVal);
				e.target.value = '';
				renderAbbrTags();
			}
			break;
		case 'tag':
			if (!state.currentTags.includes(val)) {
				state.currentTags.push(val);

				// Handle persistence
				if (!state.allTags[val]) {
					const newColor = getRandomPastelHex();
					state.allTags[val] = { name: val, color: newColor, description: '' };
					saveTag(val, newColor);
				}

				e.target.value = '';
				renderGenericTags();
			}
			break;
	}
}

/**
 * Renders alternate titles as tags.
 */
export function renderAltTitles() {
	const container = document.getElementById('altTitleTagsContainer');
	const input = document.getElementById('altTitleInput');
	if (!container) return;

	Array.from(container.children).forEach(child => {
		if (child.tagName === 'SPAN') child.remove();
	});

	state.currentAlternateTitles.forEach(title => {
		const tag = document.createElement('span');
		tag.className = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs px-2 py-1 rounded flex items-center gap-1 font-medium group';
		const safeTitle = title.replace(/'/g, "\\'");
		tag.innerHTML = `<span onclick="window.swapTitle('${safeTitle}')" class="cursor-pointer hover:text-indigo-500 hover:underline transition-colors" title="Click to swap with Main Title">${title}</span> <button type="button" onclick="window.removeAltTitle('${safeTitle}')" class="hover:text-red-400 flex items-center"><i data-lucide="x" class="w-3 h-3"></i></button>`;
		container.insertBefore(tag, input);
	});

	input.placeholder = state.currentAlternateTitles.length > 0 ? '' : 'Type & Enter...';
}

/**
 * Removes an alternate title.
 * @param {string} val - Title to remove
 */
export function removeAltTitle(val) {
	state.currentAlternateTitles = state.currentAlternateTitles.filter(t => t !== val);
	renderAltTitles();
}

/**
 * Swaps an alternate title with the main title.
 * @param {string} altTitle - The alternate title to swap in
 */
window.swapTitle = function (altTitle) {
	const titleInput = document.getElementById('title');
	const oldTitle = titleInput.value.trim();

	// 1. Set new title
	titleInput.value = altTitle;

	// 2. Update Alternate Titles List
	// Remove the one we just swapped in
	state.currentAlternateTitles = state.currentAlternateTitles.filter(t => t !== altTitle);

	// Add the old title if it exists
	if (oldTitle && !state.currentAlternateTitles.includes(oldTitle)) {
		state.currentAlternateTitles.push(oldTitle);
	}

	// 3. Re-render
	renderAltTitles();

	// 4. Trigger Duplicate Check since title changed
	if (window.triggerDuplicateCheck) {
		window.triggerDuplicateCheck();
	}
};

// =============================================================================
// REREAD COUNT HELPERS
// =============================================================================

/**
 * Increments the reread count input by 1.
 */
export function incrementRereadCount() {
	const input = document.getElementById('rereadCount');
	if (input) input.value = parseInt(input.value || 0) + 1;
}

/**
 * Decrements the reread count input by 1 (minimum 0).
 */
export function decrementRereadCount() {
	const input = document.getElementById('rereadCount');
	if (input) {
		const val = parseInt(input.value || 0);
		input.value = Math.max(0, val - 1);
	}
}

// =============================================================================
// CHILDREN / SEASONS
// =============================================================================

/**
 * Renders the children (seasons/volumes) list to the DOM.
 * Includes episode count and duration for Anime/Series, or chapters and word count for Books/Manga.
 */
export function renderChildren() {
	const container = document.getElementById('childrenContainer');
	if (!container) return;

	const type = document.getElementById('type')?.value || '';
	const isBookType = ['Book', 'Manga'].includes(type);
	const techStatsEnabled = isFieldVisible('technical_stats');

	if (state.currentChildren.length === 0) {
		container.innerHTML = '<div class="text-center text-zinc-400 dark:text-zinc-600 italic text-xs py-3">No items added yet</div>';
		return;
	}

	container.innerHTML = state.currentChildren.map((child, idx) => {
		const starsHtml = [1, 2, 3, 4].map(i => {
			const fillClass = child.rating >= i ? STAR_FILLS[child.rating] : 'text-zinc-300 dark:text-zinc-700';
			return `<button type="button" onclick="window.updateChildRating(${idx}, ${i})" class="focus:outline-none star-btn transition-transform"><i data-lucide="star" class="w-3.5 h-3.5 ${fillClass} fill-current"></i></button>`;
		}).join('');

		const hasDetails = child.hasDetails === true; // Default false if not set
		const detailsDisabledClass = hasDetails ? '' : 'opacity-40 pointer-events-none';

		// Metadata row - different fields based on type (only shown if tech stats enabled)
		let metaHtml = '';
		if (techStatsEnabled) {
			if (isBookType) {
				metaHtml = `
				<div class="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 ${detailsDisabledClass}">
					<div class="flex items-center gap-1">
						<span class="text-[10px] text-zinc-400 font-medium uppercase">Ch</span>
						<button type="button" onclick="window.decrementChildField(${idx}, 'chapters')" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">−</button>
						<input type="number" value="${(child.chapters !== undefined && child.chapters !== null) ? child.chapters : ''}" min="0" 
							oninput="window.updateChild(${idx}, 'chapters', parseInt(this.value) || null)"
							placeholder="0"
							class="w-12 bg-zinc-100 dark:bg-zinc-800 border-none rounded px-1 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500 text-center font-bold">
						<button type="button" onclick="window.incrementChildField(${idx}, 'chapters')" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">+</button>
					</div>
					<div class="flex items-center gap-1">
						<span class="text-[10px] text-zinc-400 font-medium uppercase">Words</span>
						<button type="button" onclick="window.decrementChildField(${idx}, 'avgWords', 100)" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">−</button>
						<input type="number" value="${(child.avgWords !== undefined && child.avgWords !== null) ? child.avgWords : ''}" min="0" step="100"
							oninput="window.updateChild(${idx}, 'avgWords', parseInt(this.value) || null)"
							placeholder="2k"
							class="w-14 bg-zinc-100 dark:bg-zinc-800 border-none rounded px-1 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500 text-center font-bold">
						<button type="button" onclick="window.incrementChildField(${idx}, 'avgWords', 100)" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">+</button>
					</div>
				</div>
			`;
			} else {
				metaHtml = `
				<div class="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 ${detailsDisabledClass}">
					<div class="flex items-center gap-1">
						<span class="text-[10px] text-zinc-400 font-medium uppercase">Ep</span>
						<button type="button" onclick="window.decrementChildField(${idx}, 'episodes')" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">−</button>
						<input type="number" value="${(child.episodes !== undefined && child.episodes !== null) ? child.episodes : ''}" min="0"
							oninput="window.updateChild(${idx}, 'episodes', parseInt(this.value) || null)"
							placeholder="12"
							class="w-12 bg-zinc-100 dark:bg-zinc-800 border-none rounded px-1 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500 text-center font-bold">
						<button type="button" onclick="window.incrementChildField(${idx}, 'episodes')" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">+</button>
					</div>
					<div class="flex items-center gap-1">
						<span class="text-[10px] text-zinc-400 font-medium uppercase">Min</span>
						<button type="button" onclick="window.decrementChildField(${idx}, 'duration')" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">−</button>
						<input type="number" value="${(child.duration !== undefined && child.duration !== null) ? child.duration : ''}" min="0"
							oninput="window.updateChild(${idx}, 'duration', parseInt(this.value) || null)"
							placeholder="20"
							class="w-12 bg-zinc-100 dark:bg-zinc-800 border-none rounded px-1 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500 text-center font-bold">
						<button type="button" onclick="window.incrementChildField(${idx}, 'duration')" class="w-5 h-5 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded text-zinc-600 dark:text-zinc-300 text-xs font-bold transition-colors">+</button>
					</div>
				</div>
			`;
			}
		}

		// Details toggle - only show if technical_stats is enabled
		const detailsToggle = techStatsEnabled ? `
			<label class="flex items-center gap-1 cursor-pointer group" title="Toggle details">
				<input type="checkbox" ${hasDetails ? 'checked' : ''} 
					onchange="window.toggleChildDetails(${idx}, this.checked)"
					class="w-3.5 h-3.5 rounded border-zinc-300 text-indigo-500 focus:ring-indigo-500">
				<i data-lucide="settings-2" class="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"></i>
			</label>
		` : '';

		return `
            <div class="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
				<div class="flex items-center gap-3">
					<input value="${child.title}" oninput="window.updateChild(${idx}, 'title', this.value)" 
						class="bg-transparent border-b border-zinc-300 dark:border-zinc-700 outline-none text-sm pb-1 text-zinc-700 dark:text-zinc-200 flex-1 font-bold placeholder-zinc-400">
					<div class="flex gap-0.5">${starsHtml}</div>
					${detailsToggle}
					<button type="button" onclick="window.removeChildIdx(${idx})" class="text-zinc-400 hover:text-red-400 transition-colors p-1"><i data-lucide="x" class="w-4 h-4"></i></button>
				</div>
				${hasDetails && techStatsEnabled ? metaHtml : ''}
            </div>
        `;
	}).join('');

	safeCreateIcons();
	updateChildrenTotals();
}

/**
 * Adds a new child item (Season or Volume) to the list.
 * Determines title based on media type and pre-fills default values.
 */
export function addChild() {
	const type = document.getElementById('type').value;
	const isBookType = ['Book', 'Manga'].includes(type);
	const prefix = isBookType ? 'Volume' : 'Season';
	const next = state.currentChildren.length + 1;

	const childData = {
		id: crypto.randomUUID(),
		title: `${prefix} ${next}`,
		rating: 0,
		hasDetails: false // Disabled by default
	};

	// Set default values based on type (will be used when hasDetails is enabled)
	if (isBookType) {
		childData.chapters = null;
		childData.avgWords = 2000;
	} else {
		childData.episodes = 12;
		childData.duration = 20;
	}

	state.currentChildren.push(childData);
	renderChildren();
}

/**
 * Removes a child item at the specified index and re-renders the list.
 * @param {number} idx - Index of the child to remove.
 */
export function removeChildIdx(idx) { state.currentChildren.splice(idx, 1); renderChildren(); }

/**
 * Updates a specific field of a child item.
 * @param {number} idx - Index of the child.
 * @param {string} field - Field to update (e.g., 'title', 'episodes', 'duration').
 * @param {string|number} val - New value.
 */
export function updateChild(idx, field, val) {
	state.currentChildren[idx][field] = val;
	// Recalculate totals if a numeric field was updated
	if (['episodes', 'duration', 'chapters', 'avgWords'].includes(field)) {
		updateChildrenTotals();
	}
}

/**
 * Updates the rating of a child item and re-renders to show the new stars.
 * @param {number} idx - Index of the child.
 * @param {number} rating - New rating value (1-4).
 */
export function updateChildRating(idx, rating) {
	const current = state.currentChildren[idx].rating;
	// Toggle: If clicking the same rating, set to 0 (Unrated)
	state.currentChildren[idx].rating = (current === rating) ? 0 : rating;
	renderChildren();
}

/**
 * Toggles the hasDetails flag on a child item to show/hide metadata fields.
 * @param {number} idx - Index of the child.
 * @param {boolean} enabled - Whether details should be shown.
 */
export function toggleChildDetails(idx, enabled) {
	const child = state.currentChildren[idx];
	child.hasDetails = enabled;

	// Initialize default values when enabling details for the first time
	if (enabled) {
		const type = document.getElementById('type')?.value || '';
		const isBookType = ['Book', 'Manga'].includes(type);

		if (isBookType) {
			if (child.chapters === undefined || child.chapters === null) child.chapters = 0;
			if (child.avgWords === undefined || child.avgWords === null) child.avgWords = 2000;
		} else {
			if (child.episodes === undefined || child.episodes === null) child.episodes = 12;
			if (child.duration === undefined || child.duration === null) child.duration = 20;
		}
	}

	renderChildren();
}

/**
 * Increments a numeric field on a child item.
 * @param {number} idx - Index of the child.
 * @param {string} field - Field name (e.g., 'episodes', 'chapters').
 * @param {number} [step=1] - Amount to increment by.
 */
export function incrementChildField(idx, field, step = 1) {
	const current = state.currentChildren[idx][field] || 0;
	state.currentChildren[idx][field] = current + step;
	renderChildren();
}

/**
 * Decrements a numeric field on a child item (minimum 0).
 * @param {number} idx - Index of the child.
 * @param {string} field - Field name (e.g., 'episodes', 'chapters').
 * @param {number} [step=1] - Amount to decrement by.
 */
export function decrementChildField(idx, field, step = 1) {
	const current = state.currentChildren[idx][field] || 0;
	state.currentChildren[idx][field] = Math.max(0, current - step);
	renderChildren();
}

/**
 * Calculates totals from children and updates the totals inputs.
 * Called after any children change.
 */
export function updateChildrenTotals() {
	const type = document.getElementById('type')?.value || '';
	const overrideCheckbox = document.getElementById('overrideTotals');
	const isManual = overrideCheckbox?.checked;

	const children = state.currentChildren.filter(c => c.hasDetails);
	let totalEpisodes = 0, totalDuration = 0, totalChapters = 0, totalWords = 0;

	if (type === 'Book') {
		totalChapters = children.reduce((sum, c) => sum + (c.chapters || 0), 0);
		totalWords = children.reduce((sum, c) => sum + ((c.chapters || 0) * (c.avgWords || 0)), 0);
	} else if (['Anime', 'Series'].includes(type)) {
		totalEpisodes = children.reduce((sum, c) => sum + (c.episodes || 0), 0);
		totalDuration = children.reduce((sum, c) => sum + ((c.episodes || 0) * (c.duration || 0)), 0);
	}

	const epIn = document.getElementById('episodeCount');
	const durIn = document.getElementById('avgDurationMinutes');
	const chIn = document.getElementById('chapterCount');
	const wIn = document.getElementById('wordCount');
	const vIn = document.getElementById('volumeCount');

	if (!isManual) {
		if (epIn) epIn.value = totalEpisodes || '';
		if (durIn) durIn.value = totalDuration || '';
		if (chIn) chIn.value = totalChapters || '';
		if (wIn) wIn.value = totalWords || '';
		if (vIn) vIn.value = state.currentChildren.length || '';
	}

	const canAutoEdit = state.currentChildren.length <= 1;
	[epIn, durIn, chIn, wIn].forEach(input => {
		if (!input) return;
		if (isManual) {
			input.readOnly = false;
		} else {
			input.readOnly = !canAutoEdit;
			if (canAutoEdit) {
				input.classList.remove('bg-zinc-100', 'dark:bg-zinc-800', 'text-zinc-500', 'dark:text-zinc-400');
				input.classList.add('bg-white', 'dark:bg-zinc-900', 'text-zinc-700', 'dark:text-zinc-200');
			} else {
				input.classList.add('bg-zinc-100', 'dark:bg-zinc-800', 'text-zinc-500', 'dark:text-zinc-400');
				input.classList.remove('bg-white', 'dark:bg-zinc-900', 'text-zinc-700', 'dark:text-zinc-200');
			}
		}
	});
}

/**
 * Synchronizes manually entered totals back to the first season/volume.
 * @param {string} field - Field to sync (episodes, duration, chapters, words)
 * @param {number} value - New value
 */
export function syncTotalsToChild(field, value) {
	const overrideCheckbox = document.getElementById('overrideTotals');
	if (overrideCheckbox?.checked || state.currentChildren.length > 1) return;

	const type = document.getElementById('type').value;
	const isBook = ['Book', 'Manga'].includes(type);
	const prefix = isBook ? 'Volume' : 'Season';

	if (state.currentChildren.length === 0) {
		state.currentChildren.push({
			id: crypto.randomUUID(),
			title: `${prefix} 1`,
			rating: 0,
			hasDetails: true
		});
	}

	const child = state.currentChildren[0];
	child.hasDetails = true;

	if (field === 'episodes') child.episodes = value;
	if (field === 'duration') child.duration = value;
	if (field === 'chapters') child.chapters = value;
	if (field === 'words' && isBook) {
		const chapters = child.chapters || 1;
		child.avgWords = Math.round(value / chapters);
	}

	renderChildren();
}

/**
 * Toggles manual override mode for totals inputs.
 * @param {boolean} enabled - Whether override is enabled
 */
export function toggleTotalsOverride(enabled) {
	const inputs = document.querySelectorAll('#totalsGrid input');
	inputs.forEach(input => {
		input.readOnly = !enabled;
		if (enabled) {
			input.classList.remove('bg-zinc-100', 'dark:bg-zinc-800', 'text-zinc-500', 'dark:text-zinc-400');
			input.classList.add('bg-white', 'dark:bg-zinc-900', 'text-zinc-700', 'dark:text-zinc-200');
		} else {
			input.classList.add('bg-zinc-100', 'dark:bg-zinc-800', 'text-zinc-500', 'dark:text-zinc-400');
			input.classList.remove('bg-white', 'dark:bg-zinc-900', 'text-zinc-700', 'dark:text-zinc-200');
			updateChildrenTotals(); // Recalculate when switching back to auto
		}
	});
}

/**
 * Updates the totals UI based on media type (show anime vs book fields).
 */
export function updateTotalsUIForType() {
	const type = document.getElementById('type')?.value || '';
	const hasChildItems = ['Book', 'Series', 'Anime'].includes(type);
	const techStatsEnabled = isFieldVisible('technical_stats');

	// Field visibility per type:
	// Movie: duration only (editable)
	// Manga: chapters only (editable)
	// Book: chapters + words (auto-calculated if tech stats enabled)
	// Anime/Series: episodes + duration
	const showEpisodes = ['Anime', 'Series'].includes(type);
	const showDuration = ['Anime', 'Series', 'Movie'].includes(type);
	const showChapters = ['Book', 'Manga'].includes(type);
	const showWords = type === 'Book';
	const showPageCount = type === 'Book';

	// Toggle field visibility
	document.querySelectorAll('.series-total').forEach(el => {
		el.classList.toggle('hidden', !showEpisodes);
	});
	document.querySelectorAll('.duration-total').forEach(el => {
		el.classList.toggle('hidden', !showDuration);
	});
	document.querySelectorAll('.reading-total').forEach(el => {
		el.classList.toggle('hidden', !showChapters);
	});
	document.querySelectorAll('.book-only-total').forEach(el => {
		el.classList.toggle('hidden', !showWords);
	});
	document.querySelectorAll('.page-count-total').forEach(el => {
		el.classList.toggle('hidden', !showPageCount);
	});

	// Attach word count auto-calc listener
	const pageInput = document.getElementById('pageCount');
	if (pageInput && !pageInput.dataset.listenerAttached) {
		pageInput.addEventListener('input', () => {
			const overrideCheckbox = document.getElementById('overrideTotals');
			if (overrideCheckbox && overrideCheckbox.checked) return;

			const pages = parseInt(pageInput.value) || 0;
			const wordInput = document.getElementById('wordCount');
			if (wordInput) {
				wordInput.value = pages > 0 ? pages * 250 : '';
			}
		});
		pageInput.dataset.listenerAttached = 'true';
	}

	// For Movie/Manga: editable inputs, no "Calculated Totals" header
	// For others: show totals only if technical_stats is enabled
	const totalsContainer = document.getElementById('childrenTotalsContainer');
	const totalsHeader = totalsContainer?.querySelector('.flex.items-center.justify-between');
	const overrideLabel = document.getElementById('overrideTotals')?.closest('label');

	if (type === 'Movie' || type === 'Manga') {
		// Show container but make it simple - just the input fields
		if (totalsContainer) totalsContainer.style.display = '';
		if (totalsHeader) totalsHeader.style.display = 'none';
		if (overrideLabel) overrideLabel.style.display = 'none';

		// Make inputs editable (remove readonly)
		const inputs = totalsContainer?.querySelectorAll('input[type="number"]');
		inputs?.forEach(input => {
			input.removeAttribute('readonly');
			input.classList.remove('bg-zinc-100', 'dark:bg-zinc-800', 'text-zinc-500', 'dark:text-zinc-400');
			input.classList.add('bg-white', 'dark:bg-zinc-900', 'text-zinc-700', 'dark:text-zinc-200');
			input.placeholder = '';
		});
	} else if (hasChildItems) {
		// For Anime/Series/Book: show totals only if technical_stats is enabled
		if (totalsContainer) totalsContainer.style.display = techStatsEnabled ? '' : 'none';
		if (totalsHeader) totalsHeader.style.display = techStatsEnabled ? '' : 'none';
		if (overrideLabel) overrideLabel.style.display = techStatsEnabled ? '' : 'none';

		// Reset inputs to readonly/auto mode if tech stats enabled
		if (techStatsEnabled) {
			const overrideCheckbox = document.getElementById('overrideTotals');
			if (overrideCheckbox && !overrideCheckbox.checked) {
				const inputs = totalsContainer?.querySelectorAll('input[type="number"]');
				inputs?.forEach(input => {
					input.setAttribute('readonly', 'true');
					input.classList.add('bg-zinc-100', 'dark:bg-zinc-800', 'text-zinc-500', 'dark:text-zinc-400');
					input.classList.remove('bg-white', 'dark:bg-zinc-900', 'text-zinc-700', 'dark:text-zinc-200');
					input.placeholder = 'Auto';
				});
			}
		}
	}

	// Update duration label for Movie (just "Duration" instead of "Total Duration")
	const durationLabel = document.getElementById('durationLabel');
	if (durationLabel) {
		durationLabel.textContent = type === 'Movie' ? 'Duration (min)' : 'Total Duration (min)';
	}

	// Update chapters label for Manga (just "Chapters")
	const chapterLabel = document.querySelector('.reading-total label');
	if (chapterLabel) {
		chapterLabel.textContent = type === 'Manga' ? 'Chapters' : 'Total Chapters';
	}

	// Update volume count label based on type (only for types with children)
	const volumeLabel = document.getElementById('volumeCountLabel');
	if (volumeLabel) {
		if (hasChildItems && techStatsEnabled) {
			volumeLabel.parentElement?.classList.remove('hidden');
			volumeLabel.textContent = type === 'Book' ? 'Total Volumes' : 'Total Seasons';
		} else {
			volumeLabel.parentElement?.classList.add('hidden');
		}
	}

	// Update step header based on type
	const childLabel = document.getElementById('childLabel');
	if (childLabel) {
		if (type === 'Movie' || type === 'Manga') {
			childLabel.textContent = 'Technical Stats';
		} else if (type === 'Book') {
			childLabel.textContent = techStatsEnabled ? 'Volumes & Stats' : 'Volumes';
		} else {
			childLabel.textContent = techStatsEnabled ? 'Seasons & Stats' : 'Seasons';
		}
	}

	// Hide Add button and children wrapper for types without child items
	const addBtn = document.getElementById('addChildBtn');
	const wrapperEl = document.getElementById('childrenWrapper');
	if (addBtn) addBtn.style.display = hasChildItems ? '' : 'none';
	if (wrapperEl) wrapperEl.style.display = hasChildItems ? '' : 'none';
}

// =============================================================================
// EXTERNAL LINKS
// =============================================================================

/**
 * Renders the external links list.
 */
export function renderLinks() {
	const container = document.getElementById('linksContainer');
	if (!container) return;

	if (state.currentLinks.length === 0) {
		container.innerHTML = '<div class="text-center text-zinc-400 dark:text-zinc-600 italic text-xs py-1">No links added</div>';
		return;
	}

	container.innerHTML = state.currentLinks.map((link, idx) => `
        <div class="flex gap-2 items-center slide-in-bottom">
            <div class="w-1/3 relative">
                <input list="linkNameOptions" value="${link.label}" onchange="window.updateLink(${idx}, 'label', this.value)" placeholder="Label" class="w-full bg-zinc-50 dark:bg-zinc-800 text-xs p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 outline-none focus:border-indigo-500">
            </div>
            <input value="${link.url}" oninput="window.updateLink(${idx}, 'url', this.value)" placeholder="URL" class="flex-1 bg-zinc-50 dark:bg-zinc-800 text-xs p-2 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 outline-none focus:border-indigo-500">
            <button type="button" onclick="window.pasteLink(${idx})" title="Paste from clipboard" class="px-2 py-1 text-xs rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700">Paste</button>
            <button type="button" onclick="window.removeLink(${idx})" class="text-zinc-400 hover:text-red-400"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
    `).join('');

	safeCreateIcons();
}

/** Adds a new empty external link object to the list and re-renders. */
export function addLink() { state.currentLinks.push({ label: '', url: '' }); renderLinks(); }

/**
 * Adds a specific external link with a pre-defined label.
 * @param {string} label - The label for the link (e.g., "Wikipedia").
 */
export function addSpecificLink(label) { state.currentLinks.push({ label, url: '' }); renderLinks(); }

/**
 * Removes an external link at the specified index.
 * @param {number} idx - Index of the link to remove.
 */
export function removeLink(idx) { state.currentLinks.splice(idx, 1); renderLinks(); }

/**
 * Updates a specific field of an external link.
 * @param {number} idx - Index of the link.
 * @param {string} field - Field to update ('label' or 'url').
 * @param {string} val - New value.
 */
export function updateLink(idx, field, val) { state.currentLinks[idx][field] = val; }

/**
 * Pastes text from the clipboard into the URL field of a specific link.
 * Requires clipboard permission.
 * @param {number} idx - Index of the link to update.
 */
export function pasteLink(idx) {
	if (!navigator.clipboard) return;
	navigator.clipboard.readText().then(text => {
		state.currentLinks[idx].url = text || '';
		renderLinks();
	}).catch(() => { });
}

// =============================================================================
// DETAIL VIEW
// =============================================================================

/**
 * Formats minutes into hours:minutes format (e.g., "2h 30m").
 * @param {number} minutes - Total minutes
 * @returns {string} Formatted time string
 */
function formatDuration(minutes) {
	if (!minutes) return '';
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours === 0) return `${mins}m`;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}

/**
 * Renders a compact stats bar for the detail view based on media type.
 * @param {Object} item - Item to render stats for
 * @returns {string} HTML string for stats bar
 */
function renderTechStatsBar(item) {
	const type = item.type;
	const stats = [];

	if (['Anime', 'Series'].includes(type)) {
		// Order: Seasons → Episodes → Duration (estimated with ~)
		if (item.volumeCount) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="layers" class="w-4 h-4"></i> ${item.volumeCount} seasons</span>`);
		if (item.episodeCount) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="tv" class="w-4 h-4"></i> ${item.episodeCount} episodes</span>`);
		if (item.avgDurationMinutes) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4"></i> ~${formatDuration(item.avgDurationMinutes)}</span>`);
	} else if (type === 'Book') {
		// Order: Volumes → Chapters → Words (estimated with ~)
		if (item.volumeCount) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="layers" class="w-4 h-4"></i> ${item.volumeCount} volumes</span>`);
		if (item.chapterCount) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="bookmark" class="w-4 h-4"></i> ${item.chapterCount} chapters</span>`);
		if (item.wordCount) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="file-text" class="w-4 h-4"></i> ~${item.wordCount.toLocaleString()} words</span>`);
	} else if (type === 'Manga') {
		if (item.chapterCount) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="bookmark" class="w-4 h-4"></i> ${item.chapterCount} chapters</span>`);
	} else if (type === 'Movie') {
		if (item.avgDurationMinutes) stats.push(`<span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4"></i> ${formatDuration(item.avgDurationMinutes)}</span>`);
	}

	if (stats.length === 0) return '';
	return `<div class="flex flex-wrap gap-4 text-sm text-zinc-500 dark:text-zinc-400 mt-3">${stats.join('')}</div>`;
}

/**
 * Renders the detail view for an item.
 * @param {Object} item - Item to display
 * @param {HTMLElement} content - Container element
 */
export function renderDetailView(item, content) {
	const authors = item.authors || (item.author ? [item.author] : []);
	const authHtml = authors.length
		? authors.map(a => `<span onclick="smartFilter(event, 'author', '${a.replace(/'/g, "\\'")}')" class="hover:text-zinc-800 dark:hover:text-white underline decoration-zinc-400 dark:decoration-zinc-600 underline-offset-2 hover:decoration-zinc-800 dark:hover:decoration-white transition-all cursor-pointer relative z-50">${a}</span>`).join(', ')
		: '<span class="italic text-zinc-400 dark:text-white/40">Unknown</span>';

	const coverUrl = item.coverUrl ? `/images/${item.coverUrl}` : null;
	const seriesText = item.seriesNumber ? `${item.series} #${item.seriesNumber}` : item.series;
	const childLabel = ['Book', 'Manga'].includes(item.type) ? 'Volumes' : 'Seasons';

	const isBookType = ['Book', 'Manga'].includes(item.type);
	const showChildStats = isFieldVisible('technical_stats');
	const childrenHtml = (item.children || []).map(c => {
		let statsText = '';
		if (c.hasDetails && showChildStats) {
			if (isBookType && c.chapters) {
				const totalWords = c.chapters * (c.avgWords || 0);
				statsText = `${c.chapters} ch`;
				if (totalWords) statsText += ` • ~${totalWords.toLocaleString()} words (~${(c.avgWords || 0).toLocaleString()}/ch)`;
			} else if (!isBookType && c.episodes) {
				const totalDur = c.episodes * (c.duration || 20);
				statsText = `${c.episodes} ep • ~${formatDuration(totalDur)} (~${c.duration || 20}m/ep)`;
			}
		}
		return `
        <div class="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/60 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors group/child w-full">
            <div class="flex flex-col gap-0.5">
                <span class="text-base text-zinc-700 dark:text-zinc-300 font-bold font-heading tracking-wide">${c.title}</span>
                ${statsText ? `<span class="text-xs text-zinc-500 dark:text-zinc-500">${statsText}</span>` : ''}
            </div>
            <div class="flex gap-1">
                ${[1, 2, 3, 4].map(i => `<i data-lucide="star" class="w-5 h-5 ${c.rating >= i ? STAR_FILLS[c.rating] : 'text-zinc-300 dark:text-zinc-800'} fill-current"></i>`).join('')}
            </div>
        </div>
    `;
	}).join('');

	const linksHtml = (item.externalLinks || []).map(l => `
        <a href="${l.url}" target="_blank" class="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 hover:text-white bg-indigo-100 dark:bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-500 dark:hover:bg-indigo-500 transition-all text-sm font-bold">
            <i data-lucide="link" class="w-4 h-4"></i> ${l.label || 'Link'}
        </a>
    `).join('');

	content.innerHTML = `
        <div class="media-${item.type} relative h-full flex flex-col lg:flex-row">
            <div class="relative w-full lg:w-[45%] h-64 lg:h-full shrink-0 bg-zinc-100 dark:bg-zinc-900 overflow-hidden group border-r border-zinc-200 dark:border-zinc-800">
                ${coverUrl ? `<img src="${coverUrl}" loading="lazy" class="w-full h-full object-contain bg-zinc-50 dark:bg-zinc-950/50">` : '<div class="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-700 bg-zinc-100 dark:bg-zinc-900"><i data-lucide="image" class="w-24 h-24 opacity-20"></i></div>'}
                
                <!-- Split Overlay Actions -->
                <div class="absolute inset-0 z-20 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <!-- Top: Edit -->
                    <button onclick="window.editFromDetail('${item.id}')" class="flex-1 w-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-all flex flex-col items-center justify-center gap-2 text-white border-b border-white/10">
                        <i data-lucide="edit-3" class="w-8 h-8 opacity-90"></i>
                        <span class="text-xs font-black uppercase tracking-widest">Edit Entry</span>
                    </button>
                    
                    <!-- Bottom: Delete -->
                    <button onclick="window.deleteFromDetail('${item.id}')" class="flex-1 w-full bg-red-900/60 backdrop-blur-sm hover:bg-red-900/80 transition-all flex flex-col items-center justify-center gap-2 text-white border-t border-white/10">
                        <i data-lucide="trash-2" class="w-8 h-8 opacity-90"></i>
                        <span class="text-xs font-black uppercase tracking-widest">Delete</span>
                    </button>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto custom-scrollbar h-full bg-white dark:bg-[#0c0c0e] relative">
                <div class="p-10 pb-6 border-b border-zinc-100 dark:border-white/5 relative">
                    ${isFieldVisible('external_links') && linksHtml ? `<div class="absolute top-8 right-16 mr-6 flex gap-2 z-20">${linksHtml}</div>` : ''}
                    <div class="flex flex-wrap gap-2 mb-4 mt-12">
                        <span class="media-badge px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors"><i data-lucide="${ICON_MAP[item.type]}" class="w-3.5 h-3.5"></i> ${item.type}</span>
                        <span class="${STATUS_COLOR_MAP[item.status]} px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest border border-current/20 flex items-center gap-1.5"><i data-lucide="${STATUS_ICON_MAP[item.status]}" class="w-3.5 h-3.5"></i> ${item.status}</span>
                        ${isFieldVisible('progress') && item.progress ? `<span class="px-4 py-1.5 rounded text-xs font-black font-mono uppercase tracking-widest border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center gap-1.5">Progress: ${item.progress}</span>` : ''}
                    </div>
                    ${isFieldVisible('tags') && item.tags && item.tags.length ? `
                    <div class="flex flex-wrap gap-1.5 mb-4">
                        ${item.tags.map(tag => {
		const tagData = state.allTags?.[tag] || {};
		const color = tagData.color || '#e4e4e7';
		const desc = (tagData.description || '').replace(/"/g, '&quot;');

		return `
								<span onclick="smartFilter(event, 'tag', '&quot;${tag.replace(/'/g, "\\'").replace(/"/g, '&quot;')}&quot;')" class="relative group px-2.5 py-1 rounded-md text-[11px] font-bold text-zinc-800 shadow-sm border border-black/5 select-none cursor-pointer hover:opacity-80 transition-opacity" style="background-color: ${color}">
                                    ${tag}
                                    ${tagData.description ? `
                                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900/90 backdrop-blur text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 w-max max-w-[200px] text-center shadow-xl translate-y-2 group-hover:translate-y-0 text-balance leading-tight">
                                            ${desc}
                                            <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/90"></div>
                                        </div>
                                    ` : ''}
                                </span>`;
	}).join('')}
                    </div>` : ''}
                    <h1 class="text-5xl md:text-6xl font-heading font-black text-zinc-900 dark:text-[var(--theme-col)] leading-none tracking-tight mb-2 drop-shadow-sm">${item.title}</h1>
                    ${isFieldVisible('alternate_titles') && item.alternateTitles && item.alternateTitles.length ? `<h2 class="text-xl text-zinc-500 dark:text-zinc-400 font-bold mb-4 font-heading">${item.alternateTitles.join(', ')}</h2>` : ''}
                    <div class="flex flex-wrap gap-6 text-base font-medium text-zinc-500 dark:text-zinc-400 mt-4">
                        ${isFieldVisible('authors') && authors.length ? `<div class="flex items-center gap-2"><i data-lucide="pen-tool" class="w-5 h-5 text-zinc-400 dark:text-zinc-600"></i> ${authHtml}</div>` : ''}
                        ${isFieldVisible('series') && item.series ? `<div onclick="smartFilter(event, 'series', '${item.series}')" class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 cursor-pointer transition-colors"><i data-lucide="library" class="w-5 h-5"></i> ${seriesText}</div>` : ''}
                        ${isFieldVisible('universe') && item.universe ? `<div onclick="smartFilter(event, 'universe', '${item.universe}')" class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 cursor-pointer transition-colors"><i data-lucide="globe" class="w-5 h-5"></i> ${item.universe}</div>` : ''}
                        ${isFieldVisible('release_date') && item.releaseDate ? `<div class="flex items-center gap-2 text-zinc-400"><i data-lucide="calendar" class="w-5 h-5"></i> ${new Date(item.releaseDate).toLocaleDateString()}</div>` : ''}
                    </div>
                    ${isFieldVisible('technical_stats') ? renderTechStatsBar(item) : ''}
                </div>
                <div class="p-10 pt-6 space-y-8">
                    
                    ${(item.review || item.rating) && isFieldVisible('review') && !state.appSettings?.disabledFeatures?.includes('stats') ? `
                    <div class="bg-zinc-50 dark:bg-zinc-900/50 border border-[color:var(--theme-col)] rounded-2xl p-6 relative flow-root min-h-[160px]">
                         <h4 class="text-sm font-bold text-[var(--theme-col)] uppercase tracking-widest mb-4 opacity-100 flex items-center gap-2"><i data-lucide="message-square" class="w-4 h-4"></i> Review</h4>
                         ${item.rating ? `
                         <div class="float-right ml-6 mb-2 flex flex-col items-center gap-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-lg">
                            <span class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">VERDICT</span>
                            <span class="text-3xl font-heading font-black uppercase ${TEXT_COLORS[item.rating]}">${RATING_LABELS[item.rating]}</span>
                            <div class="flex gap-1 mt-1">
                                ${[1, 2, 3, 4].map(i => `<i data-lucide="star" class="w-4 h-4 ${item.rating >= i ? STAR_FILLS[item.rating] : 'text-zinc-300 dark:text-zinc-800'} fill-current"></i>`).join('')}
                            </div>
                            ${isFieldVisible('reread_count') && item.rereadCount ? `<span class="text-[10px] text-zinc-500 mt-1">${['Book', 'Manga'].includes(item.type) ? 'Reread' : 'Rewatched'} ${item.rereadCount}x</span>` : ''}
                         </div>` : ''}
                         
                         ${isFieldVisible('completed_at') && item.completedAt ? `<div class="text-sm text-zinc-500 mb-3 flex items-center gap-1.5"><i data-lucide="calendar-check" class="w-4 h-4"></i> Completed ${new Date(item.completedAt).toLocaleDateString()}</div>` : ''}
                         ${item.review ? `
                         <div class="relative z-10 group/rev">
                            <span id="detail-review-${item.id}" class="text-zinc-700 dark:text-zinc-300 leading-relaxed italic text-lg whitespace-pre-wrap font-serif line-clamp-6">${item.review}</span>
                            ${item.review.length > 0 ? `<button type="button" id="btn-detail-review-${item.id}" onclick="event.stopPropagation(); window.toggleExpand('${item.id}', 'detail-review')" class="text-xs text-[var(--theme-col)] font-bold mt-2 hover:underline relative z-20">Read More</button>` : ''}
                         </div>` : ''}
                    </div>` : ''}

                    <!-- EVENTS CAROUSEL -->
                    <div id="detail-events-${item.id}" class="hidden"></div>

                    ${item.description ? `
                    <div class="bg-zinc-50 dark:bg-zinc-900/5 border border-[color:var(--theme-col)] rounded-xl p-6 group/desc">
                        <h4 class="text-sm font-bold text-[var(--theme-col)] uppercase tracking-widest mb-4 opacity-100 flex items-center gap-2"><i data-lucide="align-left" class="w-4 h-4"></i> Synopsis</h4>
                        <div id="detail-desc-${item.id}" class="text-zinc-600 dark:text-zinc-300 leading-relaxed text-lg font-light whitespace-pre-wrap line-clamp-6">${item.description}</div>
                         ${item.description.length > 0 ? `<button type="button" id="btn-detail-desc-${item.id}" onclick="event.stopPropagation(); window.toggleExpand('${item.id}', 'detail-desc')" class="text-xs text-[var(--theme-col)] font-bold mt-2 hover:underline relative z-20">Read More</button>` : ''}
                    </div>` : ''}

                    ${isFieldVisible('notes') && item.notes ? `
                    <div class="bg-zinc-50 dark:bg-zinc-900/5 border border-[color:var(--theme-col)] rounded-xl p-6 group/notes">
                        <h4 class="text-xs font-bold text-[var(--theme-col)] uppercase tracking-widest mb-3 flex items-center gap-2"><i data-lucide="sticky-note" class="w-4 h-4"></i> Notes</h4>
                        <div id="detail-notes-${item.id}" class="text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono text-sm line-clamp-6">${item.notes}</div>
                         ${item.notes.length > 0 ? `<button type="button" id="btn-detail-notes-${item.id}" onclick="event.stopPropagation(); window.toggleExpand('${item.id}', 'detail-notes')" class="text-xs text-[var(--theme-col)] font-bold mt-2 hover:underline relative z-20">Read More</button>` : ''}
                    </div>` : ''}

                    ${isFieldVisible('series_number') && item.children && item.children.length ? `
                    <div class="bg-zinc-50 dark:bg-zinc-900/5 border border-[color:var(--theme-col)] rounded-xl p-6">
                        <h3 class="text-xl font-heading font-bold text-[var(--theme-col)] mb-6 flex items-center gap-3"><i data-lucide="layers" class="w-6 h-6"></i> ${childLabel}</h3>
                        <div class="flex flex-col gap-3">${childrenHtml}</div>
                    </div>` : ''}
                </div>
            </div>
        </div>
    `;

	safeCreateIcons();

	// Check for overflow after render
	setTimeout(() => {
		updateDetailTruncation(item.id);
		if (!state.appSettings?.disabledFeatures?.includes('calendar')) {
			const eventsContainer = document.getElementById(`detail-events-${item.id}`);
			loadItemEvents(item.id, eventsContainer);
		}
	}, 50);
}

/**
 * Updates truncation visibility for a specific item in detail view.
 * @param {string} id - Item ID
 */
export function updateDetailTruncation(id) {
	['detail-review', 'detail-desc', 'detail-notes'].forEach(key => {
		checkOverflow(`${key}-${id}`, `btn-${key}-${id}`);
	});
}

// =============================================================================
// INFO MODAL UTILITIES
// =============================================================================

/**
 * Sets the search input value and triggers a search.
 * Closes the info modal if open.
 * @param {string} query - The search query
 */
window.setSearch = function (query) {
	const input = document.getElementById('searchInput');
	if (!input) return;

	input.value = query;
	input.dispatchEvent(new Event('input'));

	// Smooth scroll to top
	window.scrollTo({ top: 0, behavior: 'smooth' });

	// Close info modal
	closeInfoModal();
};

// Global Shortcut Listener
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		const infoModal = document.getElementById('infoModal');
		const exportModal = document.getElementById('exportModal');

		if (infoModal && !infoModal.classList.contains('hidden')) {
			closeInfoModal();
		}
		if (exportModal && !exportModal.classList.contains('hidden')) {
			closeExportModal();
		}
	}
});

// =============================================================================
// ABBREVIATIONS
// =============================================================================

/**
 * Renders abbreviation tags.
 */
export function renderAbbrTags() {
	const container = document.getElementById('abbrTagsContainer');
	const input = document.getElementById('abbrInput');
	if (!container) return;

	Array.from(container.children).forEach(child => {
		if (child.tagName === 'SPAN') child.remove();
	});

	state.currentAbbreviations.forEach(abbr => {
		const tag = document.createElement('span');
		tag.className = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs px-2 py-1 rounded flex items-center gap-1 font-medium';
		const safeAbbr = abbr.replace(/'/g, "\\'");
		tag.innerHTML = `${abbr} <button type="button" onclick="window.removeAbbreviation('${safeAbbr}')" class="hover:text-red-400 flex items-center"><i data-lucide="x" class="w-3 h-3"></i></button>`;
		container.insertBefore(tag, input);
	});

	// safeCreateIcons(); // Not needed if using innerHTML with i tag, but good practice if using replace
	if (window.lucide) window.lucide.createIcons();
}

/**
 * Removes an abbreviation.
 * @param {string} val - Abbreviation to remove
 */
export function removeAbbreviation(val) {
	state.currentAbbreviations = state.currentAbbreviations.filter(a => a !== val);
	renderAbbrTags();
}

/**
 * Helper function to toggle the abbreviation field disabled state.
 * @param {boolean} checked - Whether the 'disable toggle' is checked.
 */
export function toggleAbbrField(checked) {
	const input = document.getElementById('abbrInput');
	if (checked) {
		state.currentAbbreviations = [];
		renderAbbrTags();
		if (input) {
			input.disabled = true;
			input.placeholder = 'Disabled';
			input.classList.add('opacity-50', 'cursor-not-allowed');
		}
	} else {
		if (input) {
			input.disabled = false;
			input.placeholder = 'Auto-filled from title...';
			input.classList.remove('opacity-50', 'cursor-not-allowed');
		}
		// Trigger auto-fill from current title
		const titleVal = document.getElementById('title').value;
		const abbr = generateAbbreviation(titleVal);
		if (abbr) {
			state.currentAbbreviations = [abbr];
			renderAbbrTags();
		}
	}
}

/**
 * Generates an uppercase abbreviation from a title string.
 * logic: Takes first letter of each word.
 * @param {string} title 
 * @returns {string}
 */
export function generateAbbreviation(title) {
	if (!title) return '';
	// Remove common punctuation to avoid weird abbreviations
	const cleanTitle = title.replace(/['":,.-]/g, '');
	const words = cleanTitle.trim().split(/\s+/);
	if (words.length === 0) return '';
	return words.map(w => w[0]).join('').toUpperCase();
}
