/**
 * @fileoverview Main entry point for UpNext application.
 * Handles global event bindings, filter/view controls, and application initialization.
 * @module main
 */

import { state, setState, loadUIState, saveAppSettings } from './state.js';
import { loadItems, deleteItem, saveItem, getDbStatus, selectDatabase, createDatabase } from './api_service.js';
import { renderFilters, renderGrid, updateGridTruncation } from './render_utils.js';
import { safeCreateIcons, toggleExpand, debounce } from './dom_utils.js';
import { RATING_LABELS, TEXT_COLORS } from './constants.js';
import {
    openModal, closeModal, nextStep, prevStep, jumpToStep,
    populateAutocomplete, addSpecificLink, addLink, removeLink, updateLink, pasteLink,
    removeAuthor, addChild, removeChildIdx, updateChild, updateChildRating, renderChildren,
    removeAltTitle, checkEnterKey, renderDetailView, updateDetailTruncation, updateRatingVisuals,
    renderAbbrTags, removeAbbreviation, toggleAbbrField, generateAbbreviation, renderLinks,
    renderGenericTags, removeTag, incrementRereadCount, decrementRereadCount,
    toggleChildDetails, incrementChildField, decrementChildField,
    toggleTotalsOverride, updateTotalsUIForType,
    updateModalTags, renderAltTitles, syncTotalsToChild
} from './main_helpers.js';
import { updateWizardUI, selectType, selectStatus } from './wizard_logic.js';
import { scrollToSection, updateSidebarVisibility } from './edit_mode.js';
import {
    openExportModal, closeExportModal, triggerExport,
    selectExportCategory, backToExportCategories,
    updateExportOptions, toggleVisualField,
    toggleExportTypeFilter, toggleExportStatusFilter, toggleExportRatingFilter
} from './export_utils.js';
import {
    openSettingsModal, closeSettingsModal, saveSettingsAndClose,
    switchSettingsTab, toggleFeature, toggleHiddenField,
    toggleGroupCollapse, toggleMediaType, toggleStatus, toggleAutoLaunchSetting,
    toggleOpenWindowOnStart, setTrayClickAction, setCloseBehavior,
    saveTagColor, saveTagDesc, addNewTagHandler, renameTagHandler, deleteTagHandler,
    saveTmdbApiKey
} from './settings_logic.js';
import { openExternalSearchModal, closeExternalSearchModal } from './external_search.js';

// =============================================================================
// GLOBAL WINDOW BINDINGS
// =============================================================================

// Attach key functions to window object for usage in inline HTML event handlers
window.state = state;
window.toggleExpand = toggleExpand;
window.loadItems = loadItems;

// Helper Bindings
window.openModal = openModal;
window.closeModal = closeModal;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.jumpToStep = jumpToStep;
window.selectType = selectType;
window.selectStatus = selectStatus;
window.renderLinks = renderLinks;
window.scrollToSection = scrollToSection;
window.updateSidebarVisibility = updateSidebarVisibility;
window.populateAutocomplete = populateAutocomplete;
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
window.renderChildren = renderChildren;
window.removeAltTitle = removeAltTitle;
window.checkEnterKey = checkEnterKey;
window.renderDetailView = renderDetailView;
window.updateDetailTruncation = updateDetailTruncation;
window.updateRatingVisuals = updateRatingVisuals;
window.renderAbbrTags = renderAbbrTags;
window.removeAbbreviation = removeAbbreviation;
window.toggleAbbrField = toggleAbbrField;
window.generateAbbreviation = generateAbbreviation;
window.renderGenericTags = renderGenericTags;
window.removeTag = removeTag;
window.incrementRereadCount = incrementRereadCount;
window.decrementRereadCount = decrementRereadCount;
window.toggleChildDetails = toggleChildDetails;
window.incrementChildField = incrementChildField;
window.decrementChildField = decrementChildField;
window.toggleTotalsOverride = toggleTotalsOverride;
window.updateTotalsUIForType = updateTotalsUIForType;
window.updateModalTags = updateModalTags;
window.renderAltTitles = renderAltTitles;
window.syncTotalsToChild = syncTotalsToChild;

// Export Utils Bindings
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

// Settings Logic Bindings
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettingsAndClose = saveSettingsAndClose;
window.switchSettingsTab = switchSettingsTab;
window.toggleFeature = toggleFeature;
window.toggleHiddenField = toggleHiddenField;
window.toggleGroupCollapse = toggleGroupCollapse;
window.toggleMediaType = toggleMediaType;
window.toggleStatus = toggleStatus;
window.toggleAutoLaunchSetting = toggleAutoLaunchSetting;
window.toggleOpenWindowOnStart = toggleOpenWindowOnStart;
window.setTrayClickAction = setTrayClickAction;
window.setCloseBehavior = setCloseBehavior;
window.saveTagColor = saveTagColor;
window.saveTagDesc = saveTagDesc;
window.addNewTagHandler = addNewTagHandler;
window.renameTagHandler = renameTagHandler;
window.deleteTagHandler = deleteTagHandler;

// External Search Bindings
window.openExternalSearchModal = openExternalSearchModal;
window.closeExternalSearchModal = closeExternalSearchModal;

// API Key Bindings
window.saveTmdbApiKey = saveTmdbApiKey;

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

/**
 * Checks if multiple databases exist and prompts user if needed.
 * Supports Auto-Launch, Create New DB, and Forced Restart.
 */
async function checkDatabaseSelection() {
    try {
        const { available, active, hasConfig } = await getDbStatus();

        // Check if restart was forced
        const forcedRestart = sessionStorage.getItem('forceDbSelect');
        if (forcedRestart) {
            sessionStorage.removeItem('forceDbSelect');
        }

        // Check Auto-Launch Preference
        const autoLaunch = state.appSettings?.autoLaunchDb ?? false;

        // Condition to skip modal:
        // 1. Not forced restart.
        // 2. AND (Auto-launch is ON AND active DB is valid OR only one DB exists).
        const shouldSkip = !forcedRestart && ((available.length <= 1) || (autoLaunch && active && available.includes(active)));

        if (shouldSkip) {
            loadItems();
            return;
        }

        // Show Modal
        const modal = document.getElementById('dbSelectModal');
        const container = document.getElementById('dbLinksContainer');

        let footer = document.getElementById('dbSelectFooter');
        if (!footer) {
            const contentDiv = container.parentElement;
            footer = document.createElement('div');
            footer.id = 'dbSelectFooter';
            footer.className = 'w-full pt-6 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3';
            contentDiv.appendChild(footer);
        }

        if (modal && container) {
            container.innerHTML = available.map(db => `
                <button onclick="window.handleDbSelect('${db}')" 
                    class="w-full text-left px-5 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group flex items-center justify-between relative overflow-hidden">
                    
                    <div class="flex items-center gap-4 relative z-10 w-full">
                         <div class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex-shrink-0 flex items-center justify-center text-zinc-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-colors">
                            <i data-lucide="database" class="w-5 h-5"></i>
                         </div>
                         <div class="flex flex-col flex-grow min-w-0">
                            <span class="font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-lg truncate">${db.replace('.db', '')}</span>
                            <span class="text-xs text-zinc-400 font-mono truncate">${db}</span>
                         </div>
                         ${db === active ? `
                            <span class="flex-shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                                <i data-lucide="check" class="w-3 h-3"></i> Last Active
                            </span>
                        ` : `
                            <i data-lucide="chevron-right" class="w-5 h-5 text-zinc-300 dark:text-zinc-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"></i>
                        `}
                    </div>
                </button>
            `).join('');

            footer.innerHTML = `
                <button onclick="window.handleCreateDb()" 
                    class="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 font-bold hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2 group">
                    <div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </div>
                    <span>Create New Library</span>
                </button>
                
                <label class="flex items-center justify-center gap-2.5 cursor-pointer group opacity-60 hover:opacity-100 transition-all py-2">
                        <input type="checkbox" id="autoLaunchCheckbox" 
                        onchange="window.toggleAutoLaunch(this.checked)"
                        ${state.appSettings?.autoLaunchDb ? 'checked' : ''}
                        class="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                        <span class="text-xs font-medium text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors select-none">
                        Do not show on launch (Auto-load)
                        </span>
                </label>
            `;

            modal.classList.remove('hidden');
            void modal.offsetWidth;
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-95');
            safeCreateIcons();
        }

    } catch (e) {
        console.error('DB Status Check Failed:', e);
        loadItems(); // Fallback
    }
}

/** 
 * Forces a restart that opens the DB selection screen. 
 * Invoked by restart button in settings.
 */
window.restartToDbSelect = () => {
    sessionStorage.setItem('forceDbSelect', 'true');
    window.location.reload();
};

/** Handles database selection click. */
window.handleDbSelect = async (dbName) => {
    const res = await selectDatabase(dbName);
    if (res.status === 'success') {
        const modal = document.getElementById('dbSelectModal');
        // Close modal and load items (No Reload!)
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);

        loadItems();
        showRichToast({
            title: 'Library Loaded',
            message: `Switched to ${dbName}`,
            type: 'success'
        });
    } else {
        alert('Failed to switch database: ' + res.message);
    }
};

/** Handles creating a new database. */
window.handleCreateDb = async () => {
    const name = prompt("Enter a name for the new library (alphanumeric only, no extension needed):");
    if (!name) return;

    const res = await createDatabase(name);
    if (res.status === 'success') {
        const switchRes = await selectDatabase(res.db_name);
        if (switchRes.status === 'success') {
            // Close modal and load (No reload)
            const modal = document.getElementById('dbSelectModal');
            modal.classList.add('opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 300);

            loadItems();
            showRichToast({
                title: 'Library Created',
                message: `Created and switched to ${res.db_name}`,
                type: 'success'
            });
        } else {
            alert('Database created but failed to switch: ' + switchRes.message);
        }
    } else {
        alert('Failed to create database: ' + res.message);
    }
};

/** Toggles auto-launch setting. */
window.toggleAutoLaunch = async (checked) => {
    if (!state.appSettings) state.appSettings = {};

    // Update state and persist using the centralized state manager
    // This ensures LocalStorage / Native Config is updated
    saveAppSettings({ autoLaunchDb: checked });

    // Also try to save to backend file for redundancy/backend-awareness
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.appSettings)
        });
    } catch (e) {
        console.error("Failed to save auto-launch pref to backend:", e);
    }
};

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

/** Sets the field to sort by and refreshes the grid. */
window.setSortBy = (field) => { setState('sortBy', field); renderFilters(); renderGrid(); };

/** Sets the sort order (asc/desc) and refreshes the grid. */
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

    let term = val;
    // Don't double quote if already quoted
    const isQuoted = val.length > 1 && (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
    );

    if (!isQuoted && val.includes(' ')) {
        term = `"${val}"`;
    }

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

/** Opens the info/help modal with animation. */
window.openInfoModal = () => {
    const modal = document.getElementById('infoModal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

/** Closes the info/help modal with animation. */
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
/**
 * Collects data from all wizard steps and saves the entry.
 * Handles image cropping auto-save and calendar event creation.
 * @returns {Promise<void>}
 */
let isWizardSaving = false;
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

        const editorArea = document.getElementById('imageEditorArea');
        if (editorArea && !editorArea.classList.contains('hidden') && window.imageEditor && window.imageEditor.saveCropPromise) {
            try {
                await window.imageEditor.saveCropPromise();
            } catch (err) {
                console.warn("Failed to auto-save crop:", err);
            }
        }

        const formData = new FormData();
        const status = document.getElementById('status').value;

        const data = {
            id: document.getElementById('itemId').value,
            type: document.getElementById('type').value,
            status: status,
            title: document.getElementById('title').value || 'Untitled',
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
            abbreviations: state.currentAbbreviations,

            // New Fields
            tags: state.currentTags,
            releaseDate: document.getElementById('releaseDate').value || null,
            episodeCount: parseInt(document.getElementById('episodeCount').value) || null,
            volumeCount: parseInt(document.getElementById('volumeCount').value) || null,
            chapterCount: parseInt(document.getElementById('chapterCount').value) || null,
            wordCount: parseInt(document.getElementById('wordCount').value) || null,
            avgDurationMinutes: parseInt(document.getElementById('avgDurationMinutes').value) || null,
            rereadCount: parseInt(document.getElementById('rereadCount').value) || 0,
            completedAt: document.getElementById('completedAt').value || null
        };

        // Add pending inputs
        const pendingAuth = document.getElementById('authorInput').value.trim();
        if (pendingAuth && !data.authors.includes(pendingAuth)) data.authors.push(pendingAuth);

        const pendingTag = document.getElementById('tagInput').value.trim();
        if (pendingTag && !data.tags.includes(pendingTag)) data.tags.push(pendingTag);

        const pendingAltTitle = document.getElementById('altTitleInput').value.trim();
        if (pendingAltTitle && !data.alternateTitles.includes(pendingAltTitle)) data.alternateTitles.push(pendingAltTitle);

        formData.append('data', JSON.stringify(data));

        const file = document.getElementById('coverImage').files[0];
        if (file) {
            formData.append('image', file);
        } else {
            // Check for external cover URL from API import
            const previewImg = document.getElementById('previewImg');
            const externalUrl = previewImg?.dataset?.externalUrl;
            if (externalUrl) {
                formData.append('cover_url', externalUrl);
            }
        }

        const savedItem = await saveItem(formData);

        // --- CALENDAR INTEGRATION ---
        const addToCalendar = document.getElementById('addToCalendar');
        if (addToCalendar && addToCalendar.checked && savedItem.item) {
            const calDateRaw = document.getElementById('calDate').value;
            if (calDateRaw) {
                const calPayload = {
                    date: calDateRaw,
                    time: null,
                    content: document.getElementById('calContent').value || '',
                    itemId: savedItem.item.id,
                    isTracked: true
                };

                const isRecurring = document.getElementById('calRecurring').checked;
                if (isRecurring) {
                    calPayload.recurrence = {
                        frequency: document.getElementById('calFreq').value,
                        count: parseInt(document.getElementById('calCount').value) || 12,
                        useCounter: document.getElementById('calUseCounter').checked,
                        startCount: parseInt(document.getElementById('calStartCount').value) || 1,
                        prefix: document.getElementById('calPrefix').value || ''
                    };
                }

                try {
                    await fetch('/api/releases', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(calPayload)
                    });
                    console.log("Calendar events created via Wizard");
                } catch (calErr) {
                    console.error("Failed to create calendar events:", calErr);
                    showToast("Item saved, but failed to create calendar events.", "warning");
                }
            }
        }

        closeModal();
        loadItems();

        // Show Rich Toast
        showRichToast({
            title: state.isEditMode ? `Updated '${savedItem.item.title}'` : `Added '${savedItem.item.title}'`,
            message: state.isEditMode ? 'Item updated successfully.' : 'Added to library & calendar.',
            coverUrl: savedItem.item.coverUrl,
            type: 'success'
        });
    } catch (e) {
        console.error("Error saving entry:", e);
        showToast("Failed to save entry. Please try again.", 'error');
    } finally {
        isWizardSaving = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            submitBtn.innerHTML = 'Finish';

            if (state.isEditMode) submitBtn.innerHTML = 'Save Changes';
        }
    }
};

// =============================================================================
// DETAIL MODAL - Navigation and display for detailed item view
// =============================================================================

/** @type {string|null} Currently displayed item ID in detail modal */
let currentDetailItemId = null;

/**
 * Gets the currently filtered and sorted list of items matching grid display.
 * Replicates the filtering/sorting logic from renderGrid for navigation consistency.
 * @returns {Array} Filtered and sorted items array
 */
function getFilteredSortedItems() {
    const searchInput = document.getElementById('searchInput');
    const searchVal = (searchInput?.value || '').toLowerCase();

    let textQuery = searchVal.replace(/(universe|author|series|type|tags?)=("([^"]*)"|([^\"\s]+))/gi, () => '').trim();
    const searchFilters = {};
    searchVal.replace(/(universe|author|series|type|tags?)=("([^"]*)"|([^\"\s]+))/gi, (m, k, qf, qi, s) => {
        let key = k.toLowerCase();
        if (key === 'tags') key = 'tag';
        searchFilters[key] = (qi || s).toLowerCase();
    });

    let filtered = state.items.filter(item => {
        if (state.appSettings?.disabledTypes?.includes(item.type)) return false;
        if (state.appSettings?.disabledStatuses?.includes(item.status)) return false;
        if (!state.filterTypes.includes('All') && !state.filterTypes.includes(item.type)) return false;
        if (!state.filterStatuses.includes('All') && !state.filterStatuses.includes(item.status)) return false;

        if (state.filterRatings.length > 0) {
            if (item.status === 'Planning' || item.status === 'Reading/Watching') return true;
            if (!state.filterRatings.includes(item.rating)) return false;
        }

        if (state.filterHiddenOnly) {
            if (!item.isHidden) return false;
        } else {
            if (!state.isHidden && item.isHidden) return false;
        }

        if (searchFilters.type && item.type.toLowerCase() !== searchFilters.type) return false;
        if (searchFilters.universe && (!item.universe || !item.universe.toLowerCase().includes(searchFilters.universe))) return false;
        if (searchFilters.series && (!item.series || !item.series.toLowerCase().includes(searchFilters.series))) return false;
        if (searchFilters.author) {
            const auths = (item.authors || (item.author ? [item.author] : [])).map(a => a.toLowerCase());
            if (!auths.some(a => a.includes(searchFilters.author))) return false;
        }
        if (searchFilters.tag) {
            const itemTags = (item.tags || []).map(t => t.toLowerCase());
            if (!itemTags.some(t => t.includes(searchFilters.tag))) return false;
        }

        if (!textQuery) return true;
        const matchesMainTitle = item.title.toLowerCase().includes(textQuery);
        const matchesAlternateTitle = (item.alternateTitles || []).some(alt => alt.toLowerCase().includes(textQuery));
        const matchesUniverse = (item.universe && item.universe.toLowerCase().includes(textQuery));
        const matchesAbbreviation = (item.abbreviations || []).some(abbr => abbr.toLowerCase().includes(textQuery));
        const matchesTags = (item.tags || []).some(tag => tag.toLowerCase().includes(textQuery));
        return matchesMainTitle || matchesAlternateTitle || matchesUniverse || matchesAbbreviation || matchesTags;
    });

    return filtered.sort((a, b) => {
        let valA = a[state.sortBy] || '';
        let valB = b[state.sortBy] || '';
        if (state.sortBy === 'series') {
            const numA = parseFloat(a.seriesNumber) || 0;
            const numB = parseFloat(b.seriesNumber) || 0;
            const seriesA = (a.series || '').toLowerCase();
            const seriesB = (b.series || '').toLowerCase();
            if (seriesA === seriesB) {
                if (numA < numB) return state.sortOrder === 'asc' ? -1 : 1;
                if (numA > numB) return state.sortOrder === 'asc' ? 1 : -1;
                return 0;
            }
            valA = seriesA; valB = seriesB;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }
        if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Updates navigation button disabled states based on current position.
 */
function updateDetailNavButtons() {
    const filteredItems = getFilteredSortedItems();
    const currentIndex = filteredItems.findIndex(i => i.id === currentDetailItemId);
    const prevBtn = document.getElementById('detailNavPrev');
    const nextBtn = document.getElementById('detailNavNext');

    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= filteredItems.length - 1 || currentIndex === -1;
    safeCreateIcons();
}

/**
 * Applies the media type theme color to modal and navigation buttons.
 * @param {Object} item - The media item
 */
function applyDetailThemeColor(item) {
    const typeColorVar = `var(--col-${item.type.toLowerCase()})`;
    const modalContent = document.getElementById('detailModalContent');
    const prevBtn = document.getElementById('detailNavPrev');
    const nextBtn = document.getElementById('detailNavNext');

    modalContent.style.setProperty('--theme-col', typeColorVar);
    modalContent.style.borderColor = typeColorVar;
    modalContent.classList.add('border-[color:var(--theme-col)]');
    if (prevBtn) prevBtn.style.setProperty('--theme-col', typeColorVar);
    if (nextBtn) nextBtn.style.setProperty('--theme-col', typeColorVar);
}

/**
 * Opens the detail view modal for an item.
 * @param {string} id - Item ID to display
 */
window.openDetail = (id) => {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    currentDetailItemId = id;
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');

    applyDetailThemeColor(item);
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    renderDetailView(item, content);
    updateDetailNavButtons();
};

/**
 * Navigates to adjacent item in the filtered list with slide animation.
 * @param {number} direction - Navigation direction: -1 for previous, 1 for next
 */
window.navigateDetail = (direction) => {
    const filteredItems = getFilteredSortedItems();
    const currentIndex = filteredItems.findIndex(i => i.id === currentDetailItemId);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= filteredItems.length) return;

    const newItem = filteredItems[newIndex];
    currentDetailItemId = newItem.id;
    const content = document.getElementById('detailContent');

    applyDetailThemeColor(newItem);

    // Slide out animation
    content.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
    content.style.opacity = '0';
    content.style.transform = direction > 0 ? 'translateX(-60px)' : 'translateX(60px)';

    setTimeout(() => {
        content.scrollTop = 0;
        content.style.transition = 'none';
        content.style.transform = direction > 0 ? 'translateX(60px)' : 'translateX(-60px)';
        renderDetailView(newItem, content);
        updateDetailNavButtons();
        content.offsetHeight; // Force reflow
        content.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
        content.style.opacity = '1';
        content.style.transform = 'translateX(0)';
    }, 150);
};

/**
 * Scrolls the detail modal content panel.
 * @param {number} direction - Scroll direction: -1 for up, 1 for down
 * @param {boolean} [largeStep=false] - Use larger scroll step (Ctrl modifier)
 * @param {boolean} [instant=false] - Use instant scroll for held keys
 */
window.scrollDetailContent = (direction, largeStep = false, instant = false) => {
    const detailContent = document.getElementById('detailContent');
    if (!detailContent) return;

    const scrollablePanel = detailContent.querySelector('.overflow-y-auto') || detailContent;
    const scrollAmount = largeStep ? 200 : (instant ? 25 : 50);
    scrollablePanel.scrollBy({
        top: direction * scrollAmount,
        behavior: instant ? 'auto' : 'smooth'
    });
};

/** Closes the detail view modal with fade animation. */
window.closeDetail = () => {
    const modal = document.getElementById('detailModal');
    modal.classList.add('opacity-0');
    currentDetailItemId = null;
    setTimeout(() => modal.classList.add('hidden'), 300);
};

/** Opens edit modal for item from detail view. */
window.editFromDetail = (id) => {
    window.closeDetail();
    window.openModal(id);
};

/**
 * Deletes item from detail view with confirmation toast.
 * @param {string} id - Item ID to delete
 */
window.deleteFromDetail = async (id) => {
    const item = state.items.find(i => i.id === id);
    const title = item?.title || 'Entry';
    const coverUrl = item?.coverUrl;

    const deleted = await deleteItem(id);
    if (deleted) {
        window.closeDetail();
        loadItems();
        if (coverUrl) {
            showRichToast({
                title: `Deleted '${title}'`,
                message: 'Removed from library.',
                coverUrl: coverUrl,
                type: 'info'
            });
        } else {
            showToast(`Deleted '${title}' from library.`, 'info');
        }
    }
};

// =============================================================================
// INITIALIZATION
// =============================================================================




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

    // 5. Feature Toggles
    const calendarBtn = document.getElementById('calendarBtn');
    if (calendarBtn) {
        if (state.appSettings.disabledFeatures.includes('calendar')) calendarBtn.classList.add('hidden');
        else calendarBtn.classList.remove('hidden');
    }

    const statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        if (state.appSettings.disabledFeatures.includes('stats')) statsBtn.classList.add('hidden');
        else statsBtn.classList.remove('hidden');
    }
}

/**
 * Checks for overdue releases and prompts the user to catch up.
 */
async function checkOverdueReleases() {
    try {
        const t = Date.now();
        const res = await fetch(`/api/releases/overdue?limit=5&t=${t}`);
        if (res.ok) {
            const data = await res.json();
            if (data.count > 0 && data.items) {
                // Spawn a toast for each item
                data.items.forEach((item, index) => {
                    const delay = index * 200; // Stagger slightly
                    setTimeout(() => {
                        window.showRichToast({
                            title: item.item?.title || 'Unseen Release',
                            message: `Missed: ${item.content || 'New Release'} (${item.date})`,
                            coverUrl: item.item?.coverUrl,
                            type: 'info',
                            actionLabel: 'Mark as Seen',
                            onAction: () => {
                                window.toggleReleaseSeen(item.id, true);
                            }
                        });
                    }, delay);
                });
            }
        }
    } catch (e) {
        console.error('Error checking overdue releases:', e);
    }
}

/**
 * Initializes the application.
 * Performs state loading, DB selection check, and global event binding.
 * @returns {Promise<void>}
 */
async function initApp() {
    await loadUIState();
    await checkDatabaseSelection();
    populateAutocomplete();
    applyStateToUI();

    // Check for overdue releases (delayed slightly to allow UI to settle)
    setTimeout(checkOverdueReleases, 1000);

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
    addListener('searchInput', 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.target.blur();
        }
    });

    // Tag inputs
    addListener('authorInput', 'keydown', (e) => checkEnterKey(e, 'author'));
    addListener('tagInput', 'keydown', (e) => checkEnterKey(e, 'tag'));
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
    // Global Shortcuts
    document.addEventListener('keydown', (e) => {
        // 2. Check if ANY modal is open
        const modalIds = [
            'modal',            // Wizard/Edit Modal
            'detailModal',      // Detail View
            'infoModal',        // Info/Help
            'statsModal',       // Statistics
            'exportModal',      // Export/Backup
            'settingsModal',    // Settings
            'calendarModal',    // Calendar
            'externalSearchModal' // External Search
        ];

        const isAnyModalOpen = modalIds.some(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });

        // 3. Modal closing with ESC (Always allowed if modal is open)
        // --- Escape: Close any open modal ---
        if (e.key === 'Escape') {
            if (document.getElementById('modal') && !document.getElementById('modal').classList.contains('hidden')) window.closeModal();
            if (document.getElementById('detailModal') && !document.getElementById('detailModal').classList.contains('hidden')) window.closeDetail();
            if (document.getElementById('infoModal') && !document.getElementById('infoModal').classList.contains('hidden')) window.closeInfoModal();
            if (document.getElementById('statsModal') && !document.getElementById('statsModal').classList.contains('hidden')) window.closeStatsModal();
            if (document.getElementById('exportModal') && !document.getElementById('exportModal').classList.contains('hidden')) window.closeExportModal();
            if (document.getElementById('settingsModal') && !document.getElementById('settingsModal').classList.contains('hidden')) window.closeSettingsModal();
            if (document.getElementById('calendarModal') && !document.getElementById('calendarModal').classList.contains('hidden')) window.closeCalendarModal?.();
            if (document.getElementById('externalSearchModal') && !document.getElementById('externalSearchModal').classList.contains('hidden')) window.closeExternalSearchModal?.();
            return;
        }

        // --- Detail Modal: Navigation (←/→, A/D) and Scrolling (W/S, ↑/↓) ---
        const detailModal = document.getElementById('detailModal');
        const isDetailModalOpen = detailModal && !detailModal.classList.contains('hidden');
        if (isDetailModalOpen && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            const isCtrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            // Navigation: ←/→ arrows or A/D keys
            if (e.key === 'ArrowLeft' || key === 'a') {
                e.preventDefault();
                window.navigateDetail(-1);
                return;
            }
            if (e.key === 'ArrowRight' || key === 'd') {
                e.preventDefault();
                window.navigateDetail(1);
                return;
            }
            // Scrolling: W/S or ↑/↓ arrows (Ctrl for larger step)
            if (key === 'w' || e.key === 'ArrowUp') {
                e.preventDefault();
                window.scrollDetailContent(-1, isCtrl, e.repeat);
                return;
            }
            if (key === 's' || e.key === 'ArrowDown') {
                e.preventDefault();
                window.scrollDetailContent(1, isCtrl, e.repeat);
                return;
            }
        }

        // --- Wizard/Edit Modal: Stepper Navigation (Ctrl+A/D, Ctrl+←/→) ---
        if (isAnyModalOpen) {
            const isCtrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (isCtrl && (key === 'd' || key === 'arrowright' || key === 'a' || key === 'arrowleft')) {
                e.preventDefault();
                const isNext = (key === 'd' || key === 'arrowright');
                if (!state.isEditMode) {
                    const btn = document.getElementById(isNext ? 'nextBtn' : 'prevBtn');
                    if (btn && !btn.classList.contains('hidden')) btn.click();
                } else {
                    window.navigateEditSection?.(isNext ? 1 : -1);
                }
                return;
            }
        }

        // Skip shortcuts if focused on input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Block other shortcuts if modal is open
        if (isAnyModalOpen) return;

        // --- Global Shortcuts (no modal open) ---
        const key = e.key.toLowerCase();
        const isCtrl = e.ctrlKey || e.metaKey;

        // N: New entry, T: Statistics, C: Calendar, O: Sort menu, F: Focus search
        if (key === 'n') window.openModal();
        if (key === 't' && !state.appSettings?.disabledFeatures?.includes('stats')) window.openStatsModal();
        if (key === 'c' && !state.appSettings?.disabledFeatures?.includes('calendar')) window.openCalendarModal?.();
        if (key === 'o') window.toggleSortMenu();
        if (key === 'f') {
            e.preventDefault();
            const searchBar = document.getElementById('searchBar');
            const searchInput = document.getElementById('searchInput');
            if (searchBar && !searchBar.classList.contains('hidden')) {
                searchBar.focus();
            } else if (searchInput) {
                const container = document.getElementById('searchBarContainer');
                if (container?.classList.contains('hidden')) container.classList.remove('hidden');
                searchInput.focus();
            }
        }

        // W/S/↑/↓: Page scrolling (Ctrl for larger step)
        const scrollBehavior = e.repeat ? 'auto' : 'smooth';
        const scrollAmount = isCtrl ? 200 : (e.repeat ? 25 : 50);
        if (key === 'w' || e.key === 'ArrowUp') {
            e.preventDefault();
            window.scrollBy({ top: -scrollAmount, behavior: scrollBehavior });
        }
        if (key === 's' || e.key === 'ArrowDown') {
            e.preventDefault();
            window.scrollBy({ top: scrollAmount, behavior: scrollBehavior });
        }
    });
}

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
