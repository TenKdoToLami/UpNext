/**
 * @fileoverview Calendar module for UpNext application.
 * Handles release calendar with month view and upcoming view modes.
 * @module calendar
 */

import { safeCreateIcons } from './dom_utils.js';
import { isFieldVisible } from './state.js';
import {
    ICON_MAP, TYPE_COLOR_MAP,
    MONTH_NAMES, MONTH_NAMES_SHORT
} from './constants.js';

// =============================================================================
// STATE
// =============================================================================

let calendarState = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    currentView: 'month', // 'month' or 'upcoming'
    releases: [],
    pickerYear: new Date().getFullYear(),
    selectedDay: null,

    // Add Event Modal State
    selectedMediaItem: null,
    searchTimeout: null,
    currentEditingId: null, // ID of release being edited

    // Cell Scroll State (for interaction)
    cellScrollState: {}, // Key: dateStr, Value: focusedIndex
};

// Month names imported from constants.js

// Media type colors (matching app theme)
const TYPE_COLORS = {
    'Anime': 'bg-violet-500',
    'Manga': 'bg-pink-500',
    'Book': 'bg-blue-500',
    'Movie': 'bg-red-500',
    'Series': 'bg-amber-500'
};

// Border colors for carousel cards
const BORDER_COLORS = {
    'Anime': 'border-violet-500',
    'Manga': 'border-pink-500',
    'Book': 'border-blue-500',
    'Movie': 'border-red-500',
    'Series': 'border-amber-500'
};

// ICON_MAP imported from constants.js

const TEXT_COLORS_MAP = {
    'Anime': 'text-violet-500',
    'Manga': 'text-pink-500',
    'Book': 'text-blue-500',
    'Movie': 'text-red-500',
    'Series': 'text-amber-500'
};

// TYPE_COLOR_MAP imported from constants.js

// =============================================================================
// MODAL CONTROLS
// =============================================================================

/**
 * Opens the calendar modal and loads releases.
 */
function openCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;

    // Reset dates but KEEP existing view if set
    const today = new Date();
    calendarState.currentYear = today.getFullYear();
    calendarState.currentMonth = today.getMonth();

    // Use persistent state if available
    if (window.state && window.state.calendarView) {
        calendarState.currentView = window.state.calendarView;
    } else if (!calendarState.currentView) {
        calendarState.currentView = 'month';
    }

    // Show modal with animation
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('#calendarModalContent')?.classList.remove('scale-95');
    });

    // Load releases based on CURRENT view
    updateViewToggle();

    const loadPromise = calendarState.currentView === 'month'
        ? loadReleasesForMonth().then(renderMonthView)
        : loadUpcomingReleases().then(renderUpcomingView);

    loadPromise.then(() => {
        updateViewToggle();
    });

    // Initialize lucide icons
    safeCreateIcons();

    // Add global listener for sidebar
    setTimeout(() => {
        document.addEventListener('click', handleGlobalClick);
    }, 100);
}

/**
 * Handles global clicks to close sidebar or deselection.
 */
function handleGlobalClick(e) {
    const sidebar = document.getElementById('calendarDayDetail');

    // Safety check
    if (!sidebar || sidebar.classList.contains('hidden')) return;

    // 1. If clicking inside sidebar, do nothing
    if (sidebar.contains(e.target)) return;

    // 2. If clicking a day cell (that opens sidebar), do nothing (let cell handler work)
    if (e.target.closest('.calendar-day-cell') || e.target.closest('.carousel-card')) return;

    // 3. Otherwise, clicking outside -> Close sidebar
    closeDayDetail();
}

/**
 * Closes the calendar modal.
 */
function closeCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;

    modal.classList.add('opacity-0');
    modal.querySelector('#calendarModalContent')?.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        closeDayDetail();
        closeMonthYearPicker();
    }, 200);

    document.removeEventListener('click', handleGlobalClick);
}

// =============================================================================
// VIEW CONTROLS
// =============================================================================

/**
 * Sets the calendar view mode.
 * @param {'month'|'upcoming'} view - View mode to switch to
 */
function setCalendarView(view) {
    calendarState.currentView = view;
    // Persist to global state
    if (window.setState) {
        window.setState('calendarView', view);
    }
    updateViewToggle();

    if (view === 'month') {
        loadReleasesForMonth().then(renderMonthView);
    } else {
        loadUpcomingReleases().then(renderUpcomingView);
    }

    closeDayDetail();
}

/**
 * Updates the view toggle button states.
 */
function updateViewToggle() {
    const monthBtn = document.getElementById('calViewMonth');
    const upcomingBtn = document.getElementById('calViewUpcoming');
    const monthNav = document.getElementById('monthNavNew');
    const todayBtn = document.getElementById('btnCalToday');
    const catchUpBtn = document.getElementById('btnCatchUp');
    const monthView = document.getElementById('calendarMonthView');
    const upcomingView = document.getElementById('calendarUpcomingView');

    const activeClass = 'bg-zinc-900 dark:bg-white text-white dark:text-black';
    const inactiveClass = 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white';

    // Helper to toggle visibility with flex
    const showFlex = (el) => { if (el) { el.style.display = 'flex'; el.classList.remove('hidden'); } };
    const hide = (el) => { if (el) { el.style.display = 'none'; el.classList.add('hidden'); } };

    // 4. Handle Visibility of Toggle Buttons based on Settings
    const isMonthHidden = !isFieldVisible('calendar_month');
    const isUpcomingHidden = !isFieldVisible('calendar_upcoming');

    if (isMonthHidden && isUpcomingHidden) {
        // Both hidden? (Should be prevented by settings, but safety fallback)
        hide(monthBtn);
        hide(upcomingBtn);
        hide(monthView);
        hide(upcomingView);
        return; // Nothing to show
    }

    if (isMonthHidden) {
        hide(monthBtn);
        // If current view is month but it's hidden, switch to upcoming
        if (calendarState.currentView === 'month') {
            calendarState.currentView = 'upcoming';
            // Recursive call or manual update? Let's just fall through to the logic below which handles rendering
        }
    } else {
        showFlex(monthBtn);
    }

    if (isUpcomingHidden) {
        hide(upcomingBtn);
        if (calendarState.currentView === 'upcoming') {
            calendarState.currentView = 'month';
        }
    } else {
        showFlex(upcomingBtn);
    }

    // Standard View Logic
    if (calendarState.currentView === 'month') {
        monthBtn?.classList.remove(...inactiveClass.split(' '));
        monthBtn?.classList.add(...activeClass.split(' '));
        upcomingBtn?.classList.remove(...activeClass.split(' '));
        upcomingBtn?.classList.add(...inactiveClass.split(' '));

        if (monthNav) showFlex(monthNav);
        if (todayBtn) showFlex(todayBtn);
        if (catchUpBtn) hide(catchUpBtn);

        monthView?.classList.remove('hidden');
        upcomingView?.classList.add('hidden');
    } else {
        upcomingBtn?.classList.remove(...inactiveClass.split(' '));
        upcomingBtn?.classList.add(...activeClass.split(' '));
        monthBtn?.classList.remove(...activeClass.split(' '));
        monthBtn?.classList.add(...inactiveClass.split(' '));

        if (monthNav) hide(monthNav);
        if (todayBtn) hide(todayBtn);
        // Show Catch Up button in place of "Today"
        if (catchUpBtn) showFlex(catchUpBtn);

        monthView?.classList.add('hidden');
        upcomingView?.classList.remove('hidden');
    }
}

// =============================================================================
// MONTH NAVIGATION
// =============================================================================

/**
 * Navigates to previous/next month.
 * @param {number} delta - Number of months to move (-1 or 1)
 */
function navigateMonth(delta) {
    calendarState.currentMonth += delta;

    if (calendarState.currentMonth > 11) {
        calendarState.currentMonth = 0;
        calendarState.currentYear++;
    } else if (calendarState.currentMonth < 0) {
        calendarState.currentMonth = 11;
        calendarState.currentYear--;
    }

    loadReleasesForMonth().then(renderMonthView);
}

/**
 * Navigates to today's date.
 */
function goToToday() {
    const today = new Date();
    calendarState.currentYear = today.getFullYear();
    calendarState.currentMonth = today.getMonth();

    if (calendarState.currentView === 'month') {
        loadReleasesForMonth().then(renderMonthView);
    } else {
        loadUpcomingReleases().then(renderUpcomingView);
    }
}

/**
 * Catch up on all overdue releases (mark as seen).
 */

async function catchUpCal() {
    showConfirmationModal(
        'Catch Up on Releases?',
        'This will mark all overdue releases as read and remove them from your upcoming list.',
        async () => {
            try {
                const res = await fetch('/api/releases/catch-up', { method: 'POST' });
                if (res.ok) {
                    window.showToast('All caught up!', 'success');
                    // Refresh view
                    if (calendarState.currentView === 'upcoming') {
                        loadUpcomingReleases().then(renderUpcomingView);
                    }
                } else {
                    window.showToast('Failed to update releases', 'error');
                }
            } catch (e) {
                console.error('Error catching up:', e);
                window.showToast('Error catching up', 'error');
            }
        },
        'info'
    );
}

// =============================================================================
// ADD EVENT MODAL
// =============================================================================

/**
 * Opens the Add/Edit Event modal.
 * @param {Object|null} release - Release object to edit, or null for new event
 * @param {string|null} dateStr - Optional date string to pre-fill
 */
function openAddEventModal(release = null, dateStr = null) {
    const modal = document.getElementById('addEventModal');
    if (!modal) return;

    // Reset UI State
    const deleteBtn = document.getElementById('btnDeleteEvent');
    const submitBtnLabel = document.getElementById('btnAddEventLabel');
    const modalTitle = document.getElementById('addEventModalTitle');

    if (release) {
        // EDIT MODE
        calendarState.currentEditingId = release.id;
        modalTitle.textContent = 'Edit Release';
        submitBtnLabel.textContent = 'Update';
        deleteBtn.classList.remove('hidden');

        // Fill Form
        document.getElementById('addEventContent').value = release.content || '';
        document.getElementById('addEventDate').value = release.date.split('T')[0];
        document.getElementById('addEventTime').value = release.time || '';
        // Tracked is always true for now, hidden from UI

        // Hide recurrence for edit mode (simpler to just edit individual events)
        document.getElementById('addEventRecur').checked = false;
        document.getElementById('addEventRecur').parentElement.parentElement.classList.add('hidden');
        document.getElementById('recurrenceOptions').classList.add('hidden');

        // Handle Associated Item
        if (release.item) {
            // Simulate selection
            calendarState.selectedMediaItem = release.item;

            document.getElementById('addEventSearch').value = '';
            document.getElementById('addEventSearch').parentElement.classList.add('hidden');
            document.getElementById('addEventSuggestions').classList.add('hidden');

            const preview = document.getElementById('addEventSelectedItem');
            preview.classList.remove('hidden');
            preview.classList.add('flex');

            document.getElementById('selectedItemTitle').textContent = release.item.title;
            document.getElementById('selectedItemType').textContent = release.item.type;
            document.getElementById('selectedItemCover').src = release.item.coverUrl ? `/images/${release.item.coverUrl}` : '';
            if (release.item.coverUrl) document.getElementById('selectedItemCover').loading = "lazy";
        } else {
            clearSelectedMediaItem();
        }

    } else {
        // ADD MODE
        calendarState.currentEditingId = null;
        modalTitle.textContent = 'Add New Release';
        submitBtnLabel.textContent = 'Create';
        deleteBtn.classList.add('hidden');

        // Reset Form
        document.getElementById('addEventSearch').value = '';
        document.getElementById('addEventContent').value = '';

        // Set Date: use provided dateStr or today
        let defaultDate = new Date().toISOString().split('T')[0];
        if (dateStr) defaultDate = dateStr;

        document.getElementById('addEventDate').value = defaultDate;
        document.getElementById('addEventTime').value = '';
        document.getElementById('addEventRecur').checked = false;
        if (typeof toggleRecurrence === 'function') toggleRecurrence(false);
        document.getElementById('recurrenceFreq').value = 'weekly';
        document.getElementById('recurrenceCount').value = '12';
        document.getElementById('recurrenceUseCounter').checked = true;
        document.getElementById('recurrenceStartCount').value = '1';
        document.getElementById('recurrencePrefix').value = ''; // Reset prefix
        document.getElementById('startCountContainer').classList.remove('opacity-50');
        document.getElementById('recurrenceStartCount').disabled = false;

        document.getElementById('addEventSuggestions').classList.add('hidden');
        clearSelectedMediaItem();
    }

    modal.classList.remove('hidden');
}

/**
 * Prepares to edit an event by ID.
 * Finds the event in the current state and opens the modal.
 */
function prepareEditEvent(releaseId) {
    const release = calendarState.releases.find(r => r.id == releaseId);
    if (release) {
        openAddEventModal(release);
    }
}

/**
 * Closes the Add Event modal.
 */
function closeAddEventModal() {
    const modal = document.getElementById('addEventModal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Searches for media items with autocomplete.
 * Prioritizes Planning/Anticipating/Reading/Watching items.
 * @param {string} query - Search query
 */
function searchMediaItems(query) {
    clearTimeout(calendarState.searchTimeout);
    const suggestions = document.getElementById('addEventSuggestions');

    if (!query || query.length < 2) {
        suggestions.classList.add('hidden');
        return;
    }

    calendarState.searchTimeout = setTimeout(() => {
        // Access global state from state.js (window.state is populated by state.js)
        const items = window.state?.items || [];

        const lowerQuery = query.toLowerCase();
        const matches = items.filter(item =>
            item.title.toLowerCase().includes(lowerQuery) ||
            (item.romajiTitle && item.romajiTitle.toLowerCase().includes(lowerQuery))
        );

        // Sort: Priority (Planning/Anticipating etc) first, then Alphabetical
        const priorityStatuses = ['Planning', 'Anticipating', 'Reading', 'Watching'];

        matches.sort((a, b) => {
            const aPriority = priorityStatuses.includes(a.userData?.status);
            const bPriority = priorityStatuses.includes(b.userData?.status);

            if (aPriority && !bPriority) return -1;
            if (!aPriority && bPriority) return 1;
            return a.title.localeCompare(b.title);
        });

        // Render suggestions
        if (matches.length > 0) {
            suggestions.innerHTML = matches.slice(0, 10).map(item => {
                const typeColorClass = TEXT_COLORS_MAP[item.type] || 'text-zinc-500';
                const iconName = ICON_MAP[item.type] || 'box';

                return `
                <div onclick="selectMediaItem('${item.id}')" 
                    class="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                    <img src="${item.coverUrl ? '/images/' + item.coverUrl : '/static/img/placeholder_cover.jpg'}" 
                        class="w-10 h-14 object-cover rounded shadow-sm bg-zinc-200" loading="lazy" onerror="this.src='/static/img/no-cover.png'">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-sm text-zinc-900 dark:text-white truncate">${item.title}</h4>
                        <div class="flex items-center gap-2 text-xs mt-1">
                            ${item.userData?.status ? `
                                <span class="${item.userData?.status === 'Planning' ? 'text-emerald-500' : 'text-zinc-500'} font-medium">
                                    ${item.userData.status}
                                </span>
                                <span class="text-zinc-300 dark:text-zinc-700">•</span>
                            ` : ''}
                            <div class="flex items-center gap-1.5 ${typeColorClass} font-bold">
                                <i data-lucide="${iconName}" class="w-3 h-3"></i>
                                <span>${item.type}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `}).join('');
            suggestions.classList.remove('hidden');
            if (typeof lucide !== 'undefined') safeCreateIcons();
        } else {
            suggestions.classList.add('hidden');
        }
    }, 300);
}

/**
 * Selects a media item from suggestions.
 */
function selectMediaItem(itemId) {
    const item = window.state.items.find(i => i.id === itemId);
    if (!item) return;

    calendarState.selectedMediaItem = item;

    // Update UI
    document.getElementById('addEventSearch').parentElement.classList.add('hidden');
    document.getElementById('addEventSuggestions').classList.add('hidden');

    const preview = document.getElementById('addEventSelectedItem');
    preview.classList.remove('hidden');
    preview.classList.add('flex');

    document.getElementById('selectedItemTitle').textContent = item.title;
    document.getElementById('selectedItemType').textContent = item.type;
    document.getElementById('selectedItemCover').src = item.coverUrl ? `/images/${item.coverUrl}` : '';
    if (item.coverUrl) document.getElementById('selectedItemCover').loading = "lazy";
}

/**
 * Clears the selected media item.
 */
function clearSelectedMediaItem() {
    calendarState.selectedMediaItem = null;
    document.getElementById('addEventSearch').value = '';
    document.getElementById('addEventSearch').parentElement.classList.remove('hidden');
    document.getElementById('addEventSelectedItem').classList.add('hidden');
    document.getElementById('addEventSelectedItem').classList.remove('flex');
}

/**
 * Toggles the disabled state of recurrence options.
 * @param {boolean} enabled - Whether recurrence is enabled
 */
function toggleRecurrence(enabled) {
    const container = document.getElementById('recurrenceOptions');
    if (!container) return;

    // Visual state
    if (enabled) {
        container.classList.remove('hidden');
        // Small delay to allow transition if we added one, but for now just show
    } else {
        container.classList.add('hidden');
    }

    // Functional state
    const inputs = container.querySelectorAll('input, select');
    inputs.forEach(input => input.disabled = !enabled);
}

/**
 * Submits the new or updated event.
 */
async function submitNewEvent() {
    const content = document.getElementById('addEventContent').value;
    const date = document.getElementById('addEventDate').value;
    const time = document.getElementById('addEventTime').value;

    // Recurrence fields
    const isRecurring = document.getElementById('addEventRecur').checked;
    const recurrenceFreq = document.getElementById('recurrenceFreq').value;
    const recurrenceCount = document.getElementById('recurrenceCount').value;
    const useCounter = document.getElementById('recurrenceUseCounter').checked;
    const startCount = document.getElementById('recurrenceStartCount').value;
    const prefix = document.getElementById('recurrencePrefix').value;

    if (!date) {
        showToast('Date is required', 'error');
        return;
    }

    // If no content provided, use title or generic text

    const payload = {
        date: date,
        time: time || null,
        content: content,
        itemId: calendarState.selectedMediaItem?.id || null,
        isTracked: true, // Always track
        recurrence: isRecurring ? {
            frequency: recurrenceFreq,
            count: parseInt(recurrenceCount),
            useCounter: useCounter,
            startCount: parseInt(startCount),
            prefix: prefix.trim() // Send custom prefix
        } : null
    };

    const isEdit = !!calendarState.currentEditingId;
    const url = isEdit ? `/api/releases/${calendarState.currentEditingId}` : '/api/releases';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const item = calendarState.selectedMediaItem;
            const message = isEdit ? 'Event updated successfully.' : 'New event created.';

            if (item && item.coverUrl) {
                showRichToast({
                    title: isEdit ? `Updated Event: ${item.title}` : `New Event: ${item.title}`,
                    message: message,
                    coverUrl: item.coverUrl,
                    type: 'success'
                });
            } else {
                showToast(isEdit ? 'Event updated' : 'Event created', 'success');
            }

            closeAddEventModal();
            // Refresh current view
            if (calendarState.currentView === 'month') {
                loadReleasesForMonth().then(renderMonthView);
            } else {
                loadUpcomingReleases().then(renderUpcomingView);
            }
        } else {
            showToast('Failed to save event', 'error');
        }
    } catch (error) {
        console.error('Error saving event:', error);
        showToast('Error saving event', 'error');
    }
}

/**
 * Deletes the current editing event.
 */
async function deleteEvent() {
    if (!calendarState.currentEditingId) return;

    showConfirmationModal(
        'Delete Event?',
        'Are you sure you want to delete this release event? This action cannot be undone.',
        async () => {
            try {
                const response = await fetch(`/api/releases/${calendarState.currentEditingId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const item = calendarState.selectedMediaItem;
                    if (item && item.coverUrl) {
                        showRichToast({
                            title: `Deleted Event`,
                            message: `Removed '${item.title}' from calendar.`,
                            coverUrl: item.coverUrl,
                            type: 'info'
                        });
                    } else {
                        showToast('Event deleted', 'success');
                    }

                    closeAddEventModal();
                    if (calendarState.currentView === 'month') {
                        loadReleasesForMonth().then(renderMonthView);
                    } else {
                        loadUpcomingReleases().then(renderUpcomingView);
                    }
                } else {
                    showToast('Failed to delete event', 'error');
                }
            } catch (error) {
                console.error('Error deleting event:', error);
                showToast('Error deleting event', 'error');
            }
        },
        'warning'
    );
}

// =============================================================================
// MONTH/YEAR PICKER
// =============================================================================

/**
 * Opens the month/year picker overlay.
 */
function openMonthYearPicker() {
    const picker = document.getElementById('monthYearPicker');
    if (!picker) return;

    calendarState.pickerYear = calendarState.currentYear;
    picker.classList.remove('hidden');
    picker.classList.add('flex');
    renderMonthGrid();

    safeCreateIcons();
}

/**
 * Closes the month/year picker overlay.
 */
function closeMonthYearPicker() {
    const picker = document.getElementById('monthYearPicker');
    if (!picker) return;
    picker.classList.add('hidden');
    picker.classList.remove('flex');
}

/**
 * Changes the year in the picker.
 * @param {number} delta - Year change (-1 or 1)
 */
function changePickerYear(delta) {
    calendarState.pickerYear += delta;
    document.getElementById('pickerYearLabel').textContent = calendarState.pickerYear;
    renderMonthGrid();
}

/**
 * Renders the month selection grid.
 */
function renderMonthGrid() {
    const grid = document.getElementById('pickerMonthGrid');
    const yearLabel = document.getElementById('pickerYearLabel');
    if (!grid || !yearLabel) return;

    yearLabel.textContent = calendarState.pickerYear;

    grid.innerHTML = MONTH_NAMES_SHORT.map((name, index) => {
        const isCurrentMonth = index === calendarState.currentMonth &&
            calendarState.pickerYear === calendarState.currentYear;
        const isToday = index === new Date().getMonth() &&
            calendarState.pickerYear === new Date().getFullYear();

        return `
            <button onclick="selectMonth(${index})" 
                class="py-3 rounded-xl text-sm font-bold transition-all
                    ${isCurrentMonth
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : isToday
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}">
                ${name}
            </button>
        `;
    }).join('');
}

/**
 * Selects a month from the picker.
 * @param {number} month - Month index (0-11)
 */
function selectMonth(month) {
    calendarState.currentYear = calendarState.pickerYear;
    calendarState.currentMonth = month;
    closeMonthYearPicker();
    loadReleasesForMonth().then(renderMonthView);
}

// =============================================================================
// DATA LOADING
// =============================================================================

/**
 * Loads releases for the current month view.
 * @returns {Promise<Array>} Release data
 */
async function loadReleasesForMonth() {
    const year = calendarState.currentYear;
    const month = calendarState.currentMonth;

    // Calculate date range (include surrounding days for calendar display)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Extend range to cover visible calendar cells
    const from = new Date(firstDay);
    from.setDate(from.getDate() - 7);
    const to = new Date(lastDay);
    to.setDate(to.getDate() + 7);

    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const t = Date.now();
        const response = await fetch(`/api/releases?from=${fromStr}&to=${toStr}&t=${t}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            calendarState.releases = await response.json();
        } else {
            console.error('Fetch failed:', response.status);
            calendarState.releases = [];
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Fetch timed out');
        } else {
            console.error('Failed to load releases:', error);
        }
        calendarState.releases = [];
    }

    return calendarState.releases;
}

/**
 * Loads upcoming releases from today.
 * @returns {Promise<Array>} Release data
 */
async function loadUpcomingReleases() {
    try {
        const t = Date.now();
        const response = await fetch(`/api/releases/upcoming?limit=50&t=${t}`);
        if (response.ok) {
            calendarState.releases = await response.json();
        } else {
            calendarState.releases = [];
        }
    } catch (error) {
        console.error('Failed to load upcoming releases:', error);
        calendarState.releases = [];
    }

    return calendarState.releases;
}

// =============================================================================
// RENDERING - MONTH VIEW
// =============================================================================

/**
 * Renders the month view calendar grid.
 */
function renderMonthView() {
    const grid = document.getElementById('calendarDaysGrid');
    const label = document.getElementById('calendarMonthLabel');
    if (!grid || !label) return;

    const year = calendarState.currentYear;
    const month = calendarState.currentMonth;

    // Update month label
    label.textContent = `${MONTH_NAMES[month]} ${year}`;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Get the day of week for the first day (Monday = 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    // Today's date for highlighting
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    // Build calendar cells
    let html = '';

    // Previous month's trailing days
    if (startDayOfWeek > 0) {
        const prevMonth = new Date(year, month, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            const dateStr = formatDateString(year, month - 1, day);
            const releases = getReleasesForDate(dateStr);
            html += renderDayCell(day, dateStr, releases, true, false);
        }
    }

    // Current month's days
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = formatDateString(year, month, day);
        const releases = getReleasesForDate(dateStr);
        const isToday = isCurrentMonth && day === today.getDate();
        html += renderDayCell(day, dateStr, releases, false, isToday);
    }

    // Next month's leading days
    const totalCells = startDayOfWeek + totalDays;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remainingCells; day++) {
        const dateStr = formatDateString(year, month + 1, day);
        const releases = getReleasesForDate(dateStr);
        html += renderDayCell(day, dateStr, releases, true, false);
    }

    grid.innerHTML = html;

    // Initialize all carousels to show first card centered
    initializeCarousels();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Initializes all carousel card positions.
 */
function initializeCarousels() {
    const carousels = document.querySelectorAll('[id^="carousel-"]');
    carousels.forEach(carousel => {
        const total = parseInt(carousel.dataset.carouselTotal);
        if (total > 0) {
            updateCarouselPositions(carousel, 0, total);
        }
    });
}

/**
 * Renders a single day cell with carousel-style stacked cards.
 */
function renderDayCell(day, dateStr, releases, isOtherMonth, isToday) {
    const hasReleases = releases.length > 0;
    const carouselId = `carousel-${dateStr}`;

    // Determine cell content
    let contentHtml = '';

    if (hasReleases) {
        // 3D Carousel Stack: Center card is prominent, side cards peek from behind
        // Mouse wheel scrolling cycles through cards

        contentHtml = `
            <div class="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center pointer-events-none"
                 id="${carouselId}"
                 data-carousel-index="0"
                 data-carousel-total="${releases.length}"
                 onwheel="handleCarouselWheel(event, '${carouselId}')">
                
                <div class="relative w-full h-full flex items-center justify-center"
                     style="perspective: 400px;">
                    ${releases.map((r, index) => {
            let content = '';
            const typeColorClass = r.item?.type ? (TYPE_COLORS[r.item.type] || 'bg-zinc-400') : 'bg-emerald-500';
            const borderColorClass = r.item?.type ? (BORDER_COLORS[r.item.type] || 'border-zinc-400') : 'border-emerald-500';

            if (r.item && r.item.coverUrl) {
                content = `<img src="/images/${r.item.coverUrl}" 
                                            class="w-full h-full object-cover rounded-lg shadow-lg border-2 ${borderColorClass}" 
                                            loading="lazy"
                                            title="${r.item.title} (${r.content})"
                                            onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full ${typeColorClass} rounded-lg flex items-center justify-center border-2 ${borderColorClass}\\'><span class=\\'text-[10px] font-bold text-white text-center px-1\\'>${r.item?.title || r.content}</span></div>'">`
            } else {
                // Fallback/Text card - full size solid background
                content = `<div class="absolute inset-0 ${typeColorClass} rounded-lg shadow-lg flex items-center justify-center p-2 border-2 ${borderColorClass}">
                                            <span class="text-xs font-bold text-white text-center break-words leading-tight line-clamp-4">${r.item?.title || r.content}</span>
                                       </div>`;
            }

            return `
                            <div class="carousel-card absolute transition-all duration-300 ease-out cursor-pointer flex items-center justify-center pointer-events-auto"
                                data-card-index="${index}"
                                style="height: 100%;"
                                onclick="">
                                <div class="h-full relative" style="aspect-ratio: 3/4;">
                                    ${content}
                                    ${r.time ? `<div class="absolute bottom-1 right-1 bg-black/60 backdrop-blur-[2px] px-1.5 py-0.5 rounded text-[9px] font-bold text-white z-[71] pointer-events-none border border-white/10 ring-1 ring-black/20">${r.time}</div>` : ''}
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
                
                ${releases.length > 1 ? `
                    <div class="absolute bottom-1 left-1/2 -translate-x-1/2 z-[70] flex gap-1 pointer-events-auto">
                        ${releases.map((_, i) => `
                            <div class="carousel-dot w-1.5 h-1.5 rounded-full bg-white/40 transition-all cursor-pointer hover:bg-white/70" 
                                 data-dot-index="${i}"
                                 onclick="event.stopPropagation(); handleCarouselDotClick('${carouselId}', ${i})"></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    return `
        <div onclick="event.stopPropagation(); showDayDetail('${dateStr}')"
            class="calendar-day-cell aspect-square rounded-xl flex flex-col items-stretch justify-start overflow-hidden transition-all relative group/cell cursor-pointer
                ${isOtherMonth
            ? 'bg-zinc-50 dark:bg-zinc-900/30'
            : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800'}
                ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-950' : ''}">
            
            <div class="absolute top-1 left-2 z-[70] pointer-events-none">
                <span class="text-xs font-bold drop-shadow-md py-0.5 px-1.5 rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-[2px] 
                    ${isOtherMonth ? 'text-zinc-400 dark:text-zinc-600' : (isToday ? 'text-emerald-600 dark:text-emerald-400 bg-white/80 dark:bg-black/40' : 'text-zinc-700 dark:text-zinc-200')}">
                    ${day}
                </span>
            </div>
            
            ${contentHtml}
        </div>
    `;
}

/**
 * Handles mouse wheel scrolling on carousel.
 */
function handleCarouselWheel(event, carouselId) {
    event.preventDefault();
    event.stopPropagation();

    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const total = parseInt(carousel.dataset.carouselTotal);
    if (total <= 1) return;

    let currentIndex = parseInt(carousel.dataset.carouselIndex);

    // Scroll direction
    if (event.deltaY > 0) {
        currentIndex = (currentIndex + 1) % total;
    } else {
        currentIndex = (currentIndex - 1 + total) % total;
    }

    carousel.dataset.carouselIndex = currentIndex;
    updateCarouselPositions(carousel, currentIndex, total);
}

/**
 * Handles clicking on a carousel dot.
 */
function handleCarouselDotClick(carouselId, index) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    const total = parseInt(carousel.dataset.carouselTotal);
    if (index >= 0 && index < total) {
        carousel.dataset.carouselIndex = index;
        updateCarouselPositions(carousel, index, total);
    }
}

/**
 * Updates the visual positions of carousel cards.
 */
function updateCarouselPositions(carousel, activeIndex, total) {
    const cards = carousel.querySelectorAll('.carousel-card');
    const dots = carousel.querySelectorAll('.carousel-dot');

    cards.forEach((card, index) => {
        const offset = index - activeIndex;

        // Calculate position relative to center
        let translateX = 0;
        let translateZ = 0;
        let scale = 1;
        let opacity = 1;
        let zIndex = 10;

        if (offset === 0) {
            // Center/active card
            translateX = 0;
            translateZ = 0;
            scale = 1;
            opacity = 1;
            zIndex = 30;
        } else if (offset === 1 || offset === -(total - 1)) {
            // Right card (next)
            translateX = 35;
            translateZ = -50;
            scale = 0.8;
            opacity = 0.6;
            zIndex = 20;
        } else if (offset === -1 || offset === (total - 1)) {
            // Left card (previous)
            translateX = -35;
            translateZ = -50;
            scale = 0.8;
            opacity = 0.6;
            zIndex = 20;
        } else {
            // Hidden cards
            translateX = offset > 0 ? 60 : -60;
            translateZ = -100;
            scale = 0.6;
            opacity = 0;
            zIndex = 10;
        }

        card.style.transform = `translateX(${translateX}%) translateZ(${translateZ}px) scale(${scale})`;
        card.style.opacity = opacity;
        card.style.zIndex = zIndex;
    });

    // Update dots
    dots.forEach((dot, index) => {
        if (index === activeIndex) {
            dot.classList.remove('bg-white/40');
            dot.classList.add('bg-white', 'w-2.5');
        } else {
            dot.classList.remove('bg-white', 'w-2.5');
            dot.classList.add('bg-white/40');
        }
    });
}

// =============================================================================
// RENDERING - UPCOMING VIEW
// =============================================================================

/**
 * Renders the upcoming events list as a horizontal scroll.
 */
function renderUpcomingView() {
    const list = document.getElementById('calendarUpcomingList');
    if (!list) return;

    try {
        if (!calendarState.releases || calendarState.releases.length === 0) {
            list.className = "flex items-center justify-center w-full h-full";
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center py-16">
                    <i data-lucide="calendar-x" class="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4"></i>
                    <h3 class="text-lg font-bold text-zinc-500 dark:text-zinc-400 mb-2">No Upcoming Releases</h3>
                    <p class="text-sm text-zinc-400 dark:text-zinc-600">You're all caught up!</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Reset class for horizontal scroll
        list.className = "flex-1 overflow-x-auto custom-scrollbar p-6 flex items-start gap-6";

        // Enable horizontal scroll with mouse wheel
        list.onwheel = (evt) => {
            if (evt.deltaY === 0) return;
            evt.preventDefault();
            list.scrollLeft += evt.deltaY;
        };

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Sort releases by date and then time (NULL considered 00:00)
        const sortedReleases = [...calendarState.releases].sort((a, b) => {
            // Robust Date Comparison (Local)
            const aParts = a.date.split('-').map(Number);
            const bParts = b.date.split('-').map(Number);
            const aDate = new Date(aParts[0], aParts[1] - 1, aParts[2]);
            const bDate = new Date(bParts[0], bParts[1] - 1, bParts[2]);

            const dateDiff = aDate - bDate;
            if (dateDiff !== 0) return dateDiff;

            // Time Sorting: No time = Start of Day (00:00:00)
            // As per new requirement: "All without time should be considered as 0:00 of that day"
            const timeA = a.time || '00:00:00';
            const timeB = b.time || '00:00:00';
            return timeA.localeCompare(timeB);
        });

        // Find the split point between overdue (past) and future

        // New requirement: "All stuff that is realease today... should all be moved into the pre today line"
        // Future = Date > Today
        const firstFutureIndex = sortedReleases.findIndex(r => {
            const parts = r.date.split('-').map(Number);
            const rDate = new Date(parts[0], parts[1] - 1, parts[2]);
            return rDate > todayDate; // Changed from >= to >
        });

        let html = '';


        // Render Items
        sortedReleases.forEach((r, index) => {
            // Month delimiter check inside loop to handle all items in order
            if (index > 0) {
                const prevDate = new Date(sortedReleases[index - 1].date);
                const currDate = new Date(r.date);
                // Skip delimiter if we are exactly at the "Today" split point to avoid double lines
                if (prevDate.getMonth() !== currDate.getMonth() || prevDate.getFullYear() !== currDate.getFullYear()) {
                    const monthName = MONTH_NAMES[currDate.getMonth()];
                    const year = currDate.getFullYear();
                    html += `
                        <div class="h-full w-10 shrink-0 flex flex-col items-center justify-center gap-2">
                             <div class="h-full w-px bg-zinc-200 dark:bg-zinc-800"></div>
                             <div class="py-4 text-xs font-bold text-zinc-400 -rotate-90 whitespace-nowrap tracking-widest uppercase">
                                ${monthName} ${year}
                             </div>
                             <div class="h-full w-px bg-zinc-200 dark:bg-zinc-800"></div>
                        </div>
                    `;
                }
            }

            // If this is the start of the future section (and not the very first item), insert delimiter
            if (index === firstFutureIndex && firstFutureIndex > 0) {
                html += `
                    <div class="h-full w-px mx-6 flex flex-col items-center justify-center gap-2 shrink-0">
                         <div class="h-full w-0.5 bg-red-500/50 rounded-full"></div>
                         <div class="py-6 px-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-500">
                            <span class="text-sm font-bold whitespace-nowrap -rotate-90 block tracking-wider">TODAY</span>
                         </div>
                         <div class="h-full w-0.5 bg-red-500/50 rounded-full"></div>
                    </div>
                `;
            }

            try {
                html += renderUpcomingItem(r);
            } catch (err) {
                console.error("Error rendering upcoming item:", err);
            }
        });

        html += `<div id="upcomingEndTrigger" class="w-4 h-full shrink-0"></div>`;
        list.innerHTML = html;

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

    } catch (e) {
        console.error("Critical error in renderUpcomingView:", e);
        list.innerHTML = `<div class="p-10 text-zinc-500 text-center font-medium">Unable to load upcoming releases. Please try again.</div>`;
    }
}


/**
 * Renders a single upcoming release item card.
 * 
 * Features:
 * - Responsive sizing based on viewport height (vh)
 * - Dynamic color theming based on media type
 * - Hover effects for cover image and action buttons
 * - "Seen" and "Delete" actions
 * 
 * @param {Object} release - The release object containing date, time, and associated item
 * @returns {string} HTML string for the release card
 */
function renderUpcomingItem(release) {
    const item = release.item;
    const type = item?.type || 'Other';

    // Global Card Styles
    const cardStyles = TYPE_COLOR_MAP[type] || 'bg-zinc-800 border-zinc-700';
    const textColor = TEXT_COLORS_MAP[type] || 'text-zinc-500';
    const borderColor = BORDER_COLORS[type] || 'border-zinc-700';
    const iconName = ICON_MAP[type] || 'calendar';

    const dateObj = new Date(release.date);
    // FULL MONTH NAME
    const monthStr = MONTH_NAMES[dateObj.getMonth()];
    const dayStr = dateObj.getDate();
    // FULL WEEKDAY NAME
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    const iconBg = TYPE_COLORS[type] || 'bg-zinc-800';
    const rating = item?.userData?.rating || 0;

    // Determine color name for gradient (simplified mapping)
    const colorRoot =
        type === 'Anime' ? 'violet' :
            type === 'Manga' ? 'pink' :
                type === 'Book' ? 'blue' :
                    type === 'Movie' ? 'red' :
                        type === 'Series' ? 'amber' : 'emerald';

    // Maximized Card Dimensions for Image
    const coverHeightVal = 50;
    // Calculate width: (50 * 2/3) vh
    const cardWidthStyle = `style="width: calc(${coverHeightVal}vh * 0.666)"`;
    // Use inline style for height to avoid Tailwind scanner issues
    const coverHeightStyle = `style="height: ${coverHeightVal}vh"`;

    // Determine isTracked status for action button
    const isTracked = release.isTracked !== false;

    return `
        <div class="flex flex-col gap-3 shrink-0 group snap-start cursor-pointer mb-2 relative" ${cardWidthStyle} onclick="window.openDetail('${item?.id || ''}')">
            
            <!-- Date atop card -->
            <div class="flex items-baseline gap-2 px-1">
                <span class="text-4xl font-bold text-zinc-900 dark:text-white">${dayStr}</span>
                <div class="flex flex-col leading-none">
                    <span class="text-sm font-bold ${textColor}">${monthStr}</span>
                    <span class="text-xs font-medium text-zinc-400 uppercase">${dayName}</span>
                </div>
                ${release.time ? `
                <div class="ml-auto bg-${colorRoot}-50 dark:bg-${colorRoot}-500/10 px-2 py-0.5 rounded-md border border-${colorRoot}-200 dark:border-${colorRoot}-500/20 flex items-center gap-1.5 shadow-sm">
                    <i data-lucide="clock" class="w-2.5 h-2.5 text-${colorRoot}-500/70 dark:text-${colorRoot}-400/70"></i>
                    <span class="text-[10px] font-bold text-${colorRoot}-700 dark:text-${colorRoot}-300 font-mono tracking-tight">${release.time}</span>
                </div>
                ` : ''}
            </div>

            <!-- Cover Image Container (The "Box") -->
            <div class="relative w-full rounded-2xl overflow-hidden shadow-xl transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl bg-gradient-to-br from-${colorRoot}-500/80 via-${colorRoot}-500/20 to-transparent p-[4px]" ${coverHeightStyle}>
                <div class="w-full h-full rounded-2xl overflow-hidden bg-zinc-900 relative">
         ${item?.coverUrl
            ? `<img src="/images/${item.coverUrl}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy">`
            : `<div class="w-full h-full flex items-center justify-center flex-col gap-3 opacity-50">
                         <i data-lucide="${iconName}" class="w-16 h-16 ${textColor}"></i>
                         <span class="text-zinc-500 font-bold text-xl text-center px-6">${item?.title || 'No Cover'}</span>
                       </div>`
        }
                </div>
                
                <!-- Media Type Icon (Floating top left) -->
                <div class="absolute top-4 left-4 w-12 h-12 rounded-xl ${iconBg} text-white flex items-center justify-center shadow-lg z-10 border border-white/20">
                    <i data-lucide="${iconName}" class="w-6 h-6"></i>
                </div>

                <!-- ACTION BUTTONS (Overlay on hover) -->
                <div class="absolute inset-0 bg-black/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col z-20">
                    
                    <!-- Mark as Seen -->
                    <button onclick="event.stopPropagation(); toggleReleaseSeen('${release.id}', ${isTracked})"
                            class="flex-1 w-full flex items-center justify-center gap-2 hover:bg-emerald-500/20 text-white transition-colors group/btn border-b border-white/10"
                            title="${isTracked ? 'Mark as Seen' : 'Mark as Unseen'}">
                        <i data-lucide="${isTracked ? 'eye-off' : 'eye'}" class="w-4 h-4 group-hover/btn:scale-110 transition-transform"></i>
                        <span class="font-bold text-[10px] uppercase tracking-wider">${isTracked ? 'Mark Seen' : 'Mark Unseen'}</span>
                    </button>

                    <!-- Edit -->
                    <button onclick="event.stopPropagation(); prepareEditEvent('${release.id}')"
                            class="flex-1 w-full flex items-center justify-center gap-2 hover:bg-indigo-500/20 text-white transition-colors group/btn border-b border-white/10"
                            title="Edit Release">
                        <i data-lucide="edit-2" class="w-4 h-4 group-hover/btn:scale-110 transition-transform"></i>
                        <span class="font-bold text-[10px] uppercase tracking-wider">Edit</span>
                    </button>

                    <!-- Delete -->
                    <button onclick="event.stopPropagation(); deleteRelease('${release.id}')"
                            class="flex-1 w-full flex items-center justify-center gap-2 hover:bg-red-500/20 text-white transition-colors group/btn"
                            title="Delete Release">
                        <i data-lucide="trash-2" class="w-4 h-4 group-hover/btn:scale-110 transition-transform"></i>
                        <span class="font-bold text-[10px] uppercase tracking-wider">Delete</span>
                    </button>
                </div>
            </div>

            <!-- Text Content (Below the box) -->
            <div class="flex flex-col px-1">
                <!-- Title (Truncated again) -->
                <h3 class="font-heading font-bold text-xl ${textColor} leading-tight mb-2 group-hover:underline decoration-2 underline-offset-4" title="${item?.title || ''}">
                    ${item?.title || 'Unknown Title'}
                </h3>
                
                <!-- Description -->
                ${release.content ? `
                <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    ${release.content}
                </p>
                ` : ''}
            </div>
        </div>
    `;
}

// =============================================================================
// DAY DETAIL PANEL
// =============================================================================

/**
 * Shows the day detail panel for a specific date.
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 */
function showDayDetail(dateStr) {
    const panel = document.getElementById('calendarDayDetail');
    const dateLabel = document.getElementById('dayDetailDate');
    const content = document.getElementById('dayDetailContent');

    if (!panel || !content) return;

    // Format date for display
    const date = new Date(dateStr);
    dateLabel.textContent = formatDisplayDate(date);
    const releases = getReleasesForDate(dateStr);

    // Render releases
    if (releases.length > 0) {
        content.innerHTML = releases.map(r => renderDayDetailItem(r)).join('');
    } else {
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-zinc-400 dark:text-zinc-600">
                <i data-lucide="calendar-x" class="w-12 h-12 mb-3 opacity-50"></i>
                <p class="text-sm font-medium">No releases for this day</p>
            </div>
        `;
    }

    // Show panel with animation
    panel.classList.remove('hidden');
    requestAnimationFrame(() => {
        panel.classList.remove('translate-x-full');
    });

    calendarState.selectedDay = dateStr;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Renders a single release item for the day detail sidebar.
 * Expandable card with action buttons.
 */
function renderDayDetailItem(release) {
    const item = release.item;
    const type = item?.type || 'Other';
    const isTracked = release.isTracked !== false; // Default true

    // Use maps for styling to ensure consistency
    const borderColor = BORDER_COLORS[type] || 'border-zinc-200 dark:border-zinc-700';
    const textColor = TEXT_COLORS_MAP[type] || 'text-zinc-700 dark:text-zinc-300';
    const bgColor = TYPE_COLORS[type] || 'bg-zinc-500';
    const iconName = ICON_MAP[type] || 'calendar';

    // Determine color name for gradient (simplified mapping)
    const colorRoot =
        type === 'Anime' ? 'violet' :
            type === 'Manga' ? 'pink' :
                type === 'Book' ? 'blue' :
                    type === 'Movie' ? 'red' :
                        type === 'Series' ? 'amber' : 'emerald';

    // CSS Classes for the "Selected" state (which is .is-expanded in this case)
    // Fading border from top-left: We use a gradient background that looks like a top-left tint fade
    // plus a top and left border that appears on selection.
    const selectedClasses = `
        [&.is-expanded]:bg-gradient-to-br 
        [&.is-expanded]:from-${colorRoot}-500/10 
        [&.is-expanded]:via-transparent 
        [&.is-expanded]:to-transparent
        [&.is-expanded]:ring-2
        [&.is-expanded]:ring-${colorRoot}-500/50
        [&.is-expanded]:border-transparent
    `;

    return `
        <div class="release-item flex gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group relative border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700/50 ${selectedClasses}"
             onclick="handleReleaseClick(this, '${release.id}', '${item?.id || ''}')">
            
            <!-- Image/Cover -->
            <div class="w-16 h-24 rounded-lg overflow-hidden border-2 ${borderColor} shrink-0 relative">
                ${item?.coverUrl
            ? `<img src="/images/${item.coverUrl}" 
                            class="w-full h-full object-cover" 
                            loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                       <div class="hidden absolute inset-0 ${bgColor} flex items-center justify-center">
                            <i data-lucide="${iconName}" class="w-6 h-6 text-white/80"></i>
                       </div>`
            : `<div class="w-full h-full ${bgColor} flex items-center justify-center">
                            <i data-lucide="${iconName}" class="w-6 h-6 text-white/80"></i>
                       </div>`
        }
            </div>
            
            <!-- Info -->
            <div class="flex-1 min-w-0 flex flex-col">
                <!-- Title (Expandable) -->
                <h4 class="title-el font-bold text-sm ${textColor} line-clamp-2 leading-tight transition-all">
                    ${item?.title || 'Unknown Title'}
                </h4>
                
                <!-- Expanded Content Container -->
                <div class="flex flex-col gap-1 mt-1.5">
                    <!-- Media Type Badge -->
                    <div class="flex items-center gap-1.5">
                        <i data-lucide="${iconName}" class="w-3 h-3 ${textColor}"></i>
                        <span class="text-[10px] font-bold uppercase tracking-wide ${textColor}">${type}</span>
                        ${release.time ? `
                            <span class="text-[10px] text-zinc-300 dark:text-zinc-600">•</span>
                            <div class="flex items-center gap-1 bg-${colorRoot}-50 dark:bg-${colorRoot}-500/10 px-1.5 py-0.5 rounded text-${colorRoot}-700 dark:text-${colorRoot}-300 border border-${colorRoot}-200 dark:border-${colorRoot}-500/20">
                                <i data-lucide="clock" class="w-2.5 h-2.5 opacity-70"></i>
                                <span class="text-[10px] font-bold font-mono">${release.time}</span>
                            </div>
                        ` : ''}
                        ${(item?.status || item?.userData?.status) ? `
                            <span class="text-[10px] text-zinc-300 dark:text-zinc-600">•</span>
                            <span class="text-[10px] font-medium text-zinc-400">${item.status || item.userData.status}</span>
                        ` : ''}
                    </div>

                    <!-- Description/Content -->
                    <p class="desc-el text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5 transition-all">
                        ${release.content}
                    </p>
                </div>

                <!-- Action Buttons (Visible on hover OR when selected) -->
                <div class="flex items-center gap-2 mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-[.is-expanded]:opacity-100 transition-opacity">
                    <button onclick="event.stopPropagation(); deleteRelease('${release.id}')"
                            class="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Delete from Calendar">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>

                    <button onclick="event.stopPropagation(); prepareEditEvent('${release.id}')"
                            class="p-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-zinc-400 hover:text-indigo-500 transition-colors"
                            title="Edit Release">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    
                    <button onclick="event.stopPropagation(); toggleReleaseSeen('${release.id}', ${isTracked})"
                            class="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-zinc-400 ${isTracked ? 'hover:text-emerald-500' : 'text-emerald-500'} transition-colors"
                            title="${isTracked ? 'Mark as Seen' : 'Mark as Unseen'}">
                        <i data-lucide="${isTracked ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>
                    </button>
                    
                     <!-- Spacer -->
                    <div class="flex-1"></div>
                    
                    <!-- Info/Detail Button (Visible on hover OR when selected) -->
                    <button onclick="event.stopPropagation(); window.openDetail('${item?.id || ''}')"
                            class="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-opacity opacity-0 group-hover:opacity-100 group-[.is-expanded]:opacity-100"
                            title="View Details">
                        <i data-lucide="info" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Handles click on release item:
 * 1st click: Expands details
 * 2nd click: Opens item info modal
 * @param {HTMLElement} el - The element clicked
 * @param {string|number} releaseId - ID of the release
 * @param {string|number} itemId - ID of the media item
 */
function handleReleaseClick(el, releaseId, itemId) {
    if (el.classList.contains('is-expanded')) {
        if (itemId && window.openDetail) {
            window.openDetail(itemId);
        }
    } else {
        document.querySelectorAll('.release-item.is-expanded').forEach(item => {
            if (item !== el) {
                item.classList.remove('is-expanded');
                item.querySelector('.title-el').classList.add('line-clamp-2');
                item.querySelector('.desc-el').classList.add('line-clamp-2');
            }
        });

        el.classList.add('is-expanded');
        el.querySelector('.title-el').classList.remove('line-clamp-2');
        el.querySelector('.desc-el').classList.remove('line-clamp-2');
    }
}

/**
 * Deletes a calendar release event.
 * @param {number|string} id - Release ID to delete
 */
async function deleteRelease(id) {
    showConfirmationModal(
        'Remove Event?',
        'Are you sure you want to remove this event from the calendar?',
        async () => {
            try {
                const res = await fetch(`/api/releases/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    // Refresh calendar
                    if (calendarState.currentView === 'upcoming') {
                        loadUpcomingReleases().then(renderUpcomingView);
                    } else {
                        navigateMonth(0); // Reloads current month view
                        // Determine if we need to refresh sidebar (if open)
                        if (calendarState.selectedDay) {
                            setTimeout(() => showDayDetail(calendarState.selectedDay), 500);
                        }
                    }

                    // Show Toast (Ideally look up item before delete, but we can do a generic rich toast if cover is known or just generic)
                    // Since we don't have the item object readily available post-delete without lookup, 
                    // we can't easily show the cover unless we passed it. 
                    // However, we are inside a context where we might knwow it? 
                    // NO, deleteRelease is called from onclick. 
                    // We can try to find it in state releases.

                    let foundItem = null;
                    if (calendarState.releases) {
                        const rel = calendarState.releases.find(r => r.id == id);
                        if (rel) foundItem = rel.item;
                    }

                    if (foundItem && foundItem.coverUrl) {
                        showRichToast({
                            title: 'Event Removed',
                            message: `Removed '${foundItem.title}' from calendar.`,
                            coverUrl: foundItem.coverUrl,
                            type: 'info'
                        });
                    } else {
                        showToast('Event removed from calendar', 'info');
                    }
                } else {
                    console.error('Failed to delete release');
                }
            } catch (e) {
                console.error('Error deleting release:', e);
            }
        },
        'warning'
    );
};

/**
 * Toggles the 'seen' (tracked) status of a release.
 * @param {number|string} id - Release ID
 * @param {boolean} currentIsTracked - Current tracking status
 */
async function toggleReleaseSeen(id, currentIsTracked) {
    const isUpcoming = calendarState.currentView === 'upcoming';
    try {
        const res = await fetch(`/api/releases/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isTracked: !currentIsTracked })
        });

        if (res.ok) {
            if (isUpcoming) {
                loadUpcomingReleases().then(renderUpcomingView);
            } else {
                navigateMonth(0);
                if (calendarState.selectedDay) {
                    setTimeout(() => showDayDetail(calendarState.selectedDay), 500);
                }
            }

            // Show Feedback Toast
            let foundItem = null;
            if (calendarState.releases) {
                const rel = calendarState.releases.find(r => r.id == id);
                if (rel) foundItem = rel.item;
            }

            const action = currentIsTracked ? 'Marked as Seen' : 'Marked as Unseen';
            const type = currentIsTracked ? 'success' : 'info'; // Seen = Success/Green

            if (foundItem && foundItem.coverUrl) {
                showRichToast({
                    title: action,
                    message: `${foundItem.title}`,
                    coverUrl: foundItem.coverUrl,
                    type: type
                });
            } else {
                showToast(`${action}: ${foundItem ? foundItem.title : 'Event'}`, type);
            }
        }
    } catch (e) {
        console.error('Error updating release:', e);
    }
}

/**
 * Closes the day detail panel.
 */
function closeDayDetail() {
    const panel = document.getElementById('calendarDayDetail');
    if (!panel) return;

    panel.classList.add('translate-x-full');
    setTimeout(() => {
        panel.classList.add('hidden');
    }, 300);

    calendarState.selectedDay = null;
}

// =============================================================================
// CONFIRMATION MODAL
// =============================================================================

/**
 * Shows the custom confirmation modal.
 * @param {string} title - Modal title
 * @param {string} message - Modal message (can be longer)
 * @param {Function} onConfirm - Callback function to execute on confirm
 * @param {string} type - 'warning' (formatted as delete/destructive) or 'info' (default)
 * @param {Function} [onCancel] - Optional callback for cancellation
 * @param {string} [confirmText] - Optional text for confirm button
 */
function showConfirmationModal(title, message, onConfirm, type = 'info', onCancel = null, confirmText = 'Confirm') {
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
    if (typeof lucide !== 'undefined') lucide.createIcons();

    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    });
}

/**
 * Closes the confirmation modal.
 */
function closeConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (!modal) return;

    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Formats a date to YYYY-MM-DD string.
 */
function formatDateString(year, month, day) {
    // Handle month overflow/underflow
    const date = new Date(year, month, day);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Formats a date for display.
 */
function formatDisplayDate(date) {
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Gets releases for a specific date.
 */
function getReleasesForDate(dateStr) {
    return calendarState.releases
        .filter(r => r.date === dateStr)
        .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
}

// =============================================================================
// WINDOW BINDINGS
// =============================================================================

window.openCalendarModal = openCalendarModal;
window.closeCalendarModal = closeCalendarModal;
window.setCalendarView = setCalendarView;
window.navigateMonth = navigateMonth;
window.goToToday = goToToday;
window.selectMonth = selectMonth;
window.showDayDetail = showDayDetail;
window.closeDayDetail = closeDayDetail;
window.openAddEventModal = openAddEventModal;
window.closeAddEventModal = closeAddEventModal;
window.searchMediaItems = searchMediaItems;
window.selectMediaItem = selectMediaItem;
window.clearSelectedMediaItem = clearSelectedMediaItem;
window.submitNewEvent = submitNewEvent;
window.deleteEvent = deleteEvent;
window.toggleRecurrence = toggleRecurrence;
window.openMonthYearPicker = openMonthYearPicker;
window.closeMonthYearPicker = closeMonthYearPicker;
window.changePickerYear = changePickerYear;
window.handleCarouselWheel = handleCarouselWheel;
window.handleCarouselDotClick = handleCarouselDotClick;
window.deleteRelease = deleteRelease;
window.toggleReleaseSeen = toggleReleaseSeen;
window.handleReleaseClick = handleReleaseClick;
window.catchUpCal = catchUpCal;
window.prepareEditEvent = prepareEditEvent;
window.showConfirmationModal = showConfirmationModal;
window.closeConfirmationModal = closeConfirmationModal;
