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
import { safeCreateIcons, safeVal, safeHtml, safeCheck, debounce } from './dom_utils.js';
import { showToast } from './toast.js';
import { initImageEditor } from './image_editor.js';

// =============================================================================
// DUPLICATE CHECK
// =============================================================================

/**
 * Checks for duplicate entries in the database.
 */
async function checkDuplicateImpl() {
	const title = document.getElementById('title')?.value?.trim();
	const type = document.getElementById('type')?.value;
	const warningEl = document.getElementById('duplicateWarning');
	const warningText = document.getElementById('duplicateWarningText');

	if (!title || !type || !warningEl || !warningText) {
		if (warningEl) warningEl.classList.add('hidden');
		return;
	}

	// Don't check if we are in edit mode and the title hasn't changed? 
	// Actually we should exclude the current ID.
	const currentId = document.getElementById('itemId')?.value;

	try {
		const params = new URLSearchParams({ title, type });
		if (currentId) params.append('exclude_id', currentId);

		const res = await fetch(`/api/items/check?${params}`);
		const data = await res.json();

		if (data.exists && data.item) {
			warningText.innerText = `"${data.item.title}" (${data.item.type}) is already in your library.`;
			warningEl.classList.remove('hidden');
		} else {
			warningEl.classList.add('hidden');
		}
	} catch (e) {
		console.warn('Duplicate check failed:', e);
		warningEl.classList.add('hidden');
	}
}

const checkDuplicate = debounce(checkDuplicateImpl, 500);

/**
 * Initializes duplicate check listeners.
 */
export function initDuplicateCheck() {
	const titleInput = document.getElementById('title');
	if (titleInput) {
		titleInput.addEventListener('input', checkDuplicate);
	}
}

/**
 * Manually trigger a duplicate check (e.g. when type changes).
 */
export function triggerDuplicateCheck() {
	checkDuplicate();
}
window.triggerDuplicateCheck = triggerDuplicateCheck;

// Global Handlers for Drag & Drop
window.handleDragOver = (e) => {
	e.preventDefault();
	e.stopPropagation();
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
	// Only handle if we are on Step 4 of the wizard (Cover Image) or in Edit Mode
	if (!state.isEditMode && state.currentStep !== 4) return;

	// In Edit Mode, ensure the modal is actually open
	if (state.isEditMode) {
		const modal = document.getElementById('modal');
		if (!modal || modal.classList.contains('hidden')) return;
	}

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

	initImageEditor(file, (croppedBlob) => {
		handleCroppedImage(croppedBlob, file.name);
	});
}

/**
 * Fetches an image from a URL and opens it in the Image Editor.
 * @param {string} url - The image URL
 * @param {string} filename - The filename to use (metadata only)
 */
function processImageUrl(url, filename = 'imported_cover.jpg') {
	if (!url) return;

	initImageEditor(url, (croppedBlob) => {
		handleCroppedImage(croppedBlob, filename);
	});
}

// Window Bindings
window.processImageUrl = processImageUrl;

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
 * Determines which wizard steps should be skipped based on user settings and current form values.
 * @returns {number[]} Array of skipped step numbers
 */
export function getSkippedSteps() {
	const type = document.getElementById('type')?.value || '';
	const status = document.getElementById('status')?.value || '';

	const skipped = [];

	// Step 1 & 2 Auto-Skip Support
	// Get available options from state
	const disabledStatuses = state.appSettings?.disabledStatuses || [];
	const availableStatuses = ['Planning', 'Reading/Watching', 'Dropped', 'On Hold', 'Anticipating', 'Completed'].filter(s => !disabledStatuses.includes(s));

	// Skip Step 2 if only one status exists
	if (availableStatuses.length === 1) {
		skipped.push(2);
	}

	// Similar check for Type (Step 1) if we are navigating BACK?
	const disabledTypes = state.appSettings?.disabledTypes || [];
	const availableTypes = ['Anime', 'Manga', 'Book', 'Movie', 'Series'].filter(t => !disabledTypes.includes(t));
	if (availableTypes.length === 1) {
		skipped.push(1);
	}

	// Step 3 (Basic Info): Skip if ALL fields are hidden
	const step3Fields = ['title', 'authors', 'tags', 'universe', 'release_date', 'technical_stats', 'alternate_titles', 'abbreviations', 'series'];
	const step3Visible = step3Fields.some(f => isFieldVisible(f));
	if (!step3Visible) skipped.push(3);

	// Step 4 (Cover Image): Skip if cover_image is hidden
	if (!isFieldVisible('cover_image')) {
		skipped.push(4);
	}

	// Step 5 (Description): Skip if description is hidden
	if (!isFieldVisible('description')) {
		skipped.push(5);
	}

	// Step 6 (External Links): Skip if external_links is hidden
	if (!isFieldVisible('external_links')) {
		skipped.push(6);
	}

	// Step 7 (Progress): Skip for Planning/Completed statuses OR if progress is hidden
	if (status === 'Planning' || status === 'Completed' || !isFieldVisible('progress')) {
		skipped.push(7);
	}

	// Step 8 (Review & Rating): Skip for Planning status OR if both rating and review are hidden
	const reviewFields = ['rating', 'review', 'reread_count', 'completed_at'];
	const step8Visible = reviewFields.some(f => isFieldVisible(f));
	if (status === 'Planning' || !step8Visible) {
		skipped.push(8);
	}

	// Step 9 (Notes): Skip if notes is hidden
	if (!isFieldVisible('notes')) {
		skipped.push(9);
	}

	// Step 10 (Technical Stats / Seasons/Volumes): Skip if both technical_stats is hidden
	// AND (series_number is hidden OR type doesn't support children)
	const hasChildItems = ['Book', 'Series', 'Anime'].includes(type);
	const showForStats = isFieldVisible('technical_stats');
	const showForChildren = isFieldVisible('series_number') && hasChildItems;
	if (!showForStats && !showForChildren) {
		skipped.push(10);
	}

	// Step 11 (Privacy): Skip if not in hidden mode
	if (!state.isHidden) {
		skipped.push(11);
	}

	// Step 12 (Calendar): Skip if not Planning/Anticipating OR Calendar feature disabled
	const canHaveCalendar = ['Planning', 'Anticipating'].includes(status) && !state.appSettings.disabledFeatures?.includes('calendar');
	if (!canHaveCalendar) {
		skipped.push(12);
	}

	return [...new Set(skipped)]; // Remove duplicates
}

/**
 * Calculates the next valid step, skipping hidden ones.
 * @param {number} current - Current step
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
 * Calculates the previous valid step, skipping hidden ones.
 * @param {number} current - Current step
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
 * @param {number} from - Current step
 * @param {number} to - Target step
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

	updateDots(to);
	updateNavigationButtons(to);

	// Update links on step 6
	if (to === 6) updateDynamicLinks();
	// Render children on step 10
	if (to === 10 && window.renderChildren) window.renderChildren();

	// Auto-trigger Image Editor if an external URL was imported
	if (to === 4) {
		const previewImg = document.getElementById('previewImg');
		if (previewImg && previewImg.dataset.externalUrl) {
			processImageUrl(previewImg.dataset.externalUrl);
			delete previewImg.dataset.externalUrl;
		}
	}

	document.getElementById('stepIndicator').innerText = `Step ${to} / ${state.TOTAL_STEPS}`;

	setTimeout(() => {
		fromEl.classList.add('hidden');
		fromEl.style.display = 'none';
		removeAnimationClasses(fromEl);
		removeAnimationClasses(toEl);

		// Reset scroll position
		const wrapper = document.getElementById('formScrollWrapper');
		if (wrapper) wrapper.scrollTop = 0;

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

	updateDots(step);
	updateNavigationButtons(step);

	// Auto-trigger Image Editor if an external URL was imported
	if (step === 4) {
		const previewImg = document.getElementById('previewImg');
		if (previewImg && previewImg.dataset.externalUrl) {
			processImageUrl(previewImg.dataset.externalUrl);
			delete previewImg.dataset.externalUrl;
		}
	}
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
 * Validates the current wizard step before proceeding.
 * @param {number} step - Step number to validate
 * @returns {boolean} True if step is valid
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
		case 3: // Basic Info
			if (isFieldVisible('title') && !document.getElementById('title').value.trim()) {
				showToast('Title is required to proceed.', 'warning');
				return false;
			}
			break;
		case 12: // Calendar
			if (document.getElementById('addToCalendar')?.checked && !document.getElementById('calDate').value) {
				showToast('Please select a start date for the event.', 'warning');
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
 * Updates form field visibility based on app settings.
 * Marks steps as skippable and toggles individual field visibility.
 */
export function updateFormUI() {
	const type = document.getElementById('type').value;
	const status = document.getElementById('status').value;

	const toggleField = (el, show) => {
		if (!el) return;
		el.classList.toggle('hidden', !show);
	};

	const markStepSkipped = (id, shouldSkip) => {
		const el = document.getElementById(id);
		if (el) el.dataset.settingsSkipped = shouldSkip ? 'true' : 'false';
	};

	// Mark steps as skippable based on settings
	markStepSkipped('step-4', !isFieldVisible('cover_image'));
	markStepSkipped('step-5', !isFieldVisible('description'));
	markStepSkipped('step-6', !isFieldVisible('external_links'));

	const showProgress = isFieldVisible('progress') && status !== 'Planning' && status !== 'Completed';
	markStepSkipped('step-7', !showProgress);

	const reviewFields = ['rating', 'review', 'reread_count', 'completed_at'];
	const hasAnyReviewField = reviewFields.some(f => isFieldVisible(f));
	const showReview = hasAnyReviewField && status !== 'Planning';
	markStepSkipped('step-8', !showReview);

	markStepSkipped('step-9', !isFieldVisible('notes'));

	const hasChildItems = ['Book', 'Series', 'Anime'].includes(type);
	const showForStats = isFieldVisible('technical_stats');
	const showForChildren = isFieldVisible('series_number') && hasChildItems;
	markStepSkipped('step-10', !showForStats && !showForChildren);

	markStepSkipped('step-11', !state.isHidden);

	// Toggle individual field visibility within steps

	// Step 4 Fields
	const titleContainer = document.getElementById('titleContainer');
	if (titleContainer) titleContainer.classList.toggle('hidden', !isFieldVisible('title'));

	const authorContainer = document.getElementById('authorTagsContainer')?.parentElement;
	if (authorContainer) authorContainer.classList.toggle('hidden', !isFieldVisible('authors'));

	const universeField = document.getElementById('universe')?.parentElement;
	if (universeField) universeField.classList.toggle('hidden', !isFieldVisible('universe'));

	const tagContainer = document.getElementById('tagTagsContainer')?.parentElement;
	if (tagContainer) tagContainer.classList.toggle('hidden', !isFieldVisible('tags'));

	const releaseDateContainer = document.getElementById('releaseDateContainer');
	if (releaseDateContainer) releaseDateContainer.classList.toggle('hidden', !isFieldVisible('release_date'));

	const seriesWrapper = document.getElementById('seriesWrapper');
	if (seriesWrapper) seriesWrapper.classList.toggle('hidden', !isFieldVisible('series'));

	const altTitleContainer = document.getElementById('altTitleTagsContainer')?.parentElement;
	if (altTitleContainer) altTitleContainer.classList.toggle('hidden', !isFieldVisible('alternate_titles'));

	const abbrContainer = document.getElementById('disableAbbr')?.closest('.space-y-2');
	if (abbrContainer) abbrContainer.classList.toggle('hidden', !isFieldVisible('abbreviations'));

	// Step 8 Fields
	const rereadContainer = document.getElementById('rereadCountContainer');
	if (rereadContainer) rereadContainer.classList.toggle('hidden', !isFieldVisible('reread_count'));

	const completedAtContainer = document.getElementById('completedAtContainer');
	if (completedAtContainer) completedAtContainer.classList.toggle('hidden', !isFieldVisible('completed_at'));

	const ratingWrapper = document.getElementById('rating')?.closest('.relative');
	if (ratingWrapper) ratingWrapper.parentElement?.classList.toggle('hidden', !isFieldVisible('rating'));

	const reviewWrapper = document.getElementById('reviewWrapper');
	if (reviewWrapper) reviewWrapper.classList.toggle('hidden', !isFieldVisible('review'));

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

	// Update totals UI based on type
	if (window.updateTotalsUIForType) window.updateTotalsUIForType();

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

	const disabledTypes = state.appSettings?.disabledTypes || [];
	const currentType = document.getElementById('type')?.value || '';

	const types = ['Anime', 'Manga', 'Book', 'Movie', 'Series']
		.filter(type => {
			// Always show the currently selected type (for edit mode)
			if (currentType === type) return true;
			// Hide if in disabled list
			return !disabledTypes.includes(type);
		});

	container.innerHTML = types
		.map((type, i) => {
			// For the last item, span 2 cols to center it, but restrict width to match others (50% - half gap)
			// Only apply this if we have an odd number of items
			const isLast = i === types.length - 1;
			const isOdd = types.length % 2 !== 0;

			const extra = (isLast && isOdd)
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

	const disabledStatuses = state.appSettings?.disabledStatuses || [];
	const currentStatus = document.getElementById('status')?.value || '';

	const visibleStatuses = STATUS_TYPES.filter(status => {
		// Always show currently selected status
		if (currentStatus === status) return true;
		// Hide if disabled
		return !disabledStatuses.includes(status);
	});

	container.innerHTML = visibleStatuses.map(status => createStatusCardHtml(status)).join('');
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
// SELECTION HANDLERS
// =============================================================================

/**
 * Handles media type selection.
 * @param {string} t - Selected type
 */
export function selectType(t) {
	const current = document.getElementById('type').value;
	if (current === t && state.isEditMode) return;

	if (!state.isEditMode || t !== current) {
		resetWizardFields(1);
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
	updateFormUI(); // Apply field visibility
	triggerDuplicateCheck(); // Check for duplicates with new type

	// Auto-fill Status if only 1 available (and not in edit mode to avoid overriding existing)
	if (!state.isEditMode) {
		const disabledStatuses = state.appSettings?.disabledStatuses || [];
		const availableStatuses = ['Planning', 'Reading/Watching', 'Dropped', 'On Hold', 'Anticipating', 'Completed'].filter(s => !disabledStatuses.includes(s));
		if (availableStatuses.length === 1) {
			const singleStatus = availableStatuses[0];
			document.getElementById('status').value = singleStatus;
			selectStatusVisuals(singleStatus);
			// Also update form UI again as status affects visibility of some fields
			updateFormUI();
		}
	}

	if (state.isEditMode) {
		// Already called updateFormUI above
	} else {
		// Auto-advance
		setTimeout(() => window.nextStep(), 400);
	}
}

/**
 * Handles status selection.
 * @param {string} s - Selected status
 */
export function selectStatus(s) {
	const current = document.getElementById('status').value;
	if (current === s && !state.isEditMode) {
		window.nextStep();
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

	updateFormUI(); // Apply field visibility for all modes

	if (!state.isEditMode) {
		setTimeout(() => window.nextStep(), 300);
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


// =============================================================================
// CALENDAR & RECURRENCE HELPERS (Step 12)
// =============================================================================

/**
 * Toggles the visibility of the calendar event fields.
 * @param {boolean} show - Whether to show the fields.
 */
window.toggleCalendarFields = (show) => {
	const el = document.getElementById('calendarFields');
	if (el) {
		el.classList.toggle('hidden', !show);
		el.classList.add('animate-enter');

		if (show) {
			const releaseDate = document.getElementById('releaseDate').value;
			const calDate = document.getElementById('calDate');
			if (calDate && !calDate.value && releaseDate) {
				calDate.value = releaseDate;
			}
		}
	}
};

/**
 * Toggles the visibility of the calendar recurrence fields.
 * @param {boolean} show - Whether to show the fields.
 */
window.toggleRecurrenceFields = (show) => {
	const el = document.getElementById('calRecurrenceFields');
	if (el) {
		el.classList.toggle('hidden', !show);
	}
};
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

	// Apply field visibility from settings
	updateFormUI();

	// Check for Single Options (Auto-Select)
	const disabledTypes = state.appSettings?.disabledTypes || [];
	const availableTypes = ['Anime', 'Manga', 'Book', 'Movie', 'Series'].filter(t => !disabledTypes.includes(t));

	const disabledStatuses = state.appSettings?.disabledStatuses || [];
	const availableStatuses = ['Planning', 'Reading/Watching', 'Dropped', 'On Hold', 'Anticipating', 'Completed'].filter(s => !disabledStatuses.includes(s));

	let startStep = 1;

	// Auto-select Type if only 1 available
	if (availableTypes.length === 1) {
		const type = availableTypes[0];
		document.getElementById('type').value = type;
		// Trigger UI updates normally handled by selectType
		updateDynamicLinks(type);
		selectTypeVisuals(type);
		updateWizardUI();

		// Move start to next step
		startStep = 2;
	}

	// Auto-select Status if only 1 available
	if (availableStatuses.length === 1) {
		const status = availableStatuses[0];
		document.getElementById('status').value = status;
		selectStatusVisuals(status);

		// If we also skipped type, move to 3
		if (startStep === 2) startStep = 3;
	}

	// Apply the determined start step

	if (startStep > 1) {
		state.currentStep = startStep;
		state.maxReachedStep = startStep;
	}

	showStep(state.currentStep);
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
	restore('step-3', topClasses);    // Basic Info
	restore('step-4', centerClasses); // Cover
	restore('step-5', centerClasses); // Description (TextArea fits well in center)
	restore('step-6', topClasses);
	restore('step-7', centerClasses); // Progress (Small inputs)
	restore('step-8', centerClasses); // Review (Stars + Text)
	restore('step-9', centerClasses); // Notes
	restore('step-10', topClasses);
	restore('step-11', centerClasses);
}

/**
 * Resets wizard fields starting from a specific step (used when changing media type or search online).
 * @param {number} [startStep=1] - Step to start resetting from
 */
export function resetWizardFields(startStep = 1) {
	// Step 2: Status
	if (startStep <= 2) {
		safeVal('status', '');
	}

	// Step 3: Basic Information
	if (startStep <= 3) {
		safeVal('title', '');
		state.currentAuthors = [];
		state.currentAlternateTitles = [];
		state.currentTags = [];
		state.currentAbbreviations = [];
		safeVal('universe', '');
		safeVal('series', '');
		safeVal('seriesNumber', '');
		safeVal('releaseDate', '');

		// Reset Inputs with Tags
		safeHtml('authorTagsContainer', '<input id="authorInput" list="authorOptions" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Type & Enter...">');
		safeHtml('tagTagsContainer', '<input id="tagInput" list="tagOptions" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Add Tags...">');
		safeHtml('altTitleTagsContainer', '<input id="altTitleInput" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Type & Enter...">');
		safeHtml('abbrTagsContainer', '<input id="abbrInput" class="bg-transparent text-sm outline-none flex-1 min-w-[80px] text-zinc-700 dark:text-zinc-200 p-1 placeholder-zinc-400" placeholder="Auto-filled from title...">');

		// Re-attach listeners for dynamically recreated inputs
		setTimeout(() => {
			['authorInput', 'tagInput', 'altTitleInput', 'abbrInput'].forEach(id => {
				const input = document.getElementById(id);
				const type = id.replace('Input', '');
				if (input && window.checkEnterKey) input.addEventListener('keydown', (e) => window.checkEnterKey(e, type === 'abbr' ? 'abbr' : (type === 'altTitle' ? 'altTitle' : type)));
			});
			// Reinitialize tag autocomplete dropdown (it was destroyed when tagTagsContainer was reset)
			if (window.renderGenericTags) window.renderGenericTags();
		}, 0);
	}

	// Step 4: Cover Image
	if (startStep <= 4) {
		safeVal('coverUrl', '');
		safeHtml('coverPreview', '<div class="text-zinc-500 font-medium">No Image Selected</div>');
		safeVal('coverImage', '');
		// Reset Preview UI elements (from handleCroppedImage)
		const prevImg = document.getElementById('previewImg');
		if (prevImg) {
			prevImg.src = '';
			prevImg.classList.add('hidden');
		}
		const placeholder = document.getElementById('previewPlaceholder');
		if (placeholder) placeholder.classList.remove('hidden');
		const nameEl = document.getElementById('currentCoverName');
		if (nameEl) nameEl.innerText = '';
	}

	// Step 5: Description
	if (startStep <= 5) {
		safeVal('description', '');
	}

	// Step 6: External Links
	if (startStep <= 6) {
		state.currentLinks = [];
		safeHtml('linksContainer', '');
		safeHtml('dynamicLinkButtons', '');
	}

	// Step 7: Progress
	if (startStep <= 7) {
		safeVal('progress', '');
	}

	// Step 8: Review & Rating
	if (startStep <= 8) {
		safeVal('review', '');
		safeVal('rating', 2);
		safeVal('rereadCount', 0);
		safeVal('completedAt', '');
		if (window.updateRatingVisuals) window.updateRatingVisuals(2);
	}

	// Step 9: Notes
	if (startStep <= 9) {
		safeVal('notes', '');
	}

	// Step 10: Seasons / Volumes / Stats
	if (startStep <= 10) {
		state.currentChildren = [];
		safeHtml('childrenContainer', '');
		safeVal('episodeCount', '');
		safeVal('volumeCount', '');
		safeVal('chapterCount', '');
		safeVal('wordCount', '');
		safeVal('avgDurationMinutes', '');
		safeCheck('overrideTotals', false);
		if (window.toggleTotalsOverride) window.toggleTotalsOverride(false);
	}

	// Step 11: Privacy Setting
	if (startStep <= 11) {
		safeCheck('isHidden', false);
	}

	// Step 12: Calendar Event
	if (startStep <= 12) {
		safeCheck('addToCalendar', false);
		safeVal('calDate', '');
		safeVal('calContent', '');
		safeCheck('calRecurring', false);
		if (window.toggleCalendarFields) window.toggleCalendarFields(false);
	}
}


