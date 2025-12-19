/**
 * @fileoverview Wizard navigation and step management for UpNext.
 * Handles the multi-step form wizard for adding/editing entries.
 * @module wizard_logic
 */

import { state } from './state.js';
import {
	STEP_TITLES,
	LINK_SUGGESTIONS,
	TYPE_COLOR_MAP,
	STATUS_TYPES,
	STATUS_ICON_MAP,
	STATUS_COLOR_MAP,
	ICON_MAP
} from './constants.js';
import { safeCreateIcons } from './dom_utils.js';

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

	// Skip progress and rating for items not yet consumed
	if (status === 'Planning' || status === 'Reading/Watching') {
		skipped.push(4, 9);
	}
	// Skip progress for completed items
	if (status === 'Completed') {
		skipped.push(4);
	}
	// Skip seasons/volumes for non-series types
	if (['Manga', 'Movie'].includes(type) && status !== 'Planning') {
		skipped.push(10);
	}
	// Skip privacy step if not in hidden mode
	if (!state.isHidden) {
		skipped.push(11);
	}

	return skipped;
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
		if (input && to !== 1 && to !== 2) input.focus();
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

	return `<div ${onclick} class="w-2.5 h-2.5 rounded-full transition-all duration-300 ${stateClass} ${cursor}"></div>`;
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
		case 1:
			if (!document.getElementById('type').value) {
				alert('Please select a media type.');
				return false;
			}
			break;
		case 2:
			if (!document.getElementById('status').value) {
				alert('Please select a status.');
				return false;
			}
			break;
		case 3:
			if (!document.getElementById('title').value.trim()) {
				alert('Title is required.');
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

	// Progress: hide for Planning and Completed
	toggle('step-4', !(status === 'Planning' || status === 'Completed'));

	// Rating/Review: hide for items not yet consumed
	toggle('step-9', !(status === 'Planning' || status === 'Reading/Watching'));

	// Seasons/Volumes: hide for Manga/Movie unless Planning
	toggle('step-10', !(['Manga', 'Movie'].includes(type) && status !== 'Planning'));

	// Privacy: only show in hidden mode
	toggle('step-11', state.isHidden);

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
		seriesWrapper.style.display = ['Book', 'Movie', 'Series'].includes(type) ? 'block' : 'none';
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

	container.className = 'grid grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-3xl justify-center items-center';
	container.innerHTML = ['Anime', 'Manga', 'Book', 'Movie', 'Series']
		.map(type => createTypeCardHtml(type))
		.join('');

	safeCreateIcons();
}

/**
 * Creates HTML for a media type selection card.
 * @param {string} type - Media type
 * @returns {string} HTML string
 */
function createTypeCardHtml(type) {
	const rawClasses = TYPE_COLOR_MAP[type] || '';
	const color = rawClasses.match(/text-([a-z]+)-400/)?.[1] || 'zinc';
	const icon = ICON_MAP[type] || 'circle';

	return `
        <div onclick="window.selectType('${type}')" id="type-card-${type}" style="--theme-col: var(--col-${type.toLowerCase()})"
            class="selection-card aspect-square p-6 rounded-3xl flex flex-col items-center justify-center gap-4 group transition-all duration-300 cursor-pointer border-2 hover:scale-105 active:scale-95 shadow-xl relative overflow-hidden ${rawClasses}">
            <div class="absolute inset-0 bg-gradient-to-br from-${color}-500/10 to-transparent opacity-100 transition-opacity"></div>
            <div class="p-4 rounded-full bg-white dark:bg-zinc-900/50 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/80 transition-colors shadow-lg z-10 ring-1 ring-black/5 dark:ring-white/10">
                <i data-lucide="${icon}" class="w-10 h-10 transition-colors text-${color}-500 dark:text-${color}-400"></i>
            </div>
            <span class="font-bold uppercase tracking-widest text-sm z-10 text-${color}-600 dark:text-${color}-100">${type}</span>
        </div>
    `;
}

/**
 * Renders status selection cards.
 */
export function renderStatusSelection() {
	const container = document.getElementById('statusSelectionContainer');
	if (!container) return;

	container.className = 'grid grid-cols-2 gap-4 w-full h-full p-4 pb-12';
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
        <div onclick="window.selectStatus('${status}')" id="status-card-${safeId}" style="--theme-col: var(--col-${statusVarName})"
            class="selection-card w-full h-full p-4 rounded-2xl flex flex-row items-center justify-start gap-4 group transition-all duration-300 cursor-pointer border-2 hover:scale-[1.02] shadow-xl relative overflow-hidden ${rawClass || 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}">
            <div class="absolute inset-0 bg-gradient-to-r from-transparent to-${color}-500/10 opacity-100 transition-opacity"></div>
            <div class="p-3 rounded-full bg-white dark:bg-zinc-900/50 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900/80 transition-colors shadow-lg z-10 ring-1 ring-black/5 dark:ring-white/10 shrink-0">
                <i data-lucide="${icon}" class="w-6 h-6 transition-colors text-${color}-500 dark:text-${color}-400"></i>
            </div>
            <span class="font-bold uppercase tracking-wider text-[10px] sm:text-xs z-10 text-left text-${color}-600 dark:text-${color}-100 break-words leading-tight w-full pr-2">${status}</span>
        </div>
    `;
}
