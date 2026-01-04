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
	// Logic: If only 'All' + 1 other type are available, hide the filter bar entireley (filtering is redundant).
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

	if (filtered.length === 0) {
		container.innerHTML = '';
		document.getElementById('emptyState').classList.remove('hidden');
		document.getElementById('emptyState').classList.add('flex');
		return;
	}

	document.getElementById('emptyState').classList.add('hidden');
	document.getElementById('emptyState').classList.remove('flex');

	container.innerHTML = filtered.map(item => generateCardHtml(item)).join('');

	safeCreateIcons();

	// Check for overflow after render
	setTimeout(updateGridTruncation, 50);
}

/**
 * Checks all truncate-able elements in the grid/list for overflow.
 * Should be called on window resize and after any rendering operation.
 */
export function updateGridTruncation() {
	document.querySelectorAll('[id^="desc-"]').forEach(el => {
		const id = el.id.replace('desc-', '');
		checkOverflow(`desc-${id}`, `btn-desc-${id}`);
	});
	document.querySelectorAll('[id^="list-notes-"]').forEach(el => {
		const id = el.id.replace('list-notes-', '');
		checkOverflow(`list-notes-${id}`, `btn-list-notes-${id}`);
	});
	document.querySelectorAll('[id^="review-"]').forEach(el => {
		const id = el.id.replace('review-', '');
		checkOverflow(`review-${id}`, `btn-review-${id}`);
	});
}


/**
 * Displays a skeleton loading state in the grid container.
 */
export function showGridLoading() {
	const grid = document.getElementById('gridContainer');
	if (grid) grid.classList.add('opacity-40', 'pointer-events-none', 'animate-pulse');
}

/**
 * Hides the skeleton loading state.
 */
export function hideGridLoading() {
	const grid = document.getElementById('gridContainer');
	if (grid) grid.classList.remove('opacity-40', 'pointer-events-none', 'animate-pulse');
}
