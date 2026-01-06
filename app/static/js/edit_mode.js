/**
 * @fileoverview Edit mode logic for UpNext.
 * Contains functions for initializing and managing the edit interface.
 * @module edit_mode
 */

import { state } from './state.js';
import { safeCreateIcons, safeVal, safeText, safeCheck } from './dom_utils.js';
import {
	renderTypeSelection, renderStatusSelection, updateDynamicLinks,
	updateFormUI, selectTypeVisuals, selectStatusVisuals
} from './wizard_logic.js';

/**
 * Flag to prevent scroll spy from fighting with manual navigation.
 * @type {boolean}
 */
let isAutoScrolling = false;

/**
 * Timeout handle for clearing the auto-scrolling flag.
 * @type {number|null}
 */
let autoScrollTimeout = null;

/**
 * Observer for the scroll spy functionality.
 * @type {IntersectionObserver|null}
 */
let scrollSpyObserver = null;

/**
 * Initializes edit mode for an existing item.
 * @param {string} id - Item ID to edit
 */
export function initEditMode(id) {
	state.isEditMode = true;
	state.currentStep = 1;

	// Enable full screen & Scroll Mode
	const modalContent = document.getElementById('modalContent');
	const entryForm = document.getElementById('entryForm');
	const sidebar = document.getElementById('editSidebar');

	if (modalContent) modalContent.classList.add('full-screen-modal');
	if (entryForm) {
		entryForm.classList.add('scroll-mode');
		entryForm.classList.remove('h-full', 'overflow-hidden');
		entryForm.classList.add('h-auto');
	}

	if (sidebar) {
		sidebar.classList.remove('hidden');
		sidebar.classList.add('flex');
		sidebar.scrollTop = 0;
	}

	// Hide Wizard specific UI
	const wizardDots = document.getElementById('wizardDots');
	const prevBtn = document.getElementById('prevBtn');
	const nextBtn = document.getElementById('nextBtn');
	const stepIndicator = document.getElementById('stepIndicator');

	if (wizardDots) wizardDots.classList.add('hidden');
	if (prevBtn) prevBtn.classList.add('hidden');
	if (nextBtn) nextBtn.classList.add('hidden');
	if (stepIndicator) stepIndicator.innerText = '';

	// Configure Save Button
	const submitBtn = document.getElementById('submitBtn');
	if (submitBtn) {
		submitBtn.classList.remove('hidden');
		submitBtn.innerText = 'Save Changes';
	}

	// Render Form Content
	renderTypeSelection();
	renderStatusSelection();
	if (window.renderLinks) window.renderLinks();
	updateDynamicLinks();

	// Show all steps (CSS handles layout via .scroll-mode)
	document.querySelectorAll('.wizard-step').forEach(el => {
		el.classList.remove('hidden');
		el.style.display = '';
	});

	// Hide restricted steps (Privacy & Calendar) if applicable
	const privacyStep = document.getElementById('step-11');
	if (privacyStep && !state.isHidden) {
		privacyStep.classList.add('hidden');
		privacyStep.style.display = 'none';
	}

	const calendarStep = document.getElementById('step-12');
	if (calendarStep) {
		calendarStep.classList.add('hidden');
		calendarStep.style.display = 'none';
	}

	// UI Headers
	const item = state.items.find(i => i.id === id);
	const modalTitle = document.getElementById('modalTitle');
	if (modalTitle) modalTitle.innerText = item ? `Edit ${item.title}` : 'Edit Entry';
	document.querySelectorAll('.edit-only-header').forEach(el => el.classList.remove('hidden'));

	updateFormUI();

	// Set initial visuals
	const typeEl = document.getElementById('type');
	const statusEl = document.getElementById('status');
	if (typeEl) selectTypeVisuals(typeEl.value);
	if (statusEl) selectStatusVisuals(statusEl.value);

	initScrollSpy();
	renderSidebarNav();
}

/**
 * Renders the sidebar navigation for edit mode.
 */
export function renderSidebarNav() {
	const nav = document.getElementById('editSidebarNav');
	if (!nav) return;

	const type = document.getElementById('type')?.value || 'Anime';
	let step10Label = 'Seasons & Stats';

	if (type === 'Movie' || type === 'Manga') {
		step10Label = 'Technical Stats';
	} else if (type === 'Book') {
		step10Label = 'Volumes & Stats';
	}

	const sections = [
		{ id: 'step-1', label: 'Media Type', icon: 'monitor' },
		{ id: 'step-2', label: 'Status', icon: 'activity' },
		{ id: 'step-3', label: 'Basic Info', icon: 'file-text' },
		{ id: 'step-4', label: 'Cover Image', icon: 'image' },
		{ id: 'step-5', label: 'Description', icon: 'align-left' },
		{ id: 'step-6', label: 'External Links', icon: 'link' },
		{ id: 'step-7', label: 'Progress', icon: 'bookmark' },
		{ id: 'step-8', label: 'Review & Rating', icon: 'star' },
		{ id: 'step-9', label: 'Notes', icon: 'sticky-note' },
		{ id: 'step-10', label: step10Label, icon: 'layers' },
		{ id: 'step-11', label: 'Privacy', icon: 'shield' }
	];

	nav.innerHTML = sections.map(sec => `
        <button onclick="scrollToSection('${sec.id}')" id="nav-${sec.id}" class="sidebar-link group">
            <i data-lucide="${sec.icon}" class="w-4 h-4 opacity-70 group-hover:opacity-100"></i> ${sec.label}
        </button>
    `).join('');

	safeCreateIcons();
	updateSidebarVisibility();
}

/**
 * Scrolls to the specific section in edit mode and centers it.
 * Disables scroll spy temporarily to avoid state conflicts.
 * @param {string} id - Target section element ID
 */
export function scrollToSection(id) {
	const el = document.getElementById(id);
	if (el) {
		isAutoScrolling = true;
		if (autoScrollTimeout) clearTimeout(autoScrollTimeout);

		el.scrollIntoView({ behavior: 'smooth', block: 'center' });

		// Immediate UI feedback
		document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
		const navLink = document.getElementById(`nav-${id}`);
		if (navLink) navLink.classList.add('active');

		// Re-enable spy after transition
		autoScrollTimeout = setTimeout(() => {
			isAutoScrolling = false;
		}, 800);
	}
}

/**
 * Handles keyboard navigation (Next/Prev) through sections.
 * @param {number} direction - 1 for next, -1 for prev
 */
export function navigateSection(direction) {
	const links = Array.from(document.querySelectorAll('.sidebar-link:not(.hidden)'));
	const activeIndex = links.findIndex(l => l.classList.contains('active'));

	let targetIndex = -1;
	if (activeIndex !== -1) {
		targetIndex = activeIndex + direction;
	} else if (direction === 1 && links.length > 0) {
		targetIndex = 0;
	}

	if (targetIndex >= 0 && targetIndex < links.length) {
		const targetId = links[targetIndex].id.replace('nav-', '');
		scrollToSection(targetId);
	}
}

// Global exposure for shortcut handlers
window.navigateEditSection = navigateSection;

/**
 * Updates sidebar navigation visibility based on field-level visibility.
 */
export function updateSidebarVisibility() {
	const nav = document.getElementById('editSidebarNav');
	if (!nav) return;

	Array.from(nav.children).forEach(btn => {
		const sectionId = btn.id.replace('nav-', '');
		const section = document.getElementById(sectionId);
		const isHidden = section && (section.classList.contains('hidden') || section.style.display === 'none');

		if (isHidden) {
			btn.classList.add('hidden');
		} else {
			btn.classList.remove('hidden');
		}
	});
}

/**
 * Initializes the intersection observer for highlighting the sidebar based on scroll position.
 */
function initScrollSpy() {
	if (scrollSpyObserver) scrollSpyObserver.disconnect();

	const options = {
		root: document.getElementById('formScrollWrapper'),
		threshold: 0,
		rootMargin: "-5% 0px -45% 0px"
	};

	scrollSpyObserver = new IntersectionObserver((entries) => {
		if (isAutoScrolling) return;

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
 * Populates form fields from an existing item object.
 * @param {string} id - Item ID to load
 */
export function populateFormFromItem(id) {
	const item = state.items.find(i => i.id === id);
	if (!item) return;

	// Basic identity & metadata
	safeVal('itemId', item.id);
	safeVal('title', item.title);
	safeVal('type', item.type);
	safeVal('status', item.status);
	safeVal('universe', item.universe || '');
	safeVal('series', item.series || '');
	safeVal('seriesNumber', item.seriesNumber || '');
	safeVal('releaseDate', item.releaseDate ? item.releaseDate.split('T')[0] : '');
	safeVal('description', item.description || '');
	safeVal('notes', item.notes || '');
	safeVal('review', item.review || '');
	safeVal('progress', item.progress || '');
	safeVal('rereadCount', item.rereadCount || 0);
	safeVal('completedAt', item.completedAt ? item.completedAt.split('T')[0] : '');

	// Counters & Technical Stats
	safeVal('episodeCount', item.episodeCount || '');
	safeVal('volumeCount', item.volumeCount || '');
	safeVal('chapterCount', item.chapterCount || '');
	safeVal('wordCount', item.wordCount || '');
	safeVal('avgDurationMinutes', item.avgDurationMinutes || '');

	// Rating UI
	const rVal = item.rating || 2;
	safeVal('rating', rVal);
	if (window.updateRatingVisuals) window.updateRatingVisuals(rVal);

	// Media Preview
	if (item.coverUrl) {
		safeText('currentCoverName', item.coverUrl);
		const img = document.getElementById('previewImg');
		const ph = document.getElementById('previewPlaceholder');
		if (img) {
			img.src = `/images/${item.coverUrl}`;
			img.classList.remove('hidden');
		}
		if (ph) ph.classList.add('hidden');
	}

	// Dynamic Collections
	safeCheck('isHidden', item.isHidden || false);
	state.currentAuthors = item.authors || (item.author ? [item.author] : []);
	state.currentTags = item.tags || [];
	state.currentAlternateTitles = item.alternateTitles || [];
	state.currentChildren = item.children || [];
	state.currentLinks = item.externalLinks || [];
	state.currentAbbreviations = item.abbreviations || [];

	if (window.renderGenericTags) window.renderGenericTags();
	if (window.renderAbbrTags) window.renderAbbrTags();
}

