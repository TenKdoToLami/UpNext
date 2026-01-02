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
	if (window.renderLinks) window.renderLinks();
	updateDynamicLinks();

	// Show all steps (CSS handles layout via .scroll-mode)
	document.querySelectorAll('.wizard-step').forEach(el => {
		el.classList.remove('hidden');
		el.style.display = ''; // Clear inline display from wizard mode
	});

	// Hide privacy step (11) if not in hidden mode - this is edit mode specific
	const privacyStep = document.getElementById('step-11');
	if (privacyStep && !state.isHidden) {
		privacyStep.classList.add('hidden');
		privacyStep.style.display = 'none';
	}

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
export function renderSidebarNav() {
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

/**
 * Scrolls to the specific section in edit mode.
 */
export function scrollToSection(id) {
	const el = document.getElementById(id);
	if (el) {
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });

		// Manually trigger highlight immediately for better responsiveness
		document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
		const navLink = document.getElementById(`nav-${id}`);
		if (navLink) navLink.classList.add('active');
	}
}

/**
 * Updates sidebar visibility based on visible sections.
 */
export function updateSidebarVisibility() {
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
 * Populates form fields from an existing item.
 * @param {string} id - Item ID
 */
export function populateFormFromItem(id) {
	const item = state.items.find(i => i.id === id);
	if (!item) return;

	safeVal('itemId', item.id);
	safeVal('title', item.title);
	safeVal('type', item.type);
	safeVal('status', item.status);
	safeVal('universe', item.universe || '');
	safeVal('series', item.series || '');
	safeVal('seriesNumber', item.seriesNumber || '');
	safeVal('releaseDate', item.releaseDate ? item.releaseDate.split('T')[0] : ''); // Handle ISO format
	safeVal('description', item.description || '');
	safeVal('notes', item.notes || '');
	safeVal('review', item.review || '');
	safeVal('progress', item.progress || '');
	safeVal('rereadCount', item.rereadCount || 0);
	safeVal('completedAt', item.completedAt ? item.completedAt.split('T')[0] : '');

	// Stats
	safeVal('episodeCount', item.episodeCount || '');
	safeVal('volumeCount', item.volumeCount || '');
	safeVal('pageCount', item.pageCount || '');
	safeVal('avgDurationMinutes', item.avgDurationMinutes || '');

	const rVal = item.rating || 2;
	safeVal('rating', rVal);
	// Manually trigger label update
	if (window.updateRatingVisuals) window.updateRatingVisuals(rVal);

	if (item.coverUrl) {
		safeText('currentCoverName', item.coverUrl);
		const img = document.getElementById('previewImg');
		const ph = document.getElementById('previewPlaceholder');
		if (img) { img.src = `/images/${item.coverUrl}`; img.classList.remove('hidden'); }
		if (ph) ph.classList.add('hidden');
	}

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
