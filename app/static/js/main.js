/**
 * @fileoverview Main entry point for UpNext application.
 * Handles global event bindings, filter/view controls, and application initialization.
 * @module main
 */

import { state } from './state.js';
import { loadItems, deleteItem, saveItem } from './api_service.js';
import { renderFilters, renderGrid, updateGridTruncation } from './render_utils.js';
import { safeCreateIcons, toggleExpand, debounce } from './dom_utils.js';
import { RATING_LABELS, TEXT_COLORS } from './constants.js';
import {
    openModal, closeModal, nextStep, prevStep, jumpToStep, selectType, selectStatus,
    populateAutocomplete, addSpecificLink, addLink, removeLink, updateLink, pasteLink,
    removeAuthor, addChild, removeChildIdx, updateChild, updateChildRating,
    removeAltTitle, checkEnterKey, renderDetailView, updateDetailTruncation, updateRatingVisuals,
    renderAbbrTags, removeAbbreviation, toggleAbbrField, generateAbbreviation
} from './main_helpers.js';
import { updateWizardUI } from './wizard_logic.js';
import {
    openExportModal, closeExportModal, triggerExport,
    selectExportCategory, backToExportCategories,
    updateExportOptions, toggleVisualField,
    toggleExportTypeFilter, toggleExportStatusFilter, toggleExportRatingFilter
} from './export_utils.js';

// =============================================================================
// GLOBAL WINDOW BINDINGS
// =============================================================================

// State & Utilities
window.state = state;
window.toggleExpand = toggleExpand;
window.loadItems = loadItems;

/**
 * Toggles the application theme between light and dark.
 */
window.toggleTheme = () => {
    const html = document.documentElement;
    if (state.theme === 'dark') {
        html.classList.remove('dark');
        state.theme = 'light';
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        state.theme = 'dark';
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcon();
    // Re-render stats if modal is open to update chart colors
    if (!document.getElementById('statsModal').classList.contains('hidden')) {
        if (window.openStatsModal) window.openStatsModal();
    }
};

function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        if (state.theme === 'dark') {
            icon.setAttribute('data-lucide', 'sun');
        } else {
            icon.setAttribute('data-lucide', 'moon');
        }
        safeCreateIcons();
    }
}

// Initialize Theme
(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') {
        document.documentElement.classList.remove('dark');
        state.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        state.theme = 'dark';
    }
})();

// Export functions
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.triggerExport = triggerExport;
window.selectExportCategory = selectExportCategory;
window.backToExportCategories = backToExportCategories;
window.updateExportOptions = updateExportOptions;
window.toggleVisualField = toggleVisualField;
window.toggleExportTypeFilter = toggleExportTypeFilter;
window.toggleExportStatusFilter = toggleExportStatusFilter;
window.toggleExportRatingFilter = toggleExportRatingFilter;

// Modal & Wizard functions
window.openModal = openModal;
window.closeModal = closeModal;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.jumpToStep = jumpToStep;
window.selectType = selectType;
window.selectStatus = selectStatus;

// Form helpers
window.addSpecificLink = addSpecificLink;
window.addLink = addLink;
window.removeLink = removeLink;
window.updateLink = updateLink;
window.pasteLink = pasteLink;
window.removeAuthor = removeAuthor;
window.addChild = addChild;
window.removeChildIdx = removeChildIdx;
window.updateChild = updateChild;
window.updateChildRating = updateChildRating;
window.removeAltTitle = removeAltTitle;
window.removeAbbreviation = removeAbbreviation;
window.toggleAbbrField = toggleAbbrField;

// =============================================================================
// FILTER HANDLERS
// =============================================================================

/**
 * Sets the media type filter.
 * @param {string} type - Type to filter by ('All' for no filter)
 */
window.setFilterType = (type) => {
    if (state.isMultiSelect) {
        if (type === 'All') {
            state.filterTypes = ['All'];
        } else {
            if (state.filterTypes.includes('All')) state.filterTypes = [];
            if (state.filterTypes.includes(type)) {
                state.filterTypes = state.filterTypes.filter(t => t !== type);
                if (state.filterTypes.length === 0) state.filterTypes = ['All'];
            } else {
                state.filterTypes.push(type);
                // If all types are selected, switch back to 'All'
                // There are 5 media types.
                if (state.filterTypes.length >= 5) state.filterTypes = ['All'];
            }
        }
    } else {
        state.filterTypes = [type];
    }
    renderFilters();
    renderGrid();
};

/**
 * Sets the status filter.
 * @param {string} status - Status to filter by ('All' for no filter)
 */
window.setFilterStatus = (status) => {
    if (state.isMultiSelect) {
        if (status === 'All') {
            state.filterStatuses = ['All'];
        } else {
            if (state.filterStatuses.includes('All')) state.filterStatuses = [];
            if (state.filterStatuses.includes(status)) {
                state.filterStatuses = state.filterStatuses.filter(s => s !== status);
                if (state.filterStatuses.length === 0) state.filterStatuses = ['All'];
            } else {
                state.filterStatuses.push(status);
                // If all statuses are selected, switch back to 'All'
                // STATUS_TYPES has 6 items.
                if (state.filterStatuses.length >= 6) state.filterStatuses = ['All'];
            }
        }
    } else {
        state.filterStatuses = [status];
    }
    state.filterRatings = [];
    renderFilters();
    renderGrid();
};

/**
 * Sets the rating filter.
 * @param {string|number} r - Rating to filter by ('Any' for no filter)
 */
window.setFilterRating = (r) => {
    if (r === 'Any') {
        state.filterRatings = [];
    } else if (state.isMultiSelect) {
        if (state.filterRatings.includes(r)) {
            state.filterRatings = state.filterRatings.filter(v => v !== r);
        } else {
            state.filterRatings.push(r);
        }
        if (state.filterRatings.length === 4) state.filterRatings = [];
    } else {
        if (state.filterRatings.includes(r) && state.filterRatings.length === 1) {
            state.filterRatings = [];
        } else {
            state.filterRatings = [r];
        }
    }
    renderFilters();
    renderGrid();
};

// =============================================================================
// SORT HANDLERS
// =============================================================================

window.setSortBy = (field) => { state.sortBy = field; renderFilters(); renderGrid(); };
window.setSortOrder = (order) => { state.sortOrder = order; renderFilters(); renderGrid(); };

// =============================================================================
// VIEW MODE HANDLERS
// =============================================================================

/**
 * Sets the view mode (grid or list).
 * @param {'grid'|'list'} mode - View mode
 */
window.setViewMode = (mode) => {
    state.viewMode = mode;
    const btnGrid = document.getElementById('view-grid');
    const btnList = document.getElementById('view-list');

    if (mode === 'grid') {
        btnGrid.className = 'p-1.5 rounded-lg bg-zinc-200 text-black shadow-sm transition-all';
        btnList.className = 'p-1.5 rounded-lg text-zinc-500 hover:text-white transition-all';
        document.getElementById('gridContainer').className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 pb-20 animate-enter';
    } else {
        btnList.className = 'p-1.5 rounded-lg bg-zinc-200 text-black shadow-sm transition-all';
        btnGrid.className = 'p-1.5 rounded-lg text-zinc-500 hover:text-white transition-all';
        document.getElementById('gridContainer').className = 'flex flex-col gap-4 pb-20 animate-enter max-w-4xl mx-auto';
    }
    renderGrid();
};

// =============================================================================
// TOGGLE HANDLERS
// =============================================================================

/** Toggles multi-select mode for filters. */
window.toggleMultiSelect = () => {
    state.isMultiSelect = !state.isMultiSelect;
    const btn = document.getElementById('multiSelectBtn');
    const indicator = document.getElementById('multiSelectIndicator');

    if (state.isMultiSelect) {
        btn.classList.add('text-white', 'bg-white/10');
        btn.classList.remove('text-zinc-500');
        indicator.classList.remove('hidden');
    } else {
        btn.classList.remove('text-white', 'bg-white/10');
        btn.classList.add('text-zinc-500');
        indicator.classList.add('hidden');
        if (state.filterTypes.length > 1) state.filterTypes = ['All'];
        if (state.filterStatuses.length > 1) state.filterStatuses = ['All'];
        state.filterRatings = [];
        renderFilters();
        renderGrid();
    }
};

/** Toggles hidden items visibility. */
window.toggleHidden = () => {
    state.isHidden = !state.isHidden;
    const btn = document.getElementById('hiddenBtn');
    const indicator = document.getElementById('hiddenIndicator');
    const hiddenOnlyBtn = document.getElementById('hiddenOnlyBtn');

    if (state.isHidden) {
        btn.classList.add('text-red-400', 'bg-red-500/10');
        btn.classList.remove('text-zinc-500');
        indicator.classList.remove('hidden');
        if (hiddenOnlyBtn) hiddenOnlyBtn.classList.remove('hidden');
    } else {
        btn.classList.remove('text-red-400', 'bg-red-500/10');
        btn.classList.add('text-zinc-500');
        indicator.classList.add('hidden');
        if (hiddenOnlyBtn) hiddenOnlyBtn.classList.add('hidden');
        if (state.filterHiddenOnly) window.toggleHiddenOnly();
    }
    renderFilters();
    renderGrid();
};


/** Toggles expanded details view. */
window.toggleDetails = () => {
    state.showDetails = !state.showDetails;
    const btn = document.getElementById('detailsBtn');
    const indicator = document.getElementById('detailsIndicator');

    if (state.showDetails) {
        btn.classList.add('text-white', 'bg-white/10');
        btn.classList.remove('text-zinc-500');
        indicator.classList.remove('hidden');
    } else {
        btn.classList.remove('text-white', 'bg-white/10');
        btn.classList.add('text-zinc-500');
        indicator.classList.add('hidden');
    }
    renderGrid();
};

/** Toggles responsive search bar. */
window.toggleSearch = () => {
    const container = document.getElementById('searchBarContainer');
    const input = document.getElementById('searchInput');
    const isHidden = container.classList.contains('hidden');

    if (isHidden) {
        container.classList.remove('hidden');
        input.focus();
    } else {
        container.classList.add('hidden');
    }
};

/** Toggles responsive sort menu. */
window.toggleSortMenu = () => {
    const container = document.getElementById('sortMenuContainer');
    const btn = document.getElementById('sortMobileToggle');
    const indicator = document.getElementById('sortActiveIndicator');

    container.classList.toggle('hidden');
    container.classList.toggle('flex');

    const isOpen = !container.classList.contains('hidden');

    if (isOpen) {
        btn.classList.add('bg-black/5', 'dark:bg-white/5', 'text-zinc-900', 'dark:text-white');
        btn.classList.remove('text-zinc-600', 'dark:text-zinc-400');
        if (indicator) indicator.classList.remove('hidden');

        // Close when clicking outside
        const closeMenu = (e) => {
            if (!container.contains(e.target) && !btn.contains(e.target)) {
                container.classList.add('hidden');
                container.classList.remove('flex');
                btn.classList.remove('bg-black/5', 'dark:bg-white/5', 'text-zinc-900', 'dark:text-white');
                btn.classList.add('text-zinc-600', 'dark:text-zinc-400');
                if (indicator) indicator.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };
        // Timeout to prevent immediate closing since the click that opened it bubbles up
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    } else {
        btn.classList.remove('bg-black/5', 'dark:bg-white/5', 'text-zinc-900', 'dark:text-white');
        btn.classList.add('text-zinc-600', 'dark:text-zinc-400');
        if (indicator) indicator.classList.add('hidden');
    }
};

/** Toggles hidden-only filter mode. */
window.toggleHiddenOnly = () => {
    state.filterHiddenOnly = !state.filterHiddenOnly;
    const btn = document.getElementById('hiddenOnlyBtn');

    if (state.filterHiddenOnly) {
        btn.classList.add('bg-red-500', 'text-white', 'border-red-400', 'shadow-lg', 'shadow-red-500/20');
        btn.classList.remove('text-zinc-500', 'hover:text-red-400', 'border-transparent');
    } else {
        btn.classList.remove('bg-red-500', 'text-white', 'border-red-400', 'shadow-lg', 'shadow-red-500/20');
        btn.classList.add('text-zinc-500', 'hover:text-red-400', 'border-transparent');
    }
    renderFilters();
    renderGrid();
};

// =============================================================================
// SEARCH & SMART FILTER
// =============================================================================

/**
 * Applies a smart filter from card clicks.
 * @param {Event} e - Click event
 * @param {string} key - Filter key (author, series, universe, type)
 * @param {string} val - Filter value
 */
window.smartFilter = (e, key, val) => {
    if (e) e.stopPropagation();
    const input = document.getElementById('searchInput');
    const term = val.includes(' ') ? `"${val}"` : val;
    const newFilter = `${key}=${term}`;

    if (!input.value.includes(newFilter)) {
        input.value = (input.value + ' ' + newFilter).trim();
        renderGrid();
    }
    window.closeDetail();
};

/** Clears the search input. */
window.clearSearch = () => {
    document.getElementById('searchInput').value = '';
    renderGrid();
};

// =============================================================================
// INFO MODAL
// =============================================================================

window.openInfoModal = () => {
    const modal = document.getElementById('infoModal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

window.closeInfoModal = () => {
    const modal = document.getElementById('infoModal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
};

// =============================================================================
// IMAGE PREVIEW
// =============================================================================

/**
 * Previews a selected cover image.
 * @param {HTMLInputElement} input - File input element
 */
window.previewImage = (input) => {
    if (!input.files?.[0]) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('previewImg');
        img.src = e.target.result;
        img.classList.remove('hidden');
        document.getElementById('previewPlaceholder').classList.add('hidden');
        document.getElementById('currentCoverName').innerText = input.files[0].name;
    };
    reader.readAsDataURL(input.files[0]);
};

// =============================================================================
// ENTRY SAVE
// =============================================================================

/** Saves the current entry form. */
// Flag to prevent double submission
let isWizardSaving = false;

/** Saves the current entry form. */
window.saveEntry = async () => {
    if (isWizardSaving) return;

    const submitBtn = document.getElementById('submitBtn');

    try {
        isWizardSaving = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving';
            safeCreateIcons();
        }

        const formData = new FormData();
        const status = document.getElementById('status').value;

        const data = {
            id: document.getElementById('itemId').value,
            type: document.getElementById('type').value,
            status: status,
            title: document.getElementById('title').value,
            authors: state.currentAuthors,
            alternateTitles: state.currentAlternateTitles,
            universe: document.getElementById('universe').value,
            series: document.getElementById('series').value,
            seriesNumber: document.getElementById('seriesNumber').value,
            description: document.getElementById('description').value,
            notes: document.getElementById('notes')?.value || '',
            review: document.getElementById('review').value,
            progress: document.getElementById('progress').value,
            // Clear rating for items not yet consumed
            rating: ['Planning', 'Reading/Watching'].includes(status)
                ? null
                : parseInt(document.getElementById('rating').value),
            children: state.currentChildren,
            externalLinks: state.currentLinks,
            isHidden: document.getElementById('isHidden').checked,
            abbreviations: state.currentAbbreviations
        };

        // Add pending inputs
        const pendingAuth = document.getElementById('authorInput').value.trim();
        if (pendingAuth && !data.authors.includes(pendingAuth)) data.authors.push(pendingAuth);

        const pendingAltTitle = document.getElementById('altTitleInput').value.trim();
        if (pendingAltTitle && !data.alternateTitles.includes(pendingAltTitle)) data.alternateTitles.push(pendingAltTitle);

        formData.append('data', JSON.stringify(data));

        const file = document.getElementById('coverImage').files[0];
        if (file) formData.append('image', file);

        await saveItem(formData);
        closeModal();
        loadItems();
        showToast('Entry saved successfully!', 'success');
    } catch (e) {
        console.error("Error saving entry:", e);
        showToast("Failed to save entry. Please try again.", 'error');
    } finally {
        isWizardSaving = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            submitBtn.innerHTML = 'Finish';
            // Note: If in edit mode, it should be 'Save Changes'. 
            // ideally we check state.isEditMode but the modal is usually closed on success anyway.
            // If error occurred, we should restore correct text.
            if (state.isEditMode) submitBtn.innerHTML = 'Save Changes';
        }
    }
};

// =============================================================================
// DETAIL MODAL
// =============================================================================

/**
 * Opens the detail view modal for an item.
 * @param {string} id - Item ID
 */
window.openDetail = (id) => {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');
    const modalContent = document.getElementById('detailModalContent');

    const typeColorVar = `var(--col-${item.type.toLowerCase()})`;
    modalContent.style.setProperty('--theme-col', typeColorVar);
    modalContent.style.borderColor = typeColorVar;
    modalContent.classList.add('border-[color:var(--theme-col)]');

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);

    renderDetailView(item, content);
};

/** Closes the detail view modal. */
window.closeDetail = () => {
    const modal = document.getElementById('detailModal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.editFromDetail = (id) => { window.closeDetail(); window.openModal(id); };

window.deleteFromDetail = async (id) => {
    const deleted = await deleteItem(id);
    if (deleted) {
        window.closeDetail();
        loadItems();
        showToast('Entry deleted.', 'info');
    }
};

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the application when DOM is ready.
 */
function initApp() {
    loadItems();
    populateAutocomplete();
    window.setViewMode('grid');

    // Helper for safe event binding
    const addListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Form change listeners
    addListener('type', 'change', updateWizardUI);
    addListener('status', 'change', updateWizardUI);

    // Search input
    addListener('searchInput', 'input', (e) => {
        document.getElementById('clearSearchBtn').classList.toggle('hidden', e.target.value.length === 0);
        renderGrid();
    });

    // Tag inputs
    addListener('authorInput', 'keydown', (e) => checkEnterKey(e, 'author'));
    addListener('altTitleInput', 'keydown', (e) => checkEnterKey(e, 'altTitle'));

    // Global resize listener for dynamic truncation
    window.addEventListener('resize', debounce(() => {
        // Update Grid/List View
        updateGridTruncation();

        // Update Detail View if open
        const detailModal = document.getElementById('detailModal');
        if (detailModal && !detailModal.classList.contains('hidden')) {
            // Find current item ID from DOM since it's not in global state
            const descEl = detailModal.querySelector('[id^="detail-desc-"]');
            if (descEl) {
                const id = descEl.id.replace('detail-desc-', '');
                updateDetailTruncation(id);
            } else {
                // Try finding review or notes if desc is missing
                const noteEl = detailModal.querySelector('[id^="detail-notes-"]');
                if (noteEl) {
                    const id = noteEl.id.replace('detail-notes-', '');
                    updateDetailTruncation(id);
                } else {
                    const revEl = detailModal.querySelector('[id^="detail-review-"]');
                    if (revEl) {
                        const id = revEl.id.replace('detail-review-', '');
                        updateDetailTruncation(id);
                    }
                }
            }
        }
    }, 200));

    // Title auto-fill for abbreviations
    // Logic: Listener updates abbreviations only if field is enabled and list is empty/single-item
    addListener('title', 'input', (e) => {
        const val = e.target.value;
        const disableAbbr = document.getElementById('disableAbbr');
        if (disableAbbr && !disableAbbr.checked) {
            const abbr = generateAbbreviation(val);
            // Only auto-update if list is empty or has exactly 1 item (assuming it was auto-generated)
            if (state.currentAbbreviations.length <= 1) {
                if (abbr) {
                    state.currentAbbreviations = [abbr];
                    renderAbbrTags();
                } else if (val === '') {
                    state.currentAbbreviations = [];
                    renderAbbrTags();
                }
            }
        }
    });

    // Rating slider
    const ratingInput = document.getElementById('rating');
    if (ratingInput) {
        ratingInput.addEventListener('input', function () {
            updateRatingVisuals(this.value);
        });
    }
}

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
