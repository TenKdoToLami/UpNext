/**
 * @fileoverview Main helper functions for UpNext.
 * Contains modal operations, wizard helpers, form field management, and detail view rendering.
 * @module main_helpers
 */

import { state } from './state.js';
import {
	STEP_TITLES, LINK_SUGGESTIONS, TYPE_COLOR_MAP, STATUS_TYPES,
	STATUS_ICON_MAP, STATUS_COLOR_MAP, ICON_MAP,
	RATING_LABELS, RATING_COLORS, TEXT_COLORS, STAR_FILLS
} from './constants.js';
import { safeCreateIcons, safeVal, safeText, safeHtml, safeCheck, checkOverflow } from './dom_utils.js';
import {
	renderTypeSelection, renderStatusSelection, updateWizardUI, updateFormUI,
	showStep, validateStep, updateDynamicLinks, updateDots,
	animateStepChange, getNextValidStep, getPrevValidStep
} from './wizard_logic.js';
import { loadItemEvents } from './events_carousel.js';

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

		if (id) {
			populateFormFromItem(id);
		}

		renderAltTitles();
		renderChildren();
		updateModalTags();

		if (id) {
			initEditMode(id);
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
 */
export function closeModal() {
	const modal = document.getElementById('modal');
	modal.classList.add('opacity-0');
	document.getElementById('modalContent').classList.add('scale-95');
	setTimeout(() => modal.classList.add('hidden'), 200);
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
	// Initialize UI state based on checked default
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
}

/**
 * Populates form fields from an existing item.
 * @param {string} id - Item ID
 */
function populateFormFromItem(id) {
	const item = state.items.find(i => i.id === id);
	if (!item) return;

	safeVal('itemId', item.id);
	safeVal('title', item.title);
	safeVal('type', item.type);
	safeVal('status', item.status);
	safeVal('universe', item.universe || '');
	safeVal('series', item.series || '');
	safeVal('seriesNumber', item.seriesNumber || '');
	safeVal('description', item.description || '');
	safeVal('notes', item.notes || '');
	safeVal('review', item.review || '');
	safeVal('progress', item.progress || '');
	const rVal = item.rating || 2;
	safeVal('rating', rVal);
	// Manually trigger label update
	updateRatingVisuals(rVal);

	if (item.coverUrl) {
		safeText('currentCoverName', item.coverUrl);
		const img = document.getElementById('previewImg');
		const ph = document.getElementById('previewPlaceholder');
		if (img) { img.src = `/images/${item.coverUrl}`; img.classList.remove('hidden'); }
		if (ph) ph.classList.add('hidden');
	}

	safeCheck('isHidden', item.isHidden || false);
	state.currentAuthors = item.authors || (item.author ? [item.author] : []);
	state.currentAlternateTitles = item.alternateTitles || [];
	state.currentChildren = item.children || [];
	state.currentLinks = item.externalLinks || [];
	state.currentAbbreviations = item.abbreviations || [];
	renderAbbrTags();
}

// =============================================================================
// EDIT MODE
// =============================================================================

/**
 * Initializes edit mode for an existing item.
 * @param {string} id - Item ID to edit
 */
export function initEditMode(id) {
	state.isEditMode = true;
	state.currentStep = 1;

	// Enable full screen & Scroll Mode
	document.getElementById('modalContent').classList.add('full-screen-modal');
	document.getElementById('entryForm').classList.add('scroll-mode');
	const sidebar = document.getElementById('editSidebar');
	sidebar.classList.remove('hidden');
	sidebar.classList.add('flex');
	sidebar.scrollTop = 0; // Reset scroll position

	// Hide Wizard specific UI
	document.getElementById('wizardDots').classList.add('hidden');
	document.getElementById('prevBtn').classList.add('hidden');
	document.getElementById('nextBtn').classList.add('hidden');
	document.getElementById('stepIndicator').innerText = '';

	// Ensure form container is ready
	document.getElementById('entryForm').classList.remove('h-full', 'overflow-hidden');
	document.getElementById('entryForm').classList.add('h-auto');

	// Show Save Button
	const submitBtn = document.getElementById('submitBtn');
	submitBtn.classList.remove('hidden');
	submitBtn.innerText = 'Save Changes';



	// Render Form Content
	renderTypeSelection();
	renderStatusSelection();
	renderLinks();
	updateDynamicLinks();

	// Show all steps (CSS handles layout via .scroll-mode)
	document.querySelectorAll('.wizard-step').forEach(el => {
		el.classList.remove('hidden');
		el.style.display = ''; // Clear inline display from wizard mode
	});

	// Titles
	const item = state.items.find(i => i.id === id);
	document.getElementById('modalTitle').innerText = item ? `Edit ${item.title}` : 'Edit Entry';
	document.querySelectorAll('.edit-only-header').forEach(el => el.classList.remove('hidden'));

	updateFormUI();

	// Select visuals
	const type = document.getElementById('type').value;
	const status = document.getElementById('status').value;
	selectTypeVisuals(type);
	selectStatusVisuals(status);

	// Init Scroll Spy
	initScrollSpy();

	// Populate Sidebar (Call last to ensure visibility checks work)
	renderSidebarNav();
}

/**
 * Renders the sidebar navigation for edit mode.
 */
function renderSidebarNav() {
	const nav = document.getElementById('editSidebarNav');
	if (!nav) return;

	// Define sections based on steps
	const sections = [
		{ id: 'step-1', label: 'Media Type', icon: 'monitor' },
		{ id: 'step-2', label: 'Status', icon: 'activity' },
		{ id: 'step-3', label: 'Cover Image', icon: 'image' },
		{ id: 'step-4', label: 'Basic Info', icon: 'file-text' },
		{ id: 'step-5', label: 'Description', icon: 'align-left' },
		{ id: 'step-6', label: 'External Links', icon: 'link' },
		{ id: 'step-7', label: 'Progress', icon: 'bookmark' },
		{ id: 'step-8', label: 'Review & Rating', icon: 'star' },
		{ id: 'step-9', label: 'Notes', icon: 'sticky-note' },
		{ id: 'step-10', label: 'Seasons/Volumes', icon: 'layers' },
		{ id: 'step-11', label: 'Privacy', icon: 'shield' } // Conditionally hidden
	];

	nav.innerHTML = sections.map(sec => `
        <button onclick="scrollToSection('${sec.id}')" id="nav-${sec.id}" class="sidebar-link group">
            <i data-lucide="${sec.icon}" class="w-4 h-4 opacity-70 group-hover:opacity-100"></i> ${sec.label}
        </button>
    `).join('');

	safeCreateIcons();
	updateSidebarVisibility();
}

window.scrollToSection = (id) => {
	const el = document.getElementById(id);
	if (el) {
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });

		// Manually trigger highlight immediately for better responsiveness
		document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
		const navLink = document.getElementById(`nav-${id}`);
		if (navLink) navLink.classList.add('active');
	}
};

window.updateSidebarVisibility = () => {
	// Basic check to hide nav items if the section is hidden
	const nav = document.getElementById('editSidebarNav');
	if (!nav) return;

	Array.from(nav.children).forEach(btn => {
		const sectionId = btn.id.replace('nav-', '');
		const section = document.getElementById(sectionId);
		if (section && (section.classList.contains('hidden') || section.style.display === 'none')) {
			btn.classList.add('hidden');
		} else {
			btn.classList.remove('hidden');
		}
	});
};

function updateSidebarVisibility() {
	window.updateSidebarVisibility();
}

// Simple Scroll Spy
let scrollSpyObserver = null;
function initScrollSpy() {
	if (scrollSpyObserver) scrollSpyObserver.disconnect();

	const options = {
		root: document.getElementById('formScrollWrapper'),
		threshold: 0.2, // Lower threshold to catch taller sections
		rootMargin: "-20% 0px -20% 0px" // Trigger when element is near center
	};

	scrollSpyObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
				const navLink = document.getElementById(`nav-${entry.target.id}`);
				if (navLink) navLink.classList.add('active');
			}
		});
	}, options);

	document.querySelectorAll('.wizard-step').forEach(step => {
		scrollSpyObserver.observe(step);
	});
}

/**
 * Initializes wizard mode for a new entry.
 * @param {boolean} isEdit - Unused, kept for compatibility
 */
export function initWizard(isEdit) {
	state.isEditMode = false;

	// Reset Full Screen & Sidebar
	document.getElementById('modalContent').classList.remove('full-screen-modal');
	document.getElementById('entryForm').classList.remove('scroll-mode');

	const sidebar = document.getElementById('editSidebar');
	sidebar.classList.add('hidden');
	sidebar.classList.remove('flex');
	// Clear sidebar content to prevent stale links
	const nav = document.getElementById('editSidebarNav');
	if (nav) nav.innerHTML = '';

	if (scrollSpyObserver) scrollSpyObserver.disconnect();

	renderTypeSelection();
	renderStatusSelection();

	document.querySelectorAll('.edit-only-header').forEach(el => el.classList.add('hidden'));
	document.getElementById('entryForm').classList.remove('h-auto');
	document.getElementById('entryForm').classList.add('h-full', 'overflow-hidden');

	// Reset wizard step layout
	document.querySelectorAll('.wizard-step').forEach(el => {
		el.classList.add('absolute', 'inset-0', 'hidden');
		el.classList.remove('relative', 'block', 'mb-6', 'w-full', 'max-w-4xl', 'mx-auto', 'flex', 'flex-col');
		// Ensure style display block from edit mode is removed
		el.style.display = 'none';
	});

	restoreStepClasses();

	document.getElementById('wizardDots').classList.remove('hidden');
	document.getElementById('prevBtn').classList.add('hidden');
	document.getElementById('nextBtn').classList.remove('hidden');
	document.getElementById('submitBtn').classList.add('hidden');
	document.getElementById('submitBtn').innerText = 'Finish';
	document.getElementById('modalTitle').innerText = 'New Entry';

	renderChildren();
	state.currentStep = 1;
	state.maxReachedStep = 1;
	showStep(1);
}

/**
 * Restores CSS classes for each wizard step.
 */
function restoreStepClasses() {
	const restore = (id, classes) => {
		const el = document.getElementById(id);
		if (el) el.classList.add(...classes);
	};

	const centerClasses = ['flex', 'flex-col', 'items-center', 'justify-center', 'text-center', 'overflow-y-auto', 'custom-scrollbar'];
	const topClasses = ['flex', 'flex-col', 'overflow-y-auto', 'custom-scrollbar'];

	restore('step-1', centerClasses);
	restore('step-2', centerClasses);
	restore('step-3', centerClasses); // Cover
	restore('step-4', topClasses);    // Basic Info
	restore('step-5', centerClasses); // Description (TextArea fits well in center)
	restore('step-6', topClasses);
	restore('step-7', centerClasses); // Progress (Small inputs)
	restore('step-8', centerClasses); // Review (Stars + Text)
	restore('step-9', centerClasses); // Notes
	restore('step-10', topClasses);
	restore('step-11', centerClasses);
}

// =============================================================================
// WIZARD NAVIGATION
// =============================================================================

/** Advances to the next valid wizard step. */
export function nextStep() {
	if (!validateStep(state.currentStep)) return;
	const next = getNextValidStep(state.currentStep);
	if (next > state.TOTAL_STEPS) return;
	animateStepChange(state.currentStep, next, 'right');
	state.currentStep = next;
}

/** Returns to the previous valid wizard step. */
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

/**
 * Resets all wizard fields to defaults (used when changing media type).
 */
export function resetWizardFields() {
	safeVal('progress', '');
	safeVal('coverUrl', '');
	safeHtml('coverPreview', '<div class="text-zinc-500 font-medium">No Image Selected</div>');
	safeVal('coverImage', '');
	safeVal('title', '');
	safeVal('description', '');
	safeVal('notes', '');
	safeVal('review', '');
	safeVal('rating', 2);

	// Reset visuals
	updateRatingVisuals(2);

	state.currentAuthors = [];
	state.currentAlternateTitles = [];
	state.currentChildren = [];
	state.currentLinks = [];

	// Reset author input
	safeHtml('authorTagsContainer', '<input id="authorInput" list="authorOptions" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Type & Enter...">');
	setTimeout(() => {
		const authInput = document.getElementById('authorInput');
		if (authInput) authInput.addEventListener('keydown', (e) => checkEnterKey(e, 'author'));
	}, 0);

	safeVal('universe', '');
	safeVal('series', '');
	safeVal('seriesNumber', '');
	safeHtml('childrenContainer', '');
	safeHtml('dynamicLinkButtons', '');
	safeHtml('linksContainer', '');

	// Reset alt-title input
	setTimeout(() => {
		const altInput = document.getElementById('altTitleInput');
		if (altInput) altInput.addEventListener('keydown', (e) => checkEnterKey(e, 'altTitle'));
	}, 0);

	safeCheck('disableAbbr', true);
	// Initialize UI state based on checked default
	toggleAbbrField(true);
	safeHtml('abbrTagsContainer', '<input id="abbrInput" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Auto-filled from title...">');
	setTimeout(() => {
		const abbrInput = document.getElementById('abbrInput');
		if (abbrInput) abbrInput.addEventListener('keydown', (e) => checkEnterKey(e, 'abbr'));
	}, 0);
}

// =============================================================================
// TYPE & STATUS SELECTION
// =============================================================================

/**
 * Handles media type selection.
 * @param {string} t - Selected type
 */
export function selectType(t) {
	const current = document.getElementById('type').value;
	if (current === t && state.isEditMode) return;

	if (!state.isEditMode) {
		resetWizardFields();
		state.maxReachedStep = 1;
		document.getElementById('status').value = '';

		document.querySelectorAll('[id^="status-card-"]').forEach(el => {
			el.classList.remove('ring-2', 'ring-white', 'bg-zinc-800');
			el.classList.add('border-zinc-800');
		});
		renderStatusSelection();
	}

	document.getElementById('type').value = t;
	if (!state.isEditMode) updateDynamicLinks(t);
	selectTypeVisuals(t);
	updateWizardUI();

	if (state.isEditMode) {
		updateFormUI();
	} else {
		state.maxReachedStep = 1;
		updateDots(1);
		animateStepChange(1, 2, 'right');
		state.currentStep = 2;
	}
}

/**
 * Handles status selection.
 * @param {string} s - Selected status
 */
export function selectStatus(s) {
	const current = document.getElementById('status').value;
	if (current === s && !state.isEditMode) {
		animateStepChange(2, 3, 'right');
		state.currentStep = 3;
		return;
	}

	document.getElementById('status').value = s;
	selectStatusVisuals(s);

	if (state.isEditMode) {
		updateFormUI();
	} else {
		if (state.currentStep === 2) state.maxReachedStep = 2;
		animateStepChange(2, 3, 'right');
		state.currentStep = 3;
	}
}

/**
 * Updates visual selection state for type cards.
 * @param {string} t - Selected type
 */
function selectTypeVisuals(t) {
	const COLOR_MAP = {
		'Anime': 'violet', 'Manga': 'pink', 'Book': 'blue',
		'Movie': 'red', 'Series': 'amber'
	};
	const colorName = COLOR_MAP[t] || 'zinc';

	document.querySelectorAll('[id^="type-card-"]').forEach(el => {
		if (el.id !== `type-card-${t}`) restoreDefaultVisuals(el);
	});

	const card = document.getElementById(`type-card-${t}`);
	if (!card) return;

	Array.from(card.classList).forEach(cls => {
		if (cls.startsWith('bg-') || cls.startsWith('dark:bg-') ||
			cls.startsWith('hover:bg-') || cls.startsWith('dark:hover:bg-') ||
			(cls.startsWith('border-') && cls !== 'border-2') ||
			cls.startsWith('dark:border-')) {
			card.classList.remove(cls);
		}
	});

	card.classList.add('selected', 'scale-[1.02]', 'ring-4', 'ring-indigo-500/50', 'bg-black', 'dark:bg-white');

	const innerText = card.querySelector('span');
	if (innerText) {
		Array.from(innerText.classList).forEach(cls => {
			if (cls.startsWith('text-') || cls.startsWith('dark:text-')) innerText.classList.remove(cls);
		});
		innerText.classList.add(`text-${colorName}-400`, `dark:text-${colorName}-600`, 'font-bold');
	}
}

/** Extracts the Tailwind color name from an element's ID. */
function elementColorName(el) {
	const COLOR_MAP = {
		'Anime': 'violet', 'Manga': 'pink', 'Book': 'blue', 'Movie': 'red', 'Series': 'amber',
		'Planning': 'zinc', 'NumberOne': 'zinc', 'Reading': 'sky', 'Watching': 'sky',
		'Dropped': 'red', 'On': 'orange', 'Hold': 'orange', 'Anticipating': 'fuchsia', 'Completed': 'emerald'
	};
	for (const key of Object.keys(COLOR_MAP)) {
		if (el.id.includes(key)) return COLOR_MAP[key];
	}
	return 'zinc';
}

/** Restores a selection card to its default unselected visual state. */
function restoreDefaultVisuals(el) {
	const c = elementColorName(el);

	el.classList.remove('selected', 'ring-4', 'ring-indigo-500/50', 'scale-[1.02]');

	Array.from(el.classList).forEach(cls => {
		if (cls.startsWith('bg-') || cls.startsWith('dark:bg-') ||
			cls.startsWith('hover:bg-') || cls.startsWith('dark:hover:bg-') ||
			(cls.startsWith('border-') && cls !== 'border-2') ||
			cls.startsWith('dark:border-')) {
			el.classList.remove(cls);
		}
	});

	if (c === 'zinc') {
		el.classList.add('bg-zinc-100', 'dark:bg-zinc-800/80', 'border-zinc-300', 'dark:border-zinc-600');
	} else {
		el.classList.add(`bg-${c}-100`, `dark:bg-${c}-500/10`, `border-${c}-300`, `dark:border-${c}-500/30`);
	}

	const innerText = el.querySelector('span');
	if (innerText) {
		Array.from(innerText.classList).forEach(cls => {
			if (cls.startsWith('text-') || cls.startsWith('dark:text-')) innerText.classList.remove(cls);
		});
		innerText.classList.remove('font-bold');
		innerText.classList.add(`text-${c}-600`, `dark:text-${c}-400`);
	}

	const innerIcon = el.querySelector('i');
	if (innerIcon) {
		Array.from(innerIcon.classList).forEach(cls => {
			if (cls.startsWith('text-') || cls.startsWith('dark:text-')) innerIcon.classList.remove(cls);
		});
		innerIcon.classList.add(`text-${c}-500`, `dark:text-${c}-400`);
	}

	const innerBg = el.querySelector('div.p-3');
	if (innerBg) {
		Array.from(innerBg.classList).forEach(cls => {
			if (cls.startsWith('bg-') || cls.startsWith('dark:bg-') || cls.startsWith('group-hover:bg-')) {
				innerBg.classList.remove(cls);
			}
		});
		innerBg.classList.add('bg-white', 'dark:bg-zinc-900/50', 'group-hover:bg-zinc-100');
	}
}

/**
 * Updates visual selection state for status cards.
 * @param {string} s - Selected status
 */
function selectStatusVisuals(s) {
	const idSafe = s.replace(/[^a-zA-Z]/g, '');
	const COLOR_MAP = {
		'Planning': 'zinc', 'Reading/Watching': 'sky', 'Dropped': 'red',
		'On Hold': 'orange', 'Anticipating': 'fuchsia', 'Completed': 'emerald'
	};
	const colorName = Object.entries(COLOR_MAP).find(([k]) => s.includes(k) || k.includes(s))?.[1] || 'zinc';
	const selectedCardId = `status-card-${idSafe}`;

	document.querySelectorAll('[id^="status-card-"]').forEach(el => {
		if (el.id !== selectedCardId) restoreDefaultVisuals(el);
	});

	const card = document.getElementById(selectedCardId);
	if (!card) return;

	Array.from(card.classList).forEach(cls => {
		if (cls.startsWith('bg-') || cls.startsWith('dark:bg-') ||
			cls.startsWith('hover:bg-') || cls.startsWith('dark:hover:bg-') ||
			(cls.startsWith('border-') && cls !== 'border-2') ||
			cls.startsWith('dark:border-')) {
			card.classList.remove(cls);
		}
	});

	card.classList.add('selected', 'scale-[1.02]', 'ring-4', 'ring-indigo-500/50', 'bg-black', 'dark:bg-white');

	const innerText = card.querySelector('span');
	if (innerText) {
		Array.from(innerText.classList).forEach(cls => {
			if (cls.startsWith('text-') || cls.startsWith('dark:text-')) innerText.classList.remove(cls);
		});
		innerText.classList.add(`text-${colorName}-400`, `dark:text-${colorName}-600`, 'font-bold');
	}
}

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

	state.items.forEach(item => {
		if (Array.isArray(item.authors)) item.authors.forEach(a => authors.add(a));
		if (item.universe) universes.add(item.universe);
		if (item.series) seriesList.add(item.series);
	});

	const fill = (id, set) => {
		const el = document.getElementById(id);
		if (el) el.innerHTML = Array.from(set).sort().map(v => `<option value="${v}">`).join('');
	};

	fill('authorOptions', authors);
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
		tag.className = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs px-2 py-1 rounded flex items-center gap-1 font-medium';
		const safeTitle = title.replace(/'/g, "\\'");
		tag.innerHTML = `${title} <button type="button" onclick="window.removeAltTitle('${safeTitle}')" class="hover:text-red-400 flex items-center"><i data-lucide="x" class="w-3 h-3"></i></button>`;
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

// =============================================================================
// CHILDREN / SEASONS
// =============================================================================

/**
 * Renders the children (seasons/volumes) list.
 */
export function renderChildren() {
	const container = document.getElementById('childrenContainer');
	if (!container) return;

	if (state.currentChildren.length === 0) {
		container.innerHTML = '<div class="text-center text-zinc-400 dark:text-zinc-600 italic text-xs py-3">No items added yet</div>';
		return;
	}

	container.innerHTML = state.currentChildren.map((child, idx) => {
		const starsHtml = [1, 2, 3, 4].map(i => {
			const fillClass = child.rating >= i ? STAR_FILLS[child.rating] : 'text-zinc-300 dark:text-zinc-700';
			return `<button type="button" onclick="window.updateChildRating(${idx}, ${i})" class="focus:outline-none star-btn transition-transform"><i data-lucide="star" class="w-3.5 h-3.5 ${fillClass} fill-current"></i></button>`;
		}).join('');

		return `
            <div class="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 flex items-center gap-3">
                <input value="${child.title}" oninput="window.updateChild(${idx}, 'title', this.value)" class="bg-transparent border-b border-zinc-300 dark:border-zinc-700 outline-none text-xs pb-1 text-zinc-700 dark:text-zinc-200 flex-1 font-medium placeholder-zinc-400">
                <div class="flex gap-1">${starsHtml}</div>
                <button type="button" onclick="window.removeChildIdx(${idx})" class="text-zinc-400 hover:text-red-400 transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
        `;
	}).join('');

	safeCreateIcons();
}

/** Adds a new child (season/volume). */
export function addChild() {
	const type = document.getElementById('type').value;
	const prefix = ['Book', 'Manga'].includes(type) ? 'Volume' : 'Season';
	const next = state.currentChildren.length + 1;
	state.currentChildren.push({ id: crypto.randomUUID(), title: `${prefix} ${next}`, rating: 0 });
	renderChildren();
}

export function removeChildIdx(idx) { state.currentChildren.splice(idx, 1); renderChildren(); }
export function updateChild(idx, field, val) { state.currentChildren[idx][field] = val; }
export function updateChildRating(idx, rating) { state.currentChildren[idx].rating = rating; renderChildren(); }

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

export function addLink() { state.currentLinks.push({ label: '', url: '' }); renderLinks(); }
export function addSpecificLink(label) { state.currentLinks.push({ label, url: '' }); renderLinks(); }
export function removeLink(idx) { state.currentLinks.splice(idx, 1); renderLinks(); }
export function updateLink(idx, field, val) { state.currentLinks[idx][field] = val; }

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

	const childrenHtml = (item.children || []).map(c => `
        <div class="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/60 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors group/child w-full">
            <span class="text-base text-zinc-700 dark:text-zinc-300 font-bold font-heading tracking-wide">${c.title}</span>
            <div class="flex gap-1">
                ${[1, 2, 3, 4].map(i => `<i data-lucide="star" class="w-5 h-5 ${c.rating >= i ? STAR_FILLS[c.rating] : 'text-zinc-300 dark:text-zinc-800'} fill-current"></i>`).join('')}
            </div>
        </div>
    `).join('');

	const linksHtml = (item.externalLinks || []).map(l => `
        <a href="${l.url}" target="_blank" class="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 hover:text-white bg-indigo-100 dark:bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-500 dark:hover:bg-indigo-500 transition-all text-sm font-bold">
            <i data-lucide="link" class="w-4 h-4"></i> ${l.label || 'Link'}
        </a>
    `).join('');

	content.innerHTML = `
        <div class="media-${item.type} relative h-full flex flex-col lg:flex-row">
            <div class="relative w-full lg:w-[45%] h-64 lg:h-full shrink-0 bg-zinc-100 dark:bg-zinc-900 overflow-hidden group border-r border-zinc-200 dark:border-zinc-800">
                ${coverUrl ? `<img src="${coverUrl}" loading="lazy" class="w-full h-full object-contain bg-zinc-50 dark:bg-zinc-950/50">` : '<div class="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-700 bg-zinc-100 dark:bg-zinc-900"><i data-lucide="image" class="w-24 h-24 opacity-20"></i></div>'}
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                
                <div class="absolute bottom-6 left-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onclick="window.editFromDetail('${item.id}')" class="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-white/90 text-black hover:bg-white shadow-xl backdrop-blur-md transform hover:scale-[1.02] transition-all">
                        <i data-lucide="edit-2" class="w-4 h-4"></i> Edit
                    </button>
                    <button onclick="window.deleteFromDetail('${item.id}')" class="px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-red-500/80 text-white hover:bg-red-600 shadow-xl backdrop-blur-md transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto custom-scrollbar h-full bg-white dark:bg-[#0c0c0e] relative">
                <div class="p-10 pb-6 border-b border-zinc-100 dark:border-white/5 relative">
                    ${linksHtml ? `<div class="absolute top-8 right-16 mr-6 flex gap-2 z-20">${linksHtml}</div>` : ''}
                    <div class="flex flex-wrap gap-2 mb-4 mt-12">
                        <span class="media-badge px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors"><i data-lucide="${ICON_MAP[item.type]}" class="w-3.5 h-3.5"></i> ${item.type}</span>
                        <span class="${STATUS_COLOR_MAP[item.status]} px-4 py-1.5 rounded text-xs font-black uppercase tracking-widest border border-current/20 flex items-center gap-1.5"><i data-lucide="${STATUS_ICON_MAP[item.status]}" class="w-3.5 h-3.5"></i> ${item.status}</span>
                        ${item.progress ? `<span class="px-4 py-1.5 rounded text-xs font-black font-mono uppercase tracking-widest border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center gap-1.5">Progress: ${item.progress}</span>` : ''}
                    </div>
                    <h1 class="text-5xl md:text-6xl font-heading font-black text-zinc-900 dark:text-[var(--theme-col)] leading-none tracking-tight mb-2 drop-shadow-sm">${item.title}</h1>
                    ${item.alternateTitles && item.alternateTitles.length ? `<h2 class="text-xl text-zinc-500 dark:text-zinc-400 font-bold mb-4 font-heading">${item.alternateTitles.join(', ')}</h2>` : ''}
                    <div class="flex flex-wrap gap-6 text-base font-medium text-zinc-500 dark:text-zinc-400 mt-4">
                        ${authors.length ? `<div class="flex items-center gap-2"><i data-lucide="pen-tool" class="w-5 h-5 text-zinc-400 dark:text-zinc-600"></i> ${authHtml}</div>` : ''}
                        ${item.series ? `<div onclick="smartFilter(event, 'series', '${item.series}')" class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 cursor-pointer transition-colors"><i data-lucide="library" class="w-5 h-5"></i> ${seriesText}</div>` : ''}
                        ${item.universe ? `<div onclick="smartFilter(event, 'universe', '${item.universe}')" class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 cursor-pointer transition-colors"><i data-lucide="globe" class="w-5 h-5"></i> ${item.universe}</div>` : ''}
                    </div>
                </div>
                <div class="p-10 pt-6 space-y-8">
                    
                    ${(item.review || item.rating) ? `
                    <div class="bg-zinc-50 dark:bg-zinc-900/50 border border-[color:var(--theme-col)] rounded-2xl p-6 relative flow-root min-h-[160px]">
                         <h4 class="text-sm font-bold text-[var(--theme-col)] uppercase tracking-widest mb-4 opacity-100 flex items-center gap-2"><i data-lucide="message-square" class="w-4 h-4"></i> Review</h4>
                         ${item.rating ? `
                         <div class="float-right ml-6 mb-2 flex flex-col items-center gap-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-lg">
                            <span class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">VERDICT</span>
                            <span class="text-3xl font-heading font-black uppercase ${TEXT_COLORS[item.rating]}">${RATING_LABELS[item.rating]}</span>
                            <div class="flex gap-1 mt-1">
                                ${[1, 2, 3, 4].map(i => `<i data-lucide="star" class="w-4 h-4 ${item.rating >= i ? STAR_FILLS[item.rating] : 'text-zinc-300 dark:text-zinc-800'} fill-current"></i>`).join('')}
                            </div>
                         </div>` : ''}
                         
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

                    ${item.notes ? `
                    <div class="bg-zinc-50 dark:bg-zinc-900/5 border border-[color:var(--theme-col)] rounded-xl p-6 group/notes">
                        <h4 class="text-xs font-bold text-[var(--theme-col)] uppercase tracking-widest mb-3 flex items-center gap-2"><i data-lucide="sticky-note" class="w-4 h-4"></i> Notes</h4>
                        <div id="detail-notes-${item.id}" class="text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono text-sm line-clamp-6">${item.notes}</div>
                         ${item.notes.length > 0 ? `<button type="button" id="btn-detail-notes-${item.id}" onclick="event.stopPropagation(); window.toggleExpand('${item.id}', 'detail-notes')" class="text-xs text-[var(--theme-col)] font-bold mt-2 hover:underline relative z-20">Read More</button>` : ''}
                    </div>` : ''}

                    ${(item.children && item.children.length) ? `
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
		const eventsContainer = document.getElementById(`detail-events-${item.id}`);
		loadItemEvents(item.id, eventsContainer);
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
 * Toggles the abbreviation field enabled state.
 * @param {boolean} checked - Whether disabled is checked
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
