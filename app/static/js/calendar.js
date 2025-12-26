/**
 * @fileoverview Calendar module for UpNext application.
 * Handles release calendar with month view and upcoming view modes.
 * @module calendar
 */

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

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

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

const ICON_MAP = {
    'Book': 'book',
    'Anime': 'tv',
    'Manga': 'file-text',
    'Movie': 'film',
    'Series': 'tv-2'
};

const TEXT_COLORS_MAP = {
    'Anime': 'text-violet-500',
    'Manga': 'text-pink-500',
    'Book': 'text-blue-500',
    'Movie': 'text-red-500',
    'Series': 'text-amber-500'
};

const TYPE_COLOR_MAP = {
    'Anime': 'text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-500/30 bg-violet-100 dark:bg-violet-500/10 hover:bg-violet-200 dark:hover:bg-violet-500/20 ring-violet-500',
    'Manga': 'text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-500/30 bg-pink-100 dark:bg-pink-500/10 hover:bg-pink-200 dark:hover:bg-pink-500/20 ring-pink-500',
    'Book': 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/30 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 ring-blue-500',
    'Movie': 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30 bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 ring-red-500',
    'Series': 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 ring-amber-500'
};

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
    if (!calendarState.currentView) calendarState.currentView = 'month';

    // Show modal with animation
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('#calendarModalContent')?.classList.remove('scale-95');
    });

    // Load releases based on CURRENT view
    const loadPromise = calendarState.currentView === 'month'
        ? loadReleasesForMonth().then(renderMonthView)
        : loadUpcomingReleases().then(renderUpcomingView);

    loadPromise.then(() => {
        updateViewToggle();
    });

    // Initialize lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
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
    updateViewToggle();

    const monthView = document.getElementById('calendarMonthView');
    const upcomingView = document.getElementById('calendarUpcomingView');
    const monthNav = document.getElementById('monthNavControls');
    const todayBtn = document.getElementById('btnCalToday'); // ID added in HTML

    if (view === 'month') {
        monthView?.classList.remove('hidden');
        upcomingView?.classList.add('hidden');
        monthNav?.classList.remove('opacity-0', 'pointer-events-none');
        todayBtn?.classList.remove('opacity-0', 'pointer-events-none');
        renderMonthView();
    } else {
        monthView?.classList.add('hidden');
        upcomingView?.classList.remove('hidden');
        monthNav?.classList.add('opacity-0', 'pointer-events-none');
        todayBtn?.classList.add('opacity-0', 'pointer-events-none');
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

    const activeClass = 'bg-zinc-900 dark:bg-white text-white dark:text-black';
    const inactiveClass = 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white';

    if (calendarState.currentView === 'month') {
        monthBtn?.classList.remove(...inactiveClass.split(' '));
        monthBtn?.classList.add(...activeClass.split(' '));
        upcomingBtn?.classList.remove(...activeClass.split(' '));
        upcomingBtn?.classList.add(...inactiveClass.split(' '));
    } else {
        upcomingBtn?.classList.remove(...inactiveClass.split(' '));
        upcomingBtn?.classList.add(...activeClass.split(' '));
        monthBtn?.classList.remove(...activeClass.split(' '));
        monthBtn?.classList.add(...inactiveClass.split(' '));
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

// =============================================================================
// ADD EVENT MODAL
// =============================================================================

/**
 * Opens the Add Event modal.
 */
/**
 * Opens the Add/Edit Event modal.
 * @param {Object|null} release - Release object to edit, or null for new event
 */
function openAddEventModal(release = null) {
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
        document.getElementById('addEventTracked').checked = release.isTracked !== false;

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
        document.getElementById('addEventDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('addEventTracked').checked = true;
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
            suggestions.innerHTML = matches.slice(0, 10).map(item => `
                <div onclick="selectMediaItem('${item.id}')" 
                    class="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                    <img src="${item.coverUrl ? '/images/' + item.coverUrl : '/static/img/placeholder_cover.jpg'}" 
                        class="w-8 h-12 object-cover rounded bg-zinc-200" onerror="this.src='/static/img/no-cover.png'">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-sm text-zinc-900 dark:text-white truncate">${item.title}</h4>
                        <div class="flex items-center gap-2 text-xs">
                            <span class="${item.userData?.status === 'Planning' ? 'text-emerald-500' : 'text-zinc-500'} font-medium">
                                ${item.userData?.status || 'Unknown'}
                            </span>
                            <span class="text-zinc-400">•</span>
                            <span class="text-zinc-500">${item.type}</span>
                        </div>
                    </div>
                </div>
            `).join('');
            suggestions.classList.remove('hidden');
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
 * Submits the new event.
 */
/**
 * Submits the new or updated event.
 */
async function submitNewEvent() {
    const content = document.getElementById('addEventContent').value;
    const date = document.getElementById('addEventDate').value;
    const isTracked = document.getElementById('addEventTracked').checked;

    if (!content || !date) {
        showToast('Please fill in required fields', 'error');
        return;
    }

    const payload = {
        date: date,
        content: content,
        itemId: calendarState.selectedMediaItem?.id || null,
        isTracked: isTracked
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
            showToast(isEdit ? 'Event updated' : 'Event created', 'success');
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

    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
        const response = await fetch(`/api/releases/${calendarState.currentEditingId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Event deleted', 'success');
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

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
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
                                onclick="/* Click bubbles to parent to open sidebar */">
                                <div class="h-full relative" style="aspect-ratio: 3/4;">
                                    ${content}
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
        <div onclick="showDayDetail('${dateStr}')"
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
/**
 * Renders the upcoming events list as a horizontal scroll.
 */
function renderUpcomingView() {
    const list = document.getElementById('calendarUpcomingList');
    if (!list) return;

    if (calendarState.releases.length === 0) {
        list.className = "flex items-center justify-center w-full h-full"; // Reset flex-row if empty
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center py-16">
                <i data-lucide="calendar-x" class="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4"></i>
                <h3 class="text-lg font-bold text-zinc-500 dark:text-zinc-400 mb-2">No Upcoming Releases</h3>
                <p class="text-sm text-zinc-400 dark:text-zinc-600">Add releases to your library items to see them here.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Reset class for horizontal scroll
    list.className = "flex-1 overflow-x-auto custom-scrollbar p-6 flex items-center gap-0"; // Gap handled by items/delimiters

    // Enable horizontal scroll with mouse wheel
    list.onwheel = (evt) => {
        if (evt.deltaY === 0) return;
        evt.preventDefault();
        list.scrollLeft += evt.deltaY;
    };

    // Group releases by month-year
    const grouped = {};
    const sortedReleases = [...calendarState.releases].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedReleases.forEach(r => {
        const d = new Date(r.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`; // "2025-11"
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
    });

    let html = '';
    const keys = Object.keys(grouped);

    keys.forEach((key, index) => {
        const [year, month] = key.split('-').map(Number);

        // Items for this month
        const items = grouped[key];

        // Container for this month's items
        html += `<div class="flex items-center gap-8 px-4 shrink-0">`;

        items.forEach(r => {
            html += renderUpcomingItem(r);
        });

        html += `</div>`;

        // Add delimiter if not last group
        if (index < keys.length - 1) {
            html += `
                <div class="h-[60%] w-px bg-zinc-200 dark:bg-zinc-800 shrink-0 mx-4 flex flex-col items-center justify-center gap-2">
                </div>
            `;
        }
    });

    // Add a "Load More" trigger area at end?
    html += `<div id="upcomingEndTrigger" class="w-10 h-full shrink-0"></div>`;

    list.innerHTML = html;


    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}


/**
 * Renders a single upcoming release item.
 * 
 * Specs:
 * - Centered in middle of modal height (this is handled by parent flex align-items: enter)
 * - Date atop the card
 * - Media type icon on top left with lucide icon
 * Renders a single upcoming release item card.
 * Global styled card with full title and simplified metadata.
 */
function renderUpcomingItem(release) {
    const item = release.item;
    const type = item?.type || 'Other';

    // Global Card Styles (border, bg, hover rings)
    const cardStyles = TYPE_COLOR_MAP[type] || 'bg-zinc-800 border-zinc-700';
    const textColor = TEXT_COLORS_MAP[type] || 'text-zinc-500';
    const iconName = ICON_MAP[type] || 'calendar';

    // Determine colors for date/text logic if needed

    const dateObj = new Date(release.date);
    const monthStr = MONTH_NAMES_SHORT[dateObj.getMonth()].toUpperCase();
    const dayStr = dateObj.getDate();
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

    const iconBg = TYPE_COLORS[type] || 'bg-zinc-800'; // Uses solid bg from TYPE_COLORS (e.g. bg-violet-500)
    const rating = item?.userData?.rating || 0;
    const cardHeight = "h-[450px]";
    const cardWidth = "w-[280px]";

    return `
        <div class="flex flex-col gap-3 shrink-0 group ${cardWidth} snap-center cursor-pointer" onclick="window.openDetail('${item?.id || ''}')">
            
            <!-- Date atop card -->
            <div class="flex items-baseline gap-2 px-1">
                <span class="text-3xl font-bold text-zinc-900 dark:text-white">${dayStr}</span>
                <div class="flex flex-col leading-none">
                    <span class="text-xs font-bold ${textColor}">${monthStr}</span>
                    <span class="text-[10px] font-medium text-zinc-400 uppercase">${dayName}</span>
                </div>
            </div>

            <!-- Card Container (Styles applied here) -->
            <div class="relative ${cardHeight} rounded-2xl overflow-hidden shadow-lg transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl border ${cardStyles}">
                
                <!-- Cover Image -->
                ${item?.coverUrl
            ? `<img src="/images/${item.coverUrl}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy">`
            : `<div class="w-full h-full bg-zinc-800/50 flex items-center justify-center flex-col gap-2">
                         <i data-lucide="${iconName}" class="w-12 h-12 ${textColor} opacity-50"></i>
                         <span class="text-zinc-600 dark:text-zinc-400 font-bold text-lg text-center px-4">${item?.title || 'No Cover'}</span>
                       </div>`
        }

                <!-- Top Left: Media Type Icon (Solid BG, White Icon) -->
                <div class="absolute top-3 left-3 w-10 h-10 rounded-xl ${iconBg} bg-opacity-90 backdrop-blur-md flex items-center justify-center shadow-lg z-10 transition-transform group-hover:scale-110 border border-white/20">
                    <i data-lucide="${iconName}" class="w-5 h-5 text-white"></i>
                </div>

                <!-- Bottom Gradient Overlay -->
                <div class="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-5 z-10">
                    <div class="flex items-center justify-between mb-2">
                        <!-- Rating (if any) -->
                         ${rating > 0 ? `
                        <div class="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-lg border border-white/5">
                            <i data-lucide="star" class="w-3 h-3 text-amber-400 fill-amber-400"></i>
                            <span class="text-xs font-bold text-white">${rating}</span>
                        </div>
                        ` : '<div></div>'}
                    </div>
                    
                    <!-- Title (Full length, no truncation) -->
                    <h3 class="font-heading font-bold text-xl text-white leading-tight drop-shadow-md">
                        ${item?.title || 'Unknown Title'}
                    </h3>
                    
                    <!-- Optional: Content Snippet -->
                    ${release.content ? `<p class="text-xs text-zinc-300 mt-1 line-clamp-2">${release.content}</p>` : ''}
                </div>
            </div>
            
            <!-- Reflection/Shadow hack -->
            <div class="mx-4 h-1 bg-zinc-900/10 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
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
    console.log('showDayDetail called for:', dateStr);
    const releases = getReleasesForDate(dateStr);

    // Allow opening even if empty, to show "No events" or allow adding
    // if (releases.length === 0) return;

    const panel = document.getElementById('calendarDayDetail');
    const dateLabel = document.getElementById('dayDetailDate');
    const content = document.getElementById('dayDetailContent');

    console.log('Panel elements:', { panel, dateLabel, content });

    if (!panel || !content) return;

    // Format date for display
    const date = new Date(dateStr);
    dateLabel.textContent = formatDisplayDate(date);

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
        group-[.is-expanded]:bg-gradient-to-br 
        group-[.is-expanded]:from-${colorRoot}-500/10 
        group-[.is-expanded]:via-transparent 
        group-[.is-expanded]:to-transparent
        group-[.is-expanded]:border-l-2 
        group-[.is-expanded]:border-t-2 
        group-[.is-expanded]:${borderColor}
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
 */
window.handleReleaseClick = function (el, releaseId, itemId) {
    if (el.classList.contains('is-expanded')) {
        // Already expanded -> Open Info if logic allows
        if (itemId && window.openDetail) {
            window.openDetail(itemId);
        }
    } else {
        // Expand
        // Collapse others first? Optional.
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

        // Refresh icons if needed (though existing icons define geometry)
    }
};

/**
 * Deletes a calendar release event.
 */
window.deleteRelease = async function (id) {
    if (!confirm('Are you sure you want to remove this event from the calendar?')) return;

    try {
        const res = await fetch(`/api/releases/${id}`, { method: 'DELETE' });
        if (res.ok) {
            // Refresh calendar
            navigateMonth(0); // Reloads current view
            // Close sidebar if empty? logic handled by render
            // But we need to refresh the SIDEBAR too if it's open.
            // navigateMonth re-renders the grid. 
            // If sidebar is open, we should re-fetch releases for the SELECTED day.
            if (calendarState.selectedDay) {
                // We need to wait for navigateMonth to update state, then refresh sidebar
                setTimeout(() => showDayDetail(calendarState.selectedDay), 500);
            }
        } else {
            console.error('Failed to delete release');
        }
    } catch (e) {
        console.error('Error deleting release:', e);
    }
};

/**
 * Toggles the 'seen' (tracked) status of a release.
 */
window.toggleReleaseSeen = async function (id, currentIsTracked) {
    try {
        const res = await fetch(`/api/releases/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isTracked: !currentIsTracked })
        });

        if (res.ok) {
            navigateMonth(0);
            if (calendarState.selectedDay) {
                setTimeout(() => showDayDetail(calendarState.selectedDay), 500);
            }
        }
    } catch (e) {
        console.error('Error updating release:', e);
    }
};

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
    return calendarState.releases.filter(r => r.date === dateStr);
}

// =============================================================================
// WINDOW BINDINGS
// =============================================================================

window.openCalendarModal = openCalendarModal;
window.closeCalendarModal = closeCalendarModal;
window.setCalendarView = setCalendarView;
window.navigateMonth = navigateMonth;
window.goToToday = goToToday;
window.openMonthYearPicker = openMonthYearPicker;
window.closeMonthYearPicker = closeMonthYearPicker;
window.changePickerYear = changePickerYear;
window.selectMonth = selectMonth;
window.showDayDetail = showDayDetail;
window.closeDayDetail = closeDayDetail;
window.openAddEventModal = openAddEventModal;
window.closeAddEventModal = closeAddEventModal;
window.searchMediaItems = searchMediaItems;
window.selectMediaItem = selectMediaItem;
window.clearSelectedMediaItem = clearSelectedMediaItem;
window.submitNewEvent = submitNewEvent;
window.handleCarouselWheel = handleCarouselWheel;
window.handleCarouselDotClick = handleCarouselDotClick;
