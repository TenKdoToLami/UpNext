/**
 * @fileoverview Rendering utilities for the UpNext application.
 * Handles the logic for counting items, sorting, and rendering the filter and grid views.
 * @module render_utils
 */

import { state, isFieldVisible } from './state.js';
import {
	MEDIA_TYPES, STATUS_TYPES, ICON_MAP, STATUS_ICON_MAP, SORT_OPTIONS,
	STATUS_COLOR_MAP, TYPE_COLOR_MAP,
	RATING_LABELS, TEXT_COLORS, STAR_FILLS
} from './constants.js';
import { safeCreateIcons, toggleExpand, checkOverflow } from './dom_utils.js';
import { generateCardHtml } from './card_renderer.js';


let gridObserver = null;

/**
 * Calculates counts for types, statuses, and ratings based on current items.
 * Used for updating filter badges and statistics.
 * @returns {Object} item counts by category
 */
export function getCounts() {
	const visibleItems = state.items.filter(item => {
		if (state.filterHiddenOnly) return item.isHidden;
		if (!state.isHidden && item.isHidden) return false;

		// Settings Filters
		if (state.appSettings?.disabledTypes?.includes(item.type)) return false;
		if (state.appSettings?.disabledStatuses?.includes(item.status)) return false;

		return true;
	});

	const typeCounts = { 'All': visibleItems.length };
	MEDIA_TYPES.forEach(t => typeCounts[t] = 0);
	visibleItems.forEach(item => { if (typeCounts[item.type] !== undefined) typeCounts[item.type]++; });

	const statusCounts = { 'All': 0 };
	STATUS_TYPES.forEach(s => statusCounts[s] = 0);

	const filteredByType = visibleItems.filter(i => state.filterTypes.includes('All') || state.filterTypes.includes(i.type));
	statusCounts['All'] = filteredByType.length;
	filteredByType.forEach(item => { if (statusCounts[item.status] !== undefined) statusCounts[item.status]++; });

	const ratingCounts = { 'Any': 0, 1: 0, 2: 0, 3: 0, 4: 0 };

	const filteredByTypeAndStatus = visibleItems.filter(i =>
		(state.filterTypes.includes('All') || state.filterTypes.includes(i.type)) &&
		(state.filterStatuses.includes('All') || state.filterStatuses.includes(i.status))
	);

	ratingCounts['Any'] = filteredByTypeAndStatus.length;
	filteredByTypeAndStatus.forEach(item => {
		if (item.rating && ratingCounts[item.rating] !== undefined) ratingCounts[item.rating]++;
	});

	return { typeCounts, statusCounts, ratingCounts };
}

/**
 * Sorts an array of items based on the current state.sortBy and state.sortOrder.
 * Handles custom sorting logic for 'series' (alphanumeric).
 * @param {Array} arr - List of items to sort
 * @returns {Array} Sorted list
 */
export function sortItems(arr) {
	return arr.sort((a, b) => {
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
		}
		else { valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase(); }
		if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
		if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
		return 0;
	});
}



/**
 * Renders all filter controls (Type, Status, Rating, Sort).
 * Handles both desktop and mobile versions.
 */
export function renderFilters() {
	const counts = getCounts();


	/**
	 * Generates HTML for a type filter button.
	 * @param {string} t - The type (e.g., 'Anime', 'All').
	 * @param {boolean} isMobile - True if rendering for mobile, false for desktop.
	 * @returns {string} HTML string for the type filter button.
	 */
	const renderTypeBtn = (t, isMobile) => {
		const isActive = state.filterTypes.includes(t);
		const count = counts.typeCounts[t] || 0;
		const icon = t === 'All' ? 'layout-grid' : (ICON_MAP[t] || 'circle');

		const themeColors = {
			'Anime': 'bg-violet-600 border-violet-500 text-white',
			'Manga': 'bg-pink-600 border-pink-500 text-white',
			'Book': 'bg-blue-600 border-blue-500 text-white',
			'Movie': 'bg-red-600 border-red-500 text-white',
			'Series': 'bg-amber-600 border-amber-500 text-white'
		};

		let colorClass, scaleClass, extra;
		const baseStyle = themeColors[t];

		if (isMobile) {
			colorClass = `bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-500 dark:text-zinc-400`;
			if (t === 'All') {
				if (isActive) colorClass = `bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black font-bold`;
			} else {
				if (isActive) colorClass = `${baseStyle} font-bold shadow-md`;
				else colorClass = `bg-zinc-100 dark:bg-zinc-800 border-transparent text-${baseStyle.split('-')[1]}-600 dark:text-${baseStyle.split('-')[1]}-400`;
			}
			scaleClass = 'w-full';
			extra = `<span class="truncate">${t}</span>`;
		} else {
			scaleClass = isActive ? 'scale-110 shadow-lg' : 'hover:scale-105';
			if (t === 'All') {
				colorClass = isActive ? `bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black border-transparent shadow-lg` : `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200`;
			} else {
				if (isActive) colorClass = `${baseStyle} shadow-lg`;
				else colorClass = `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-${baseStyle.split('-')[1]}-600 dark:text-${baseStyle.split('-')[1]}-400 hover:text-${baseStyle.split('-')[1]}-700 dark:hover:text-${baseStyle.split('-')[1]}-300 hover:border-${baseStyle.split('-')[1]}-400 dark:hover:border-${baseStyle.split('-')[1]}-500`;
			}
			const countClass = isActive ? `bg-black/20 text-white` : `bg-zinc-100 dark:bg-zinc-800 text-zinc-500`;
			extra = `${t} <span class="px-1.5 py-0.5 rounded-full text-[10px] ${countClass}">${count}</span>`;
		}

		return `<button onclick="setFilterType('${t}'); ${isMobile ? 'event.stopPropagation();' : ''}" 
					class="flex items-center ${isMobile ? 'gap-1.5 px-2 py-2 rounded-lg text-[9px]' : 'gap-2 px-4 py-2 rounded-full text-xs font-heading'} font-bold uppercase tracking-wide border transition-all ${colorClass} ${scaleClass}">
                    <i data-lucide="${icon}" class="w-3 h-3 shrink-0"></i>
                    ${extra}
                </button>`;
	};

	// TYPE FILTERS
	// Logic: If only 'All' + 1 other type are available, hide the filter bar entirely (filtering is redundant).
	// Must handle Desktop (xl:flex) and Mobile separately to prevent ghost elements.
	const availableTypes = ['All', ...MEDIA_TYPES.filter(t => !state.appSettings?.disabledTypes?.includes(t))];
	const typeContainer = document.getElementById('typeFilters');
	if (typeContainer) {
		if (availableTypes.length <= 2) { // Just All + 1 Type
			typeContainer.classList.add('hidden');
			typeContainer.classList.remove('flex', 'xl:flex');
			typeContainer.innerHTML = ''; // Clear to prevent potential click listeners
		} else {
			typeContainer.classList.remove('hidden');
			typeContainer.classList.add('flex', 'xl:flex');
			typeContainer.innerHTML = availableTypes.map(t => renderTypeBtn(t, false)).join('');
		}
	}

	const typeContainerMobile = document.getElementById('typeFiltersMobile');
	if (typeContainerMobile) {
		const mobileWrapper = document.getElementById('typeFiltersMobileContainer');
		if (availableTypes.length <= 2) {
			if (mobileWrapper) mobileWrapper.classList.add('hidden');
		} else {
			if (mobileWrapper) mobileWrapper.classList.remove('hidden');
			typeContainerMobile.innerHTML = availableTypes.map(t => renderTypeBtn(t, true)).join('');
		}
	}

	// ... (Status Logic below follows same pattern)


	/**
	 * Generates HTML for a status filter button.
	 * @param {string} s - The status (e.g., 'Completed', 'All').
	 * @param {boolean} isMobile - True if rendering for mobile, false for desktop.
	 * @returns {string} HTML string for the status filter button.
	 */
	const renderStatusBtn = (s, isMobile) => {
		const isActive = state.filterStatuses.includes(s);
		const count = counts.statusCounts[s] || 0;
		const icon = s === 'All' ? 'layers' : STATUS_ICON_MAP[s];
		const baseColor = s === 'All' ? 'zinc' : STATUS_COLOR_MAP[s].split(' ')[0].replace('text-', '');

		let btnClass, scaleClass, extra;

		if (isMobile) {
			btnClass = `bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-500 dark:text-zinc-400`;
			if (isActive) {
				if (s === 'All') btnClass = `bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black font-bold`;
				else btnClass = `bg-${baseColor} text-white border-transparent font-bold shadow-md`;
				if (s === 'Planning') btnClass = `bg-zinc-500 text-white border-transparent font-bold`;
			} else if (s !== 'All') {
				btnClass = `${STATUS_COLOR_MAP[s]} bg-opacity-5 font-bold`;
			}
			scaleClass = 'w-full';
			extra = `<span class="truncate">${s}</span>`;
		} else {
			scaleClass = isActive ? 'scale-110 shadow-lg' : 'hover:scale-105';
			btnClass = isActive
				? `bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black font-bold border-transparent`
				: `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600`;

			if (isActive && s !== 'All') {
				btnClass = `bg-${baseColor} text-white border-transparent font-bold shadow-lg`;
				if (s === 'Planning') btnClass = `bg-zinc-500 text-white border-transparent font-bold`;
			} else if (!isActive && s !== 'All') {
				btnClass = `${STATUS_COLOR_MAP[s]} font-medium border bg-opacity-10`;
			}
			extra = `${s} <span class="px-1.5 py-0.5 rounded-full text-[9px] bg-black/20">${count}</span>`;
		}

		return `<button onclick="setFilterStatus('${s}'); ${isMobile ? 'event.stopPropagation();' : ''}" 
					class="flex items-center ${isMobile ? 'gap-1.5 px-2 py-2 rounded-lg text-[9px]' : 'gap-1.5 px-3 py-1.5 rounded-full text-[11px]'} font-bold uppercase tracking-wide border transition-all ${btnClass} ${scaleClass}">
                    <i data-lucide="${icon}" class="w-3 h-3 shrink-0"></i>
                    ${extra}
                </button>`;
	};

	const availableStatuses = ['All', ...STATUS_TYPES.filter(s => !state.appSettings?.disabledStatuses?.includes(s))];
	const statusContainer = document.getElementById('statusFilters');
	if (statusContainer) {
		if (availableStatuses.length <= 2) { // Just All + 1 Status
			statusContainer.classList.add('hidden');
			statusContainer.classList.remove('flex', 'xl:flex');
			statusContainer.innerHTML = '';
		} else {
			statusContainer.classList.remove('hidden');
			statusContainer.classList.add('flex', 'xl:flex');
			statusContainer.innerHTML = availableStatuses.map(s => renderStatusBtn(s, false)).join('');
		}
	}

	const statusContainerMobile = document.getElementById('statusFiltersMobile');
	if (statusContainerMobile) {
		const mobileWrapper = document.getElementById('statusFiltersMobileContainer');
		if (availableStatuses.length <= 2) {
			if (mobileWrapper) mobileWrapper.classList.add('hidden');
		} else {
			if (mobileWrapper) mobileWrapper.classList.remove('hidden');
			statusContainerMobile.innerHTML = availableStatuses.map(s => renderStatusBtn(s, true)).join('');
		}
	}

	// Sort Options
	const sortFieldContainer = document.getElementById('sortFieldFilters');
	if (sortFieldContainer) {
		sortFieldContainer.innerHTML = SORT_OPTIONS.map(opt => {
			const isActive = state.sortBy === opt.id;
			const activeClass = isActive ? 'text-white font-bold bg-zinc-800 dark:bg-zinc-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300';
			return `<button onclick="setSortBy('${opt.id}')" class="flex-1 text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg transition-all text-center ${activeClass}">${opt.label}</button>`;
		}).join('');
	}

	const sortDirectionContainer = document.getElementById('sortDirectionFilters');
	if (sortDirectionContainer) {
		const dirs = [{ val: 'asc', icon: 'arrow-up-narrow-wide', label: 'Asc' }, { val: 'desc', icon: 'arrow-down-narrow-wide', label: 'Desc' }];
		sortDirectionContainer.innerHTML = dirs.map(d => {
			const isActive = state.sortOrder === d.val;
			const activeClass = isActive ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-black/5 dark:ring-white/10 scale-[1.02]' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300';
			return `<button onclick="setSortOrder('${d.val}')" class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${activeClass}">
						<i data-lucide="${d.icon}" class="w-4 h-4"></i> 
						<span class="text-[10px] font-black uppercase tracking-widest">${d.label}</span>
					</button>`;
		}).join('');
	}

	// Rating Filters
	const ratingContainer = document.getElementById('ratingFilters');
	const ratingAllowed = state.filterStatuses.some(s => ['Completed', 'Anticipating', 'Dropped', 'On Hold'].includes(s));

	if (ratingAllowed && ratingContainer) {
		ratingContainer.classList.remove('hidden');
		ratingContainer.classList.add('flex');

		const mobileContainer = document.getElementById('ratingFiltersMobile');
		const mobileWrapper = document.getElementById('ratingFiltersMobileContainer');

		// Any Button
		const anyActive = state.filterRatings.length === 0;
		const anyBg = anyActive ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black shadow-lg scale-105' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200';
		const anyCountClass = anyActive ? 'bg-white/20 dark:bg-black/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500';

		const anyBtn = `<button onclick="setFilterRating('Any')" class="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide border border-transparent transition-all ${anyBg}">
			Any <span class="px-1.5 py-0.5 rounded-full text-[9px] ${anyCountClass}">${counts.ratingCounts['Any']}</span>
		</button>`;

		const buttonsHtml = [1, 2, 3, 4].map(r => {
			const isActive = state.filterRatings.includes(r);
			const colorClass = TEXT_COLORS[r];
			const count = counts.ratingCounts[r] || 0;

			let btnClass = isActive
				? `bg-zinc-50 dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-600 shadow-lg ${colorClass} scale-110 opacity-100`
				: `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 ${colorClass} hover:scale-105 opacity-80 dark:opacity-60 hover:opacity-100`;

			return `<button onclick="setFilterRating(${r})" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all duration-200 border border-transparent ${btnClass}">
				${RATING_LABELS[r]} <span class="px-1.5 py-0.5 rounded-full text-[9px] bg-black/10 dark:bg-black/30 text-zinc-600 dark:text-white/70 ml-1">${count}</span>
			</button>`;
		}).join('');

		ratingContainer.innerHTML = anyBtn + buttonsHtml;

		if (mobileContainer && mobileWrapper) {
			mobileWrapper.classList.remove('hidden');
			mobileContainer.innerHTML = [1, 2, 3, 4].map(r => {
				const isActive = state.filterRatings.includes(r);
				const colorClass = TEXT_COLORS[r];
				let btnClass = isActive ? `bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black font-bold shadow-md` : `bg-zinc-100 dark:bg-zinc-800 border-transparent ${colorClass.replace('text-', 'text-opacity-70 text-')}`;

				return `<button onclick="setFilterRating(${r}); event.stopPropagation();" class="flex items-center gap-1.5 px-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wide border transition-all w-full ${btnClass}">
                    <i data-lucide="star" class="w-3 h-3 ${isActive ? 'fill-current' : ''}"></i>
                    <span class="truncate">${RATING_LABELS[r]}</span>
                </button>`;
			}).join('');
		}
	} else if (ratingContainer) {
		ratingContainer.classList.add('hidden');
		ratingContainer.classList.remove('flex');
		const mobileWrapper = document.getElementById('ratingFiltersMobileContainer');
		if (mobileWrapper) mobileWrapper.classList.add('hidden');
	}

	// Refresh Lucide Icons
	safeCreateIcons();
}

/**
 * Renders the main grid or list view of items.
 * Applies all active filters (search, type, status, rating, hidden).
 * Handles "No Items" state.
 */
export function renderGrid() {
	const container = document.getElementById('gridContainer');
	const searchInput = document.getElementById('searchInput');
	const searchVal = searchInput.value.toLowerCase();
	const clearBtn = document.getElementById('clearSearchBtn');

	if (searchVal.length > 0) clearBtn.classList.remove('hidden');
	else clearBtn.classList.add('hidden');

	let textQuery = searchVal.replace(/(universe|author|series|type|tags?)=("([^"]*)"|([^"\s]+))/gi, () => '').trim();
	const searchFilters = {};
	searchVal.replace(/(universe|author|series|type|tags?)=("([^"]*)"|([^"\s]+))/gi, (m, k, qf, qi, s) => {
		let key = k.toLowerCase();
		if (key === 'tags') key = 'tag';
		searchFilters[key] = (qi || s).toLowerCase();
	});

	let filtered = state.items.filter(item => {
		// Global Filters (Settings)
		if (state.appSettings?.disabledTypes?.includes(item.type)) return false;
		if (state.appSettings?.disabledStatuses?.includes(item.status)) return false;

		if (!state.filterTypes.includes('All') && !state.filterTypes.includes(item.type)) return false;
		if (!state.filterStatuses.includes('All') && !state.filterStatuses.includes(item.status)) return false;

		if (state.filterRatings.length > 0) {
			// Allow Planning and Reading/Watching items to pass (they don't have ratings yet)
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
		// Match against any abbreviation in the list
		const matchesAbbreviation = (item.abbreviations || []).some(abbr => abbr.toLowerCase().includes(textQuery));
		const matchesTags = (item.tags || []).some(tag => tag.toLowerCase().includes(textQuery));

		return matchesMainTitle || matchesAlternateTitle || matchesUniverse || matchesAbbreviation || matchesTags;
	});

	filtered = sortItems(filtered);
	state.currentFilteredItems = filtered;

	// Reset limit and start for fresh render
	state.visibleStart = 0;
	state.visibleLimit = getBatchSize();

	renderVisibleBatch(container);
}

/**
 * Renders the visible batch of items based on state.visibleLimit.
 */
function renderVisibleBatch(container) {
	const filtered = state.currentFilteredItems;

	if (filtered.length === 0) {
		container.innerHTML = '';
		document.getElementById('emptyState').classList.remove('hidden');
		document.getElementById('emptyState').classList.add('flex');
		return;
	}

	document.getElementById('emptyState').classList.add('hidden');
	document.getElementById('emptyState').classList.remove('flex');

	// Ensure visibleStart is defined
	if (typeof state.visibleStart === 'undefined') state.visibleStart = 0;

	const visibleItems = filtered.slice(state.visibleStart, state.visibleLimit);
	const html = visibleItems.map(item => generateCardHtml(item)).join('');

	// Handle Footer / Sentinel
	container.innerHTML = html;

	if (state.visibleLimit < filtered.length || state.appSettings?.paginationMode === 'combined') {
		if (state.appSettings?.paginationMode === 'combined') {
			renderPaginationFooter();
		} else {
			// Append Sentinel for Infinite Scroll if not combined
			const sentinel = '<div id="scroll-sentinel" class="w-full h-20 bg-transparent flex items-center justify-center pointer-events-none p-4"><div class="w-2 h-2 bg-zinc-300 dark:bg-zinc-700 rounded-full animate-bounce"></div></div>';
			container.innerHTML += sentinel;
			setupIntersectionObserver();
		}
	} else {
		// Even if all items shown, combined mode might want to show page numbers (e.g. if we are on page 5 of 5)
		if (state.appSettings?.paginationMode === 'combined' && Math.ceil(filtered.length / getBatchSize()) > 1) {
			renderPaginationFooter();
		}
	}

	safeCreateIcons();

	// Check truncation for new items
	const visibleIds = visibleItems.map(i => i.id);
	setTimeout(() => updateGridTruncation(visibleIds), 50);
}

/**
 * Sets up the IntersectionObserver for infinite scrolling.
 * Only used if paginationMode is 'infinite'.
 */
function setupIntersectionObserver() {
	if (gridObserver) gridObserver.disconnect();
	if (state.appSettings?.paginationMode === 'combined') {
		// In combined mode, we don't use auto-scroll
		// We use the footer.
		renderPaginationFooter();
		return;
	}

	const options = {
		root: null, // viewport
		rootMargin: '400px', // Preload before reaching bottom
		threshold: 0.1
	};

	gridObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				loadMoreItems();
			}
		});
	}, options);

	const sentinel = document.getElementById('scroll-sentinel');
	if (sentinel) gridObserver.observe(sentinel);
}

/**
 * Loads the next batch of items.
 * Can be called automatically (infinite) or manually (combined).
 */
export function loadMoreItems() {
	const batchSize = getBatchSize();
	if (state.visibleLimit >= state.currentFilteredItems.length) return;

	// Calculate next limit
	const oldLimit = state.visibleLimit;
	state.visibleLimit += batchSize;

	const container = document.getElementById('gridContainer');
	const filtered = state.currentFilteredItems;

	// Remove old sentinel/footer
	const sentinel = document.getElementById('scroll-sentinel');
	if (sentinel) sentinel.remove();
	const footer = document.getElementById('pagination-footer');
	if (footer) footer.remove();

	const nextBatch = filtered.slice(oldLimit, state.visibleLimit);
	const html = nextBatch.map(item => generateCardHtml(item)).join('');

	// Create temp container to parse HTML string into nodes
	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = html;

	while (tempDiv.firstChild) {
		container.appendChild(tempDiv.firstChild);
	}

	// Logic for next step
	if (state.visibleLimit < filtered.length) {
		if (state.appSettings?.paginationMode === 'combined') {
			renderPaginationFooter();
		} else {
			const newSentinel = document.createElement('div');
			newSentinel.id = 'scroll-sentinel';
			newSentinel.className = 'w-full h-10 bg-transparent flex items-center justify-center pointer-events-none opacity-0';
			container.appendChild(newSentinel);
			if (gridObserver) gridObserver.observe(newSentinel);
		}
	}

	safeCreateIcons();
	const nextBatchIds = nextBatch.map(i => i.id);
	setTimeout(() => updateGridTruncation(nextBatchIds), 50);
}

/**
 * Renders the pagination footer (Load More + Page Numbers).
 */
function renderPaginationFooter() {
	const container = document.getElementById('gridContainer');
	if (!container) return;

	// Remove existing if any
	const existing = document.getElementById('pagination-footer');
	if (existing) existing.remove();

	const totalItems = state.currentFilteredItems.length;
	const batchSize = getBatchSize();
	const totalPages = Math.ceil(totalItems / batchSize);
	// Current page is loosely defined by the END of the list.
	// If we show 0-120 (batch 60), we are at end of page 2.
	const currentPage = Math.ceil(state.visibleLimit / batchSize);

	if (totalItems <= state.visibleLimit && state.visibleStart === 0) return; // All shown

	const footer = document.createElement('div');
	footer.id = 'pagination-footer';
	footer.className = 'w-full py-8 flex flex-col items-center gap-4 col-span-full';

	// Load More Button
	const canLoadMore = state.visibleLimit < totalItems;
	const loadMoreBtn = canLoadMore ? `
		<button onclick="window.loadMoreItems()" 
			class="px-6 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-zinc-700 dark:text-zinc-300 font-heading font-bold uppercase tracking-widest text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95">
			Load More
		</button>
	` : '<div class="text-xs font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">End of Results</div>';

	// Pages
	// Simple Logic: Prev [1] ... [Curr] ... [Last] Next
	let pagesHtml = '';
	if (totalPages > 1) {
		const generatePageBtn = (p) => {
			// Highlights the current page based on the end of the list.
			// If we are viewing 0-120 (Page 1 & 2), currentPage is 2. We highlight 2.
			const isActive = p === currentPage;

			const activeClass = isActive
				? 'bg-indigo-600 text-white border-transparent'
				: 'bg-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300 border-transparent hover:bg-black/5 dark:hover:bg-white/5';

			return `<button onclick="window.goToPage(${p})" 
				class="w-8 h-8 rounded-lg text-xs font-bold transition-all ${activeClass}">
				${p}
			</button>`;
		};

		// Range logic
		const range = [];
		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) range.push(i);
		} else {
			range.push(1);
			if (currentPage > 3) range.push('...');
			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);
			for (let i = start; i <= end; i++) range.push(i);
			if (currentPage < totalPages - 2) range.push('...');
			range.push(totalPages);
		}

		// Previous Button
		const prevDisabled = currentPage === 1;
		const prevBtn = `
			<button onclick="${prevDisabled ? '' : `window.goToPage(${currentPage - 1})`}" 
				class="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all ${prevDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:text-indigo-500'}">
				<i data-lucide="chevron-left" class="w-4 h-4"></i>
			</button>
		`;

		// Next Button
		const nextDisabled = currentPage === totalPages;
		const nextBtn = `
			<button onclick="${nextDisabled ? '' : `window.goToPage(${currentPage + 1})`}" 
				class="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all ${nextDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:text-indigo-500'}">
				<i data-lucide="chevron-right" class="w-4 h-4"></i>
			</button>
		`;

		pagesHtml = `<div class="flex items-center gap-1">
			${prevBtn}
			${range.map(r => r === '...' ? '<span class="text-zinc-400 text-xs px-2">...</span>' : generatePageBtn(r)).join('')}
			${nextBtn}
		</div>`;
	}

	footer.innerHTML = `
		${canLoadMore ? loadMoreBtn : ''}
		${pagesHtml}
	`;

	container.appendChild(footer);
	safeCreateIcons(footer);
}

/**
 * Jumps to a specific page.
 * @param {number} page 
 */
export function goToPage(page) {
	const batchSize = getBatchSize();
	state.visibleStart = (page - 1) * batchSize;
	state.visibleLimit = page * batchSize;

	// Ensure bounds
	if (state.visibleStart < 0) state.visibleStart = 0;
	if (state.visibleLimit > state.currentFilteredItems.length) state.visibleLimit = state.currentFilteredItems.length;

	renderVisibleBatch(document.getElementById('gridContainer'));

	// Scroll to top of grid
	const grid = document.getElementById('gridContainer');
	if (grid) {
		const top = grid.getBoundingClientRect().top + window.scrollY - 100;
		window.scrollTo({ top, behavior: 'smooth' });
	}
}

/**
 * Helper to get the current configured batch size based on view.
 */
export function getBatchSize() {
	const s = state.appSettings;
	if (!s || !s.itemsPerPage) return state.BATCH_SIZE || 60;

	let key = 'grid';
	if (state.viewMode === 'list') {
		key = state.showDetails ? 'list_details' : 'list';
	} else {
		key = state.showDetails ? 'grid_details' : 'grid';
	}

	// Fallback to default BATCH_SIZE if setting missing
	return parseInt(s.itemsPerPage[key], 10) || 60;
}

/**
 * Checks all truncate-able elements in the grid/list for overflow.
 * Should be called on window resize and after any rendering operation.
 * @param {Array<string>} [itemIds] - Optional list of item IDs to check. If omitted, checks all.
 */
export function updateGridTruncation(itemIds = null) {
	const processOverflow = (id) => {
		checkOverflow(`desc-${id}`, `btn-desc-${id}`);
		checkOverflow(`list-notes-${id}`, `btn-list-notes-${id}`);
		checkOverflow(`review-${id}`, `btn-review-${id}`);
	};

	if (itemIds && Array.isArray(itemIds)) {
		// Optimization: Only check specific items (e.g. new batch)
		itemIds.forEach(id => processOverflow(id));
	} else {
		// Check all (e.g. on resize)
		document.querySelectorAll('[id^="desc-"]').forEach(el => {
			const id = el.id.replace('desc-', '');
			// Avoid double processing if we accidentally select multiple (unlikely with ID)
			processOverflow(id);
		});
	}
}

/**
 * Displays a prominent loading state over the grid container.
 * Creates the overlay if it doesn't exist.
 */
export function showGridLoading() {
	const grid = document.getElementById('gridContainer');
	if (!grid) return;

	// Add visual cue to grid content
	grid.classList.add('opacity-40', 'pointer-events-none');

	// Check for existing overlay
	let overlay = document.getElementById('globalLoadingOverlay');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'globalLoadingOverlay';
		overlay.className = 'absolute inset-0 flex flex-col items-center justify-center z-10';
		// Position relative to the main content area (which should be the parent of gridContainer's parent usually, or we fix the parent)
		// Actually, let's make it fixed within the viewport or absolute covering the main content.
		// If we append to body it covers everything (like sidebar). The user requested "universal".
		// Let's make it cover the main content view.

		// Find main content wrapper
		const main = document.querySelector('main');
		if (main) {
			if (getComputedStyle(main).position === 'static') main.style.position = 'relative';
			main.appendChild(overlay);
		} else {
			// Fallback to appending near grid
			grid.parentElement.appendChild(overlay);
		}

		overlay.innerHTML = `
            <div class="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-4 animate-enter">
                <i data-lucide="loader-2" class="w-8 h-8 text-indigo-500 animate-spin"></i>
                <div class="text-sm font-bold text-zinc-600 dark:text-zinc-300 tracking-wide uppercase">
                    Loading Library...
                </div>
            </div>
        `;
		safeCreateIcons(overlay);
	}

	overlay.classList.remove('hidden', 'opacity-0');
	overlay.classList.add('flex', 'opacity-100');
}

/**
 * Hides the loading state.
 */
export function hideGridLoading() {
	const grid = document.getElementById('gridContainer');
	if (grid) grid.classList.remove('opacity-40', 'pointer-events-none');

	const overlay = document.getElementById('globalLoadingOverlay');
	if (overlay) {
		overlay.classList.add('opacity-0');
		// Wait for transition then hide
		setTimeout(() => {
			overlay.classList.remove('flex');
			overlay.classList.add('hidden');
		}, 300);
	}
}

// Expose globals for onclick handlers
window.loadMoreItems = loadMoreItems;
window.goToPage = goToPage;
