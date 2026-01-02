/**
 * @fileoverview Wizard navigation and step management for UpNext.
 * Handles the multi-step form wizard for adding/editing entries.
 * @module wizard_logic
 */

import { state, isFieldVisible } from './state.js';
import {
	STEP_TITLES,
	LINK_SUGGESTIONS,
	TYPE_COLOR_MAP,
	STATUS_TYPES,
	STATUS_ICON_MAP,
	STATUS_COLOR_MAP,
	ICON_MAP
} from './constants.js';
import { safeCreateIcons, safeVal, safeHtml, safeCheck } from './dom_utils.js';
import { showToast } from './toast.js';
import { initImageEditor } from './image_editor.js';

// Global Handlers for Drag & Drop
window.handleDragOver = (e) => {
	e.preventDefault();
	e.stopPropagation(); // Good practice
	document.getElementById('dropZone').classList.add('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-500/10');
};

window.handleDragLeave = (e) => {
	e.preventDefault();
	e.stopPropagation();
	document.getElementById('dropZone').classList.remove('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-500/10');
};

window.handleDrop = (e) => {
	e.preventDefault();
	e.stopPropagation();
	document.getElementById('dropZone').classList.remove('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-500/10');

	// Try standard files property
	let file = e.dataTransfer.files ? e.dataTransfer.files[0] : null;

	// Fallback: Try items if files is empty (sometimes happens on certain OS/Browsers)
	if (!file && e.dataTransfer.items) {
		for (let i = 0; i < e.dataTransfer.items.length; i++) {
			if (e.dataTransfer.items[i].kind === 'file') {
				file = e.dataTransfer.items[i].getAsFile();
				break;
			}
		}
	}

	if (file) {
		processImageFile(file);
	}
};

window.handleFileSelect = (input) => {
	if (input.files && input.files[0]) {
		processImageFile(input.files[0]);
	}
};

// Global Paste Listener for Image Upload (Ctrl+V)
window.addEventListener('paste', (e) => {
	// Only handle if we are on Step 3 of the wizard
	if (state.currentStep !== 3) return;

	// 1. Try files directly (often populated for file copies)
	if (e.clipboardData.files && e.clipboardData.files.length > 0) {
		const file = e.clipboardData.files[0];
		if (file.type.startsWith('image/')) {
			e.preventDefault();
			processImageFile(file);
			return;
		}
	}

	// 2. Scan items (for image data/screenshots)
	const items = e.clipboardData?.items;
	if (items) {
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					e.preventDefault();
					processImageFile(file);
					return;
				}
			}
		}
	}
});

/**
 * Processes the selected image file.
 * Initiates the Image Editor.
 */
function processImageFile(file) {
	if (!file.type.startsWith('image/')) {
		showToast('Invalid file type. Please upload an image.', 'error');
		return;
	}

	// Start Editor
	initImageEditor(file, (croppedBlob) => {
		// Callback when crop is applied
		handleCroppedImage(croppedBlob, file.name);
	});
}

/**
 * Handles the cropped image blob.
 * Updates the file input and UI preview.
 */
function handleCroppedImage(blob, originalName) {
	// Create a new File object
	const file = new File([blob], originalName, { type: 'image/jpeg' });

	// Update the Input
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	const input = document.getElementById('coverImage');
	if (input) input.files = dataTransfer.files;

	// Update Preview UI
	const prevImg = document.getElementById('previewImg');
	const placeholder = document.getElementById('previewPlaceholder');
	const nameEl = document.getElementById('currentCoverName');

	if (prevImg) {
		prevImg.src = URL.createObjectURL(blob);
		prevImg.classList.remove('hidden');
	}
	if (placeholder) placeholder.classList.add('hidden');
	if (nameEl) nameEl.innerText = file.name;

	// Switch back to upload view (Handled by closeEditor, but good to ensure preview is visible)
	const uploadArea = document.getElementById('imageUploadArea');
	const editorArea = document.getElementById('imageEditorArea');
	if (uploadArea) uploadArea.classList.remove('hidden');
	if (editorArea) editorArea.classList.add('hidden');
}

// =============================================================================
// STEP NAVIGATION
// =============================================================================

/**
 * Determines which steps should be skipped based on current form values.
 * @returns {number[]} Array of step numbers to skip
 */
export function getSkippedSteps() {
	const type = document.getElementById('type')?.value || '';
	const status = document.getElementById('status')?.value || '';

	const skipped = [];

	// Logic for skipping steps:
	// - Progress (7): Skipped for 'Planning' and 'Completed'
	// - Rating (8): Skipped ONLY for 'Planning' (Allowed for Anticipating/Reading/Dropped)
	// - Seasons/Volumes (10): Skipped for Manga/Movie
	// - Privacy (11): Skipped if globally visible

	if (status === 'Planning' || status === 'Reading/Watching') {
		if (status === 'Planning') {
			skipped.push(7);
			skipped.push(8);
		}
	} else {
		if (status === 'Completed') {
			skipped.push(7);
		}
	}
	if (['Manga', 'Movie'].includes(type)) {
		skipped.push(10);
	}
	// Skip privacy step (11) if not in hidden mode
	if (!state.isHidden) {
		skipped.push(11);
	}

	// Stats Feature Disable
	if (state.appSettings?.disabledFeatures?.includes('stats')) {
		skipped.push(8); // Review & Rating
	}

	// Step 4 Skip Logic: If ALL fields in Step 4 are hidden
	const step4Fields = ['title', 'authors', 'tags', 'universe', 'release_date', 'technical_stats'];
	const step4Visible = step4Fields.some(f => isFieldVisible(f));
	if (!step4Visible) skipped.push(4);

	return [...new Set(skipped)]; // Remove duplicates
}

/**
 * Gets the next valid step number, skipping hidden steps.
 * @param {number} current - Current step number
 * @returns {number} Next valid step number
 */
export function getNextValidStep(current) {
	const skipped = getSkippedSteps();
	let next = current + 1;
	while (skipped.includes(next) && next <= state.TOTAL_STEPS) {
		next++;
	}
	return next;
}

/**
 * Gets the previous valid step number, skipping hidden steps.
 * @param {number} current - Current step number
 * @returns {number} Previous valid step number
 */
export function getPrevValidStep(current) {
	const skipped = getSkippedSteps();
	let prev = current - 1;
	while (skipped.includes(prev) && prev >= 1) {
		prev--;
	}
	return prev;
}

// =============================================================================
// STEP ANIMATIONS & TRANSITIONS
// =============================================================================

/**
 * Animates the transition between wizard steps.
 * @param {number} from - Current step number
 * @param {number} to - Target step number
 * @param {'left'|'right'} direction - Animation direction
 */
export function animateStepChange(from, to, direction) {
	const fromEl = document.getElementById(`step-${from}`);
	const toEl = document.getElementById(`step-${to}`);

	if (!fromEl || !toEl) return;

	// Prepare elements
	toEl.classList.remove('hidden');
	toEl.style.display = 'flex';
	removeAnimationClasses(fromEl);
	removeAnimationClasses(toEl);

	// Apply animation classes
	if (direction === 'right') {
		fromEl.classList.add('step-exit-left');
		toEl.classList.add('step-enter-right');
	} else {
		fromEl.classList.add('step-exit-right');
		toEl.classList.add('step-enter-left');
	}

	// Update state
	if (to > state.maxReachedStep) state.maxReachedStep = to;

	// Update UI
	document.getElementById('modalTitle').innerText = STEP_TITLES[to] || 'New Entry';
	updateDots(to);
	updateNavigationButtons(to);

	// Update links on step 6
	if (to === 6) updateDynamicLinks();

	document.getElementById('stepIndicator').innerText = `Step ${to} / ${state.TOTAL_STEPS}`;

	// Cleanup after animation
	setTimeout(() => {
		fromEl.classList.add('hidden');
		fromEl.style.display = 'none';
		removeAnimationClasses(fromEl);
		removeAnimationClasses(toEl);

		// Focus first input on new step
		const input = toEl.querySelector('input, textarea');
		// Skip autofocus for cards/image steps (1, 2, 3)
		if (input && to > 3) input.focus();
	}, 380);
}

/**
 * Removes animation classes from an element.
 * @param {HTMLElement} el - Element to clean
 */
function removeAnimationClasses(el) {
	el.classList.remove(
		'step-enter-right', 'step-enter-left',
		'step-exit-right', 'step-exit-left', 'animate-enter'
	);
}

/**
 * Shows a specific wizard step immediately (no animation).
 * @param {number} step - Step number to show
 */
export function showStep(step) {
	if (step > state.maxReachedStep) state.maxReachedStep = step;

	// Hide all steps
	document.querySelectorAll('.wizard-step').forEach(el => {
		el.classList.add('hidden');
		el.style.display = 'none';
		removeAnimationClasses(el);
	});

	// Show target step
	const stepEl = document.getElementById(`step-${step}`);
	if (!stepEl) return;

	stepEl.classList.remove('hidden');
	stepEl.style.display = 'flex';
	stepEl.classList.add('animate-enter');
	setTimeout(() => stepEl.classList.remove('animate-enter'), 400);

	// Update UI
	document.getElementById('modalTitle').innerText = STEP_TITLES[step] || 'New Entry';
	updateDots(step);
	updateNavigationButtons(step);
}

// =============================================================================
// NAVIGATION UI
// =============================================================================

/**
 * Updates the navigation button visibility based on current step.
 * @param {number} step - Current step number
 */
function updateNavigationButtons(step) {
	const prevBtn = document.getElementById('prevBtn');
	const nextBtn = document.getElementById('nextBtn');
	const submitBtn = document.getElementById('submitBtn');

	prevBtn.classList.toggle('hidden', step === 1);

	const nextStep = getNextValidStep(step);
	const isLastStep = nextStep > state.TOTAL_STEPS;

	nextBtn.classList.toggle('hidden', isLastStep);
	submitBtn.classList.toggle('hidden', !isLastStep);
}

/**
 * Updates the progress dots indicator.
 * @param {number} currentStep - Current step number
 */
export function updateDots(currentStep) {
	const container = document.getElementById('wizardDots');
	if (!container) return;

	const skipped = getSkippedSteps();
	container.innerHTML = Array.from({ length: state.TOTAL_STEPS }, (_, i) => i + 1)
		.filter(i => !skipped.includes(i))
		.map(i => createDotHtml(i, currentStep))
		.join('');
}

/**
 * Creates HTML for a single progress dot.
 * @param {number} step - Step number
 * @param {number} currentStep - Current step number
 * @returns {string} HTML string
 */
function createDotHtml(step, currentStep) {
	let stateClass = 'bg-zinc-300 dark:bg-zinc-700';
	let cursor = 'cursor-default';
	let onclick = '';

	if (step === currentStep) {
		stateClass = 'bg-zinc-800 dark:bg-white scale-125 shadow-lg shadow-zinc-800/20 dark:shadow-white/20';
	} else if (step <= state.maxReachedStep) {
		stateClass = 'bg-indigo-500 hover:bg-indigo-400';
		cursor = 'cursor-pointer';
		onclick = `onclick="window.jumpToStep(${step})"`;
	}

	return `<button type="button" ${onclick} class="focus:outline-none w-2.5 h-2.5 rounded-full transition-all duration-300 ${stateClass} ${cursor}"></button>`;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates the current step before proceeding.
 * @param {number} step - Step to validate
 * @returns {boolean} True if valid
 */
export function validateStep(step) {
	switch (step) {
		case 1: // Media Type
			if (!document.getElementById('type').value) {
				showToast('Please select a media type to continue.', 'warning');
				return false;
			}
			break;
		case 2: // Status
			if (!document.getElementById('status').value) {
				showToast('Please select a status to continue.', 'warning');
				return false;
			}
			break;
		case 4: // Basic Info
			if (isFieldVisible('title') && !document.getElementById('title').value.trim()) {
				showToast('Title is required to proceed.', 'warning');
				return false;
			}
			break;
	}
	return true;
}

// =============================================================================
// FORM UI UPDATES
// =============================================================================

/**
 * Updates form sections visibility based on form values.
 * Ensures field visibility matches the step skipping logic.
 */
export function updateFormUI() {
	const type = document.getElementById('type').value;
	const status = document.getElementById('status').value;

	const toggle = (id, show) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.classList.toggle('hidden', !show);
		el.style.display = show ? 'block' : 'none';
	};

	// Step 7 (Progress): Hide for Planning/Completed OR if hidden in settings
	const isProgressHidden = (status === 'Planning' || status === 'Completed') || !isFieldVisible('progress');
	toggle('step-7', !isProgressHidden);

	// Step 8 (Review): Hide for Planning and Reading/Watching OR if hidden in settings
	// Visible for: Completed, On Hold, Dropped, Anticipating
	const isReviewHidden = (status === 'Planning' || status === 'Reading/Watching') || !isFieldVisible('review');
	toggle('step-8', !isReviewHidden);

	// Step 10 (Seasons/Volumes): Hide for Manga and Movie OR if hidden in settings
	// Visible for: Anime, Book, Series
	const isChildrenHidden = (['Manga', 'Movie'].includes(type) || !isFieldVisible('series_number'));
	toggle('step-10', !isChildrenHidden);

	// Step 9 (Notes): Hide if hidden in settings
	toggle('step-9', isFieldVisible('notes'));

	// Step 6 (External Links): Hide if hidden
	toggle('step-6', isFieldVisible('external_links'));

	// Step 5 (Description): Hide if hidden? (Description wasn't explicitly in request but maybe useful to hide?)
	// No, description is core.

	// Step 11 (Privacy): Only show in hidden mode
	toggle('step-11', state.isHidden);

	// Other inputs in Step 4
	if (document.getElementById('seriesWrapper')) document.getElementById('seriesWrapper').classList.toggle('hidden', !isFieldVisible('series'));
	if (document.getElementById('universe')) document.getElementById('universe').parentElement.classList.toggle('hidden', !isFieldVisible('universe'));
	if (document.getElementById('authorTagsContainer')) document.getElementById('authorTagsContainer').parentElement.classList.toggle('hidden', !isFieldVisible('authors'));

	// New Fields Visibility
	const titleContainer = document.getElementById('titleContainer');
	if (titleContainer) titleContainer.classList.toggle('hidden', !isFieldVisible('title'));

	const tagContainer = document.getElementById('tagTagsContainer');
	if (tagContainer) tagContainer.parentElement.classList.toggle('hidden', !isFieldVisible('tags'));

	const releaseDateContainer = document.getElementById('releaseDateContainer');
	if (releaseDateContainer) releaseDateContainer.classList.toggle('hidden', !isFieldVisible('release_date'));

	const techStatsContainer = document.getElementById('technicalStatsContainer');
	if (techStatsContainer) {
		techStatsContainer.classList.toggle('hidden', !isFieldVisible('technical_stats'));
		if (!isFieldVisible('technical_stats')) {
			techStatsContainer.classList.remove('hidden'); // Logic fix: toggle handles hidden class. remove hidden? No, if !visible, add hidden. toggle(force)
			// Actually toggle works: classList.toggle('hidden', true) adds hidden.
			// Re-verify toggle signature: element.classList.toggle(token, force)
		}
	}

	const rereadContainer = document.getElementById('rereadCountContainer');
	if (rereadContainer) rereadContainer.classList.toggle('hidden', !isFieldVisible('reread_count'));

	const completedAtContainer = document.getElementById('completedAtContainer');
	if (completedAtContainer) completedAtContainer.classList.toggle('hidden', !isFieldVisible('completed_at'));


	if (document.getElementById('altTitleTagsContainer')) document.getElementById('altTitleTagsContainer').parentElement.classList.toggle('hidden', !isFieldVisible('alternate_titles'));
	if (document.getElementById('disableAbbr')) document.getElementById('disableAbbr').closest('.space-y-2').classList.toggle('hidden', !isFieldVisible('abbreviations'));


	if (window.updateSidebarVisibility) window.updateSidebarVisibility();
}

/**
 * Updates wizard UI based on selected media type.
 */
export function updateWizardUI() {
	const type = document.getElementById('type').value;

	// Show/hide series fields
	const seriesWrapper = document.getElementById('seriesWrapper');
	if (seriesWrapper) {
		seriesWrapper.style.display = ['Book', 'Movie'].includes(type) ? 'block' : 'none';
	}

	// Update child items label
	const childLabel = document.querySelector('#step-10 #childLabel');
	if (childLabel) {
		childLabel.innerText = ['Book', 'Manga'].includes(type) ? 'Volumes' : 'Seasons';
	}

	updateDynamicLinks();
}

/**
 * Updates the dynamic link suggestions based on media type.
 * @param {string} [specificType] - Optional type override
 */
export function updateDynamicLinks(specificType) {
	const type = specificType || document.getElementById('type').value;
	const container = document.getElementById('dynamicLinkButtons');
	if (!container) return;

	if (!type) {
		container.innerHTML = '';
		return;
	}

	const suggestions = LINK_SUGGESTIONS[type] || [];
	container.innerHTML = suggestions.map(site => `
        <button type="button" onclick="window.addSpecificLink('${site}')"
            class="px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-300 hover:text-white transition-all font-bold flex items-center gap-1.5">
            <i data-lucide="plus" class="w-3 h-3 text-indigo-400"></i> ${site}
        </button>
    `).join('');

	safeCreateIcons();
}

// =============================================================================
// SELECTION CARDS RENDERING
// =============================================================================

/**
 * Renders media type selection cards.
 */
export function renderTypeSelection() {
	const container = document.getElementById('typeSelectionContainer');
	if (!container) return;

	// Enforce 2 columns, fill height
	container.className = 'grid grid-cols-2 gap-4 w-full h-full justify-center items-center';
	// Ensure rows stretch evenly to fill vertical space
	container.style.gridAutoRows = '1fr';

	const types = ['Anime', 'Manga', 'Book', 'Movie', 'Series'];
	container.innerHTML = types
		.map((type, i) => {
			// For the last item, span 2 cols to center it, but restrict width to match others (50% - half gap)
			// gap-4 is 1rem (16px), so half gap is 0.5rem
			const isLast = i === types.length - 1;
			const extra = isLast
				? 'col-span-2 justify-self-center w-[calc(50%-0.5rem)]'
				: 'w-full';
			return createTypeCardHtml(type, extra);
		})
		.join('');

	safeCreateIcons();
}

/**
 * Creates HTML for a media type selection card.
 * @param {string} type - Media type
 * @param {string} [extraClasses=''] - Additional CSS classes
 * @returns {string} HTML string
 */
function createTypeCardHtml(type, extraClasses = '') {
	const rawClasses = TYPE_COLOR_MAP[type] || '';
	const color = rawClasses.match(/text-([a-z]+)-400/)?.[1] || 'zinc';
	const icon = ICON_MAP[type] || 'circle';

	return `
        <button type="button" onclick="window.selectType('${type}')" id="type-card-${type}" style="--theme-col: var(--col-${type.toLowerCase()})"
            class="selection-card w-full h-full p-4 rounded-3xl flex flex-col items-center justify-center gap-3 group transition-all duration-300 cursor-pointer border-2 hover:scale-[1.02] active:scale-95 shadow-xl relative overflow-hidden ${rawClasses} ${extraClasses} outline-none focus:ring-4 focus:ring-indigo-500/50">
            <div class="absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-100 transition-opacity"></div>
            <div class="p-3 md:p-4 rounded-full bg-white dark:bg-zinc-900/50 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/80 transition-colors shadow-lg z-10 ring-1 ring-black/5 dark:ring-white/10">
                <i data-lucide="${icon}" class="w-8 h-8 md:w-10 md:h-10 transition-colors text-${color}-500 dark:text-${color}-400"></i>
            </div>
            <span class="font-bold uppercase tracking-widest text-xs md:text-sm z-10 text-${color}-600 dark:text-${color}-100 text-center">${type}</span>
        </button>
    `;
}

/**
 * Renders status selection cards.
 */
export function renderStatusSelection() {
	const container = document.getElementById('statusSelectionContainer');
	if (!container) return;

	// Enforce 2 columns, fill height
	container.className = 'grid grid-cols-2 gap-3 w-full h-full items-center content-center';
	// Ensure rows stretch evenly
	container.style.gridAutoRows = '1fr';

	container.innerHTML = STATUS_TYPES.map(status => createStatusCardHtml(status)).join('');

	safeCreateIcons();
}

/**
 * Creates HTML for a status selection card.
 * @param {string} status - Status type
 * @returns {string} HTML string
 */
function createStatusCardHtml(status) {
	const icon = STATUS_ICON_MAP[status] || 'circle';
	const rawClass = STATUS_COLOR_MAP[status] || '';
	const color = rawClass.match(/text-([a-z]+)-400/)?.[1] || 'zinc';
	const safeId = status.replace(/[^a-zA-Z]/g, '');

	const statusVarName = status.toLowerCase().replace(/[^a-z]/g, '');
	return `
        <button type="button" onclick="window.selectStatus('${status}')" id="status-card-${safeId}" style="--theme-col: var(--col-${statusVarName})"
            class="selection-card w-full h-full p-4 rounded-2xl flex flex-row items-center justify-start gap-4 group transition-all duration-300 cursor-pointer border-2 hover:scale-[1.02] shadow-xl relative overflow-hidden ${rawClass || 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'} outline-none focus:ring-4 focus:ring-indigo-500/50">
            <div class="absolute inset-0 bg-gradient-to-r from-transparent to-${color}-500/10 opacity-100 transition-opacity"></div>
            <div class="p-3 rounded-full bg-white dark:bg-zinc-900/50 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900/80 transition-colors shadow-lg z-10 ring-1 ring-black/5 dark:ring-white/10 shrink-0">
                <i data-lucide="${icon}" class="w-6 h-6 transition-colors text-${color}-500 dark:text-${color}-400"></i>
            </div>
            <span class="font-bold uppercase tracking-wider text-[10px] sm:text-xs z-10 text-left text-${color}-600 dark:text-${color}-100 break-words leading-tight w-full pr-2">${status}</span>
        </button>
    `;
}


// =============================================================================
// WIZARD INITIALIZATION
// =============================================================================

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

	// ScrollSpy is local to edit_mode.js (mostly), but if we moved initWizard here, 
	// we can't easily disconnect the observer from edit_mode.js unless we expose a disconnect method.
	// But initEditMode creates a new observer every time.
	// So we don't strictly need to disconnect it here, but it's good practice.
	// We can ignore it for now or add window.disconnectScrollSpy?

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

	if (window.renderChildren) window.renderChildren();
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
	if (window.updateRatingVisuals) window.updateRatingVisuals(2);

	state.currentAuthors = [];
	state.currentAlternateTitles = [];
	state.currentChildren = [];
	state.currentLinks = [];

	// Reset author input
	safeHtml('authorTagsContainer', '<input id="authorInput" list="authorOptions" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Type & Enter...">');
	setTimeout(() => {
		const authInput = document.getElementById('authorInput');
		if (authInput && window.checkEnterKey) authInput.addEventListener('keydown', (e) => window.checkEnterKey(e, 'author'));
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
		if (altInput && window.checkEnterKey) altInput.addEventListener('keydown', (e) => window.checkEnterKey(e, 'altTitle'));
	}, 0);

	safeCheck('disableAbbr', true);
	// Initialize UI state based on checked default
	if (window.toggleAbbrField) window.toggleAbbrField(true);
	safeHtml('abbrTagsContainer', '<input id="abbrInput" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Auto-filled from title...">');
	setTimeout(() => {
		const abbrInput = document.getElementById('abbrInput');
		if (abbrInput && window.checkEnterKey) abbrInput.addEventListener('keydown', (e) => window.checkEnterKey(e, 'abbr'));
	}, 0);

	// Reset New Fields
	state.currentTags = [];
	safeVal('releaseDate', '');
	safeVal('episodeCount', '');
	safeVal('volumeCount', '');
	safeVal('pageCount', '');
	safeVal('avgDurationMinutes', '');
	safeVal('rereadCount', '');
	safeVal('completedAt', '');

	safeHtml('tagTagsContainer', '<input id="tagInput" list="tagOptions" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Add Tags...">');
	setTimeout(() => {
		const tagInput = document.getElementById('tagInput');
		if (tagInput && window.checkEnterKey) tagInput.addEventListener('keydown', (e) => window.checkEnterKey(e, 'tag'));
	}, 0);
}

// =============================================================================
// SELECTION HANDLERS
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

	// Prefill completedAt with today's date when 'Completed' is selected
	if (s === 'Completed' && !state.isEditMode) {
		const completedAtInput = document.getElementById('completedAt');
		if (completedAtInput && !completedAtInput.value) {
			const today = new Date().toISOString().split('T')[0];
			completedAtInput.value = today;
		}
	}

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
export function selectTypeVisuals(t) {
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
export function elementColorName(el) {
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
export function restoreDefaultVisuals(el) {
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
export function selectStatusVisuals(s) {
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
