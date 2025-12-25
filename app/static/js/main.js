/**
 * @fileoverview Main entry point for UpNext application.
 * Handles global event bindings, filter/view controls, and application initialization.
 * @module main
 */

import { state, setState, loadUIState } from './state.js';
import { loadItems, deleteItem, saveItem, getDbStatus, selectDatabase } from './api_service.js';
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

// Attach key functions to window object for usage in inline HTML event handlers
window.state = state;
window.toggleExpand = toggleExpand;
window.loadItems = loadItems;

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

/** Toggles theme between light and dark modes. */
window.toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setState('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();

    // Refresh Stats if modal is open to update chart colors
    const statsModal = document.getElementById('statsModal');
    if (statsModal && !statsModal.classList.contains('hidden')) {
        if (window.openStatsModal) window.openStatsModal();
    }
};

/** Updates theme icons across the UI based on current dark mode state. */
function updateThemeIcon() {
    const isDark = document.documentElement.classList.contains('dark');
    const icons = ['themeIcon', 'themeIconMobile'];
    icons.forEach(id => {
        const icon = document.getElementById(id);
        if (icon) icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    });
    safeCreateIcons();
}

// Export & Modal management
/** Opens the export modal. */
window.openExportModal = openExportModal;
/** Closes the export modal. */
window.closeExportModal = closeExportModal;
/** Triggers the export process. */
window.triggerExport = triggerExport;
/** Selects an export category. */
window.selectExportCategory = selectExportCategory;
/** Navigates back to export categories. */
window.backToExportCategories = backToExportCategories;
/** Updates export options. */
window.updateExportOptions = updateExportOptions;
/** Toggles a visual field for export. */
window.toggleVisualField = toggleVisualField;
/** Toggles the export type filter. */
window.toggleExportTypeFilter = toggleExportTypeFilter;
/** Toggles the export status filter. */
window.toggleExportStatusFilter = toggleExportStatusFilter;
/** Toggles the export rating filter. */
window.toggleExportRatingFilter = toggleExportRatingFilter;

/** Opens a generic modal. */
window.openModal = openModal;
/** Closes a generic modal. */
window.closeModal = closeModal;
/** Advances to the next step in a wizard. */
window.nextStep = nextStep;
/** Goes back to the previous step in a wizard. */
window.prevStep = prevStep;
/** Jumps to a specific step in a wizard. */
window.jumpToStep = jumpToStep;
/** Selects an item type in a form. */
window.selectType = selectType;
/** Selects an item status in a form. */
window.selectStatus = selectStatus;

// Form & Tag helpers
/** Adds a specific link to an item. */
window.addSpecificLink = addSpecificLink;
/** Adds a generic link to an item. */
window.addLink = addLink;
/** Removes a link from an item. */
window.removeLink = removeLink;
/** Updates an existing link. */
window.updateLink = updateLink;
/** Pastes a link from clipboard. */
window.pasteLink = pasteLink;
/** Removes an author from an item. */
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

window.setSortBy = (field) => { setState('sortBy', field); renderFilters(); renderGrid(); };
window.setSortOrder = (order) => { setState('sortOrder', order); renderFilters(); renderGrid(); };

// =============================================================================
// VIEW MODE HANDLERS
// =============================================================================

/**
 * Sets the view mode (grid or list).
 * @param {'grid'|'list'} mode - View mode
 */
window.setViewMode = (mode) => {
    setState('viewMode', mode);
    syncViewModeUI();

    const container = document.getElementById('gridContainer');
    if (!container) return;

    if (mode === 'grid') {
        container.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 pb-20 animate-enter';
    } else {
        container.className = 'flex flex-col gap-4 pb-20 animate-enter max-w-4xl mx-auto';
    }
    renderGrid();
};

// =============================================================================
// UI SYNCHRONIZATION HELPERS
// =============================================================================

/** Synchronizes the multi-select toggle UI across all instances. */
function syncMultiSelectUI() {
    const btns = document.querySelectorAll('.multiSelect-btn');

    btns.forEach(btn => {
        if (state.isMultiSelect) {
            btn.classList.add('bg-emerald-500', 'text-white', 'shadow-lg', 'shadow-emerald-500/20');
            btn.classList.remove('text-zinc-400', 'text-zinc-600', 'text-zinc-500', 'dark:text-zinc-400', 'bg-white/10');
        } else {
            btn.classList.remove('bg-emerald-500', 'text-white', 'shadow-lg', 'shadow-emerald-500/20');
            btn.classList.add('text-zinc-500', 'dark:text-zinc-400');
        }
    });
}

/** Synchronizes the hidden items toggle UI and manages the 'Hidden Only' button visibility. */
function syncHiddenUI() {
    const btns = document.querySelectorAll('.hidden-btn');
    const hiddenOnlyBtns = document.querySelectorAll('.hiddenOnly-btn');

    btns.forEach(btn => {
        if (state.isHidden) {
            btn.classList.add('bg-red-500', 'text-white', 'shadow-lg', 'shadow-red-500/20');
            btn.classList.remove('text-red-400', 'bg-red-500/10', 'text-zinc-400', 'text-zinc-500', 'dark:text-zinc-400');
        } else {
            btn.classList.remove('bg-red-500', 'text-white', 'shadow-lg', 'shadow-red-500/20');
            btn.classList.add('text-zinc-500', 'dark:text-zinc-400');
        }
    });

    // Hidden Only button is only relevant if hidden items are being shown
    hiddenOnlyBtns.forEach(btn => {
        if (state.isHidden) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    });
}

/** Synchronizes the expanded details toggle UI. */
function syncDetailsUI() {
    const btns = document.querySelectorAll('.details-btn');

    btns.forEach(btn => {
        if (state.showDetails) {
            btn.classList.add('bg-indigo-500', 'text-white', 'shadow-lg', 'shadow-indigo-500/20');
            btn.classList.remove('text-zinc-400', 'text-zinc-600', 'text-zinc-500', 'dark:text-zinc-400', 'bg-white/10');
        } else {
            btn.classList.remove('bg-indigo-500', 'text-white', 'shadow-lg', 'shadow-indigo-500/20');
            btn.classList.add('text-zinc-500', 'dark:text-zinc-400');
        }
    });
}

/** Synchronizes the 'Hidden Only' filter state UI. */
function syncHiddenOnlyUI() {
    const btns = document.querySelectorAll('.hiddenOnly-btn');
    btns.forEach(btn => {
        if (state.filterHiddenOnly) {
            btn.classList.add('bg-red-500', 'text-white', 'border-red-400', 'shadow-lg', 'shadow-red-500/20');
            btn.classList.remove('text-zinc-500', 'text-zinc-700', 'hover:text-red-400', 'border-transparent');
        } else {
            btn.classList.remove('bg-red-500', 'text-white', 'border-red-400', 'shadow-lg', 'shadow-red-500/20');
            btn.classList.add('text-zinc-700', 'dark:text-zinc-300', 'border-transparent');
        }
    });
}

/** Synchronizes the view mode buttons (grid/list) UI across all instances. */
function syncViewModeUI() {
    const gridBtns = document.querySelectorAll('.view-grid-btn');
    const listBtns = document.querySelectorAll('.view-list-btn');
    const isGrid = state.viewMode === 'grid';

    gridBtns.forEach(btn => {
        if (isGrid) {
            btn.classList.add('bg-zinc-800', 'dark:bg-zinc-100', 'text-white', 'dark:text-black', 'shadow-md');
            btn.classList.remove('text-zinc-400', 'text-zinc-500', 'dark:text-white', 'bg-zinc-200', 'dark:bg-zinc-700');
        } else {
            btn.classList.remove('bg-zinc-800', 'dark:bg-zinc-100', 'text-white', 'dark:text-black', 'shadow-md');
            btn.classList.add('text-zinc-400', 'dark:text-zinc-500');
        }
    });

    listBtns.forEach(btn => {
        if (!isGrid) {
            btn.classList.add('bg-zinc-800', 'dark:bg-zinc-100', 'text-white', 'dark:text-black', 'shadow-md');
            btn.classList.remove('text-zinc-400', 'text-zinc-500', 'dark:text-white', 'bg-zinc-200', 'dark:bg-zinc-700');
        } else {
            btn.classList.remove('bg-zinc-800', 'dark:bg-zinc-100', 'text-white', 'dark:text-black', 'shadow-md');
            btn.classList.add('text-zinc-400', 'dark:text-zinc-500');
        }
    });
}

// =============================================================================
// TOGGLE HANDLERS (EXPOSED TO WINDOW)
// =============================================================================

/** Toggles multi-select mode for filters. */
window.toggleMultiSelect = () => {
    setState('isMultiSelect', !state.isMultiSelect);
    syncMultiSelectUI();
    if (!state.isMultiSelect) {
        if (state.filterTypes.length > 1) state.filterTypes = ['All'];
        if (state.filterStatuses.length > 1) state.filterStatuses = ['All'];
        state.filterRatings = [];
        renderFilters();
        renderGrid();
    }
};

/** Toggles primary hidden items visibility. */
window.toggleHidden = () => {
    setState('isHidden', !state.isHidden);
    syncHiddenUI();
    // If we stop showing hidden items, we must also stop filtering for ONLY hidden items
    if (!state.isHidden && state.filterHiddenOnly) {
        window.toggleHiddenOnly();
    }
    renderFilters();
    renderGrid();
};

/** Toggles expanded details view for all cards. */
window.toggleDetails = () => {
    setState('showDetails', !state.showDetails);
    syncDetailsUI();
    renderGrid();
};

/** Toggles the 'Hidden Only' filter mode. */
window.toggleHiddenOnly = () => {
    setState('filterHiddenOnly', !state.filterHiddenOnly);
    syncHiddenOnlyUI();
    renderFilters();
    renderGrid();
};

/** Toggles the responsive search bar visibility. */
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

/** Toggles the responsive system menu (sort/filters) visibility. */
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
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    } else {
        btn.classList.remove('bg-black/5', 'dark:bg-white/5', 'text-zinc-900', 'dark:text-white');
        btn.classList.add('text-zinc-600', 'dark:text-zinc-400');
        if (indicator) indicator.classList.add('hidden');
    }
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
 * Checks if multiple databases are available and prompts for selection if needed.
 */
async function checkDatabaseSelection() {
    const status = await getDbStatus();
    if (status.needsSelection) {
        const modal = document.getElementById('dbSelectModal');
        const container = document.getElementById('dbLinksContainer');
        container.innerHTML = '';

        const closeDbModal = () => {
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);
        };

        // Populate database options
        status.available.forEach(dbName => {
            const isActive = dbName === status.active;
            const btn = document.createElement('button');

            // Base classes
            let classes = 'w-full px-6 py-4 rounded-2xl border text-left transition-all group flex justify-between items-center relative overflow-hidden ';

            if (isActive) {
                classes += 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 shadow-md shadow-indigo-500/10';
            } else {
                classes += 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500';
            }
            btn.className = classes;

            btn.innerHTML = `
                <div class="flex flex-col relative z-10">
                    <span class="text-zinc-900 dark:text-white font-bold text-lg flex items-center gap-2">
                        ${dbName}
                        ${isActive ? '<span class="px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider">Last Used</span>' : ''}
                    </span>
                    <span class="text-xs text-zinc-500 uppercase tracking-wider mt-1 font-medium">${isActive ? 'Click to resume' : 'Click to switch'}</span>
                </div>
                ${isActive
                    ? '<div class="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10"></div><i data-lucide="check-circle-2" class="w-6 h-6 text-indigo-500 relative z-10"></i>'
                    : '<i data-lucide="chevron-right" class="w-5 h-5 text-zinc-300 group-hover:text-indigo-500 transition-colors relative z-10"></i>'
                }
            `;

            btn.onclick = async () => {
                // Force backend sync
                const result = await selectDatabase(dbName);
                if (result.status === 'success') {
                    closeDbModal();
                    loadItems();
                    showToast(`Switched to ${dbName}`, 'success');
                } else {
                    showToast(result.message || 'Failed to switch database', 'error');
                }
            };
            container.appendChild(btn);
        });

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.children[0].classList.remove('scale-95');
            safeCreateIcons();
        }, 10);
    }
}

/**
 * Applies current state to UI elements.
 */
function applyStateToUI() {
    // 1. Theme
    const html = document.documentElement;
    if (state.theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    updateThemeIcon();

    // 2. View Mode
    syncViewModeUI();
    const container = document.getElementById('gridContainer');
    if (container) {
        if (state.viewMode === 'grid') {
            container.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 pb-20 animate-enter';
        } else {
            container.className = 'flex flex-col gap-4 pb-20 animate-enter max-w-4xl mx-auto';
        }
    }

    // 3. Toggles
    syncMultiSelectUI();
    syncHiddenUI();
    syncHiddenOnlyUI();
    syncDetailsUI();

    // 4. Filters & Sorting (Sync dropdowns)
    renderFilters();
}

/**
 * Initializes the application when DOM is ready.
 */
function initApp() {
    loadUIState();
    checkDatabaseSelection();
    loadItems();
    populateAutocomplete();
    applyStateToUI();

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

    // Auto-fill abbr if enabled and list is empty/single
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
