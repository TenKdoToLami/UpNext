/**
 * @fileoverview Rendering utilities for the UpNext application.
 * Handles the logic for counting items, sorting, and rendering the filter and grid views.
 * @module render_utils
 */

import { state } from './state.js';
import {
	MEDIA_TYPES, STATUS_TYPES, ICON_MAP, STATUS_ICON_MAP, SORT_OPTIONS,
	STATUS_COLOR_MAP, TYPE_COLOR_MAP,
	RATING_LABELS, TEXT_COLORS, STAR_FILLS
} from './constants.js';
import { safeCreateIcons, toggleExpand, checkOverflow } from './dom_utils.js';

// --- Logic ---

export function getCounts() {
	const visibleItems = state.items.filter(item => {
		if (state.filterHiddenOnly) return item.isHidden;
		if (!state.isHidden && item.isHidden) return false;
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

// --- Helpers ---

/**
 * Generates HTML for the authors list with smart filter buttons.
 * @param {Array<string>} authors - List of authors/studios.
 * @param {string} [extraClass=''] - Additional CSS classes.
 * @returns {string} HTML string.
 */
function getAuthorsHtml(authors, extraClass = '') {
	if (!authors || !authors.length) return '<span class="italic text-zinc-400 dark:text-white/40">Unknown</span>';
	return authors.map(a => `<button type="button" onclick="smartFilter(event, 'author', '${a.replace(/'/g, "\\'")}')" class="bg-transparent border-none p-0 hover:text-zinc-900 dark:hover:text-white underline decoration-zinc-300 dark:decoration-white/20 underline-offset-2 hover:decoration-zinc-900 dark:hover:decoration-white transition-all cursor-pointer relative z-50 inline ${extraClass}">${a}</button>`).join(', ');
}

/**
 * Calculates and generates the synopsis block for a card.
 * @param {Object} item - The media item.
 * @param {Array<string>} authors - List of authors.
 * @returns {string} HTML string for the synopsis or empty string.
 */
function getSynopsisBlockHtml(item, authors) {
	if (!item.description) return '';
	// Minimum of 2 lines available for synopsis, more if fields are missing
	let availableLines = 2;
	if (!authors || !authors.length) availableLines += 1;
	if (!item.universe) availableLines += 1;
	if (!item.series) availableLines += 1;

	return `<div style="-webkit-line-clamp: ${availableLines}; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;" class="text-xs leading-5 text-zinc-500 dark:text-zinc-400 flex-1 min-h-0 border-t border-zinc-100 dark:border-white/5 pt-2 mt-2">${item.description}</div>`;
}

// --- Render ---

/**
 * Renders all filter controls (Type, Status, Rating, Sort).
 * Handles both desktop and mobile versions.
 */
export function renderFilters() {
	const counts = getCounts();

	// --- 1. Type Filters ---
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

	const typeContainer = document.getElementById('typeFilters');
	if (typeContainer) typeContainer.innerHTML = ['All', ...MEDIA_TYPES].map(t => renderTypeBtn(t, false)).join('');

	const typeContainerMobile = document.getElementById('typeFiltersMobile');
	if (typeContainerMobile) typeContainerMobile.innerHTML = ['All', ...MEDIA_TYPES].map(t => renderTypeBtn(t, true)).join('');

	// --- 2. Status Filters ---
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

	const statusContainer = document.getElementById('statusFilters');
	if (statusContainer) statusContainer.innerHTML = ['All', ...STATUS_TYPES].map(s => renderStatusBtn(s, false)).join('');

	const statusContainerMobile = document.getElementById('statusFiltersMobile');
	if (statusContainerMobile) statusContainerMobile.innerHTML = ['All', ...STATUS_TYPES].map(s => renderStatusBtn(s, true)).join('');

	// --- 3. Sort Options ---
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

	// --- 4. Rating Filters ---
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

export function renderGrid() {
	const container = document.getElementById('gridContainer');
	const searchInput = document.getElementById('searchInput');
	const searchVal = searchInput.value.toLowerCase();
	const clearBtn = document.getElementById('clearSearchBtn');

	if (searchVal.length > 0) clearBtn.classList.remove('hidden');
	else clearBtn.classList.add('hidden');

	let textQuery = searchVal.replace(/(universe|author|series|type)=("([^"]*)"|([^"\s]+))/gi, () => '').trim();
	const searchFilters = {};
	searchVal.replace(/(universe|author|series|type)=("([^"]*)"|([^"\s]+))/gi, (m, k, qf, qi, s) => { searchFilters[k.toLowerCase()] = (qi || s).toLowerCase(); });

	let filtered = state.items.filter(item => {
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

		if (!textQuery) return true;

		const matchesMainTitle = item.title.toLowerCase().includes(textQuery);
		const matchesAlternateTitle = (item.alternateTitles || []).some(alt => alt.toLowerCase().includes(textQuery));
		const matchesUniverse = (item.universe && item.universe.toLowerCase().includes(textQuery));
		// Match against any abbreviation in the list
		const matchesAbbreviation = (item.abbreviations || []).some(abbr => abbr.toLowerCase().includes(textQuery));

		return matchesMainTitle || matchesAlternateTitle || matchesUniverse || matchesAbbreviation;
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
 * Generates the complete HTML string for a single media card.
 * Supports both grid and list view modes.
 * @param {Object} item - The media item to render.
 * @returns {string} The generated HTML string.
 */
function generateCardHtml(item) {
	const mediaClass = `media-${item.type}`;
	const authors = item.authors || (item.author ? [item.author] : []);
	const authorsHtml = getAuthorsHtml(authors);

	// Verdict Badge
	let verdictHtml = '';
	if (['Completed', 'Anticipating', 'Dropped', 'On Hold'].includes(item.status) && item.rating) {
		verdictHtml = `<span class="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md backdrop-blur-md shadow-xl ${TEXT_COLORS[item.rating]}">${RATING_LABELS[item.rating]}</span>`;
	}

	const coverUrl = item.coverUrl ? `/images/${item.coverUrl}` : null;
	const coverHtml = coverUrl
		? `<img src="${coverUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">`
		: `<div class="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-700 bg-zinc-100 dark:bg-zinc-900"><i data-lucide="image" class="w-10 h-10 opacity-30"></i></div>`;

	let progressHtml = '';
	if (item.progress) {
		progressHtml = `<div class="absolute top-3 right-3 z-20 bg-transparent backdrop-blur-md px-2 py-1 rounded-md border border-amber-500/30 shadow-lg flex items-center gap-1.5 pointer-events-none">
                    <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                    <span class="text-[10px] font-bold text-amber-600 dark:text-amber-300 drop-shadow-md dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.9)] truncate max-w-[80px]">${item.progress}</span>
                </div>`;
	}

	let hiddenBadge = '';
	if (item.isHidden) {
		hiddenBadge = `<span class="media-badge !border-[var(--col-hidden)] !text-[var(--col-hidden)] px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md whitespace-nowrap">HIDDEN</span>`;
	}

	const statusIcon = STATUS_ICON_MAP[item.status] || 'circle';
	let displayStatus = item.status;
	if (item.status === 'Reading/Watching') {
		displayStatus = ['Anime', 'Movie', 'Series'].includes(item.type) ? 'Watching' : 'Reading';
	}
	const statusBadge = `<span class="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${STATUS_COLOR_MAP[item.status]} !bg-transparent !border-none backdrop-blur-md whitespace-nowrap px-2.5 py-1 rounded-md"><i data-lucide="${statusIcon}" class="w-3 h-3"></i> ${displayStatus}</span>`;

	// Media Type Icon Styling
	let iconColorClass = "text-zinc-600 dark:text-white bg-white/80 dark:bg-black/60 border-white/20 dark:border-white/10";
	if (item.type === 'Anime') iconColorClass = "text-white bg-violet-600 border-violet-400";
	if (item.type === 'Manga') iconColorClass = "text-white bg-pink-600 border-pink-400";
	if (item.type === 'Book') iconColorClass = "text-white bg-blue-600 border-blue-400";
	if (item.type === 'Movie') iconColorClass = "text-white bg-red-600 border-red-400";
	if (item.type === 'Series') iconColorClass = "text-white bg-amber-600 border-amber-400";

	const seriesDisplayText = item.seriesNumber ? `${item.series} #${item.seriesNumber}` : item.series;


	if (state.viewMode === 'grid') {
		const badgeOverlay = `
            <div class="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end z-20 pointer-events-none">
                <div class="flex flex-wrap items-end justify-between mb-1.5 gap-y-1">
                    <div class="flex flex-wrap gap-2 items-center">${statusBadge} ${item.isHidden ? `<i data-lucide="eye-off" class="w-4 h-4 text-[var(--col-hidden)] drop-shadow-md" title="Hidden"></i>` : ''}</div>
                    ${verdictHtml}
                </div>
                ${!state.showDetails ? `<h3 class="font-heading font-bold text-lg leading-tight line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-white dark:text-[var(--theme-col)] transition-colors">${item.title}</h3>` : ''}
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 pointer-events-none"></div>
        `;

		let detailBlock = '';
		if (state.showDetails) {
			detailBlock = `
                 <div class="p-4 pt-5 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-white/5 flex flex-col relative z-20 pointer-events-auto h-[12rem] overflow-hidden">
                     <h3 class="font-heading font-bold text-2xl leading-[1.2] line-clamp-2 text-[var(--theme-col)] transition-colors mb-1.5 shrink-0">${item.title}</h3>
                     <div class="flex flex-col gap-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                          ${authors.length ? `<div class="text-zinc-600 dark:text-zinc-300 line-clamp-2 block"><i data-lucide="pen-tool" class="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 inline-block mr-1.5 align-text-bottom pointer-events-none"></i>${authorsHtml}</div>` : ''}
                          ${item.universe ? `<button type="button" onclick="smartFilter(event, 'universe', '${item.universe.replace(/'/g, "\\'")}')" class="bg-transparent border-none p-0 flex items-center gap-1.5 truncate text-indigo-500 dark:text-indigo-300 cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors z-30 max-w-full"><i data-lucide="globe" class="w-3.5 h-3.5 opacity-50 pointer-events-none shrink-0"></i> <span class="truncate">${item.universe}</span></button>` : ''}
                          ${item.series ? `<button type="button" onclick="smartFilter(event, 'series', '${item.series.replace(/'/g, "\\'")}')" class="bg-transparent border-none p-0 flex items-center gap-1.5 truncate text-emerald-600 dark:text-emerald-300 cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-200 transition-colors z-30 max-w-full"><i data-lucide="library" class="w-3.5 h-3.5 opacity-50 pointer-events-none shrink-0"></i> <span class="truncate">${seriesDisplayText}</span></button>` : ''}
                     </div>
                     ${getSynopsisBlockHtml(item, authors)}
                 </div>`;
		}

		return `
             <div onclick="openDetail('${item.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail('${item.id}');}" class="group relative h-auto rounded-xl overflow-hidden cursor-pointer media-card ${mediaClass} bg-white dark:bg-zinc-900 flex flex-col shadow-lg outline-none focus:ring-4 focus:ring-indigo-500/50">
                 <div class="relative w-full aspect-[2/3] overflow-hidden bg-zinc-100 dark:bg-zinc-950 pointer-events-none">
                     ${coverHtml}
                     ${progressHtml}
                     <div class="absolute top-2.5 left-2.5 z-30 p-2 rounded-lg border shadow-xl ${iconColorClass} pointer-events-none">
                         <i data-lucide="${ICON_MAP[item.type] || 'book'}" class="w-5 h-5"></i>
                     </div>
                     ${badgeOverlay}
                 </div>
                 ${detailBlock}
             </div>`;
	} else {
		// LIST VIEW (Expanded or compact)
		if (state.showDetails) {
			let childrenListHtml = '';
			if (item.children && item.children.length) {
				childrenListHtml = item.children.map(c => {
					let stars = '';
					for (let i = 1; i <= 4; i++) {
						stars += `<i data-lucide="star" class="w-4 h-4 ${c.rating >= i ? STAR_FILLS[c.rating] : 'text-zinc-400 dark:text-zinc-700'} fill-current"></i>`;
					}
					return `<div class="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-full">
                                    <span class="text-sm text-zinc-700 dark:text-zinc-300 font-bold tracking-wide">${c.title}</span>
                                    <div class="flex gap-1">${stars}</div>
                                </div>`;
				}).join('');
				childrenListHtml = `<div class="flex flex-col gap-2 w-full mt-2">${childrenListHtml}</div>`;
			}

			const detailedLinksHtml = (item.externalLinks && item.externalLinks.length)
				? `<div class="flex flex-wrap gap-2 mt-3 justify-center">
                                 ${item.externalLinks.map(l => `<a href="${l.url}" target="_blank" onclick="event.stopPropagation()" class="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 transition-colors"><i data-lucide="link" class="w-3 h-3"></i> ${l.label || 'Link'}</a>`).join('')}
                                </div>`
				: '';

			const detailCover = coverUrl
				? `<img src="${coverUrl}" class="w-full h-full object-contain rounded-lg shadow-xl">`
				: `<div class="w-full h-full flex items-center justify-center text-zinc-500 dark:text-zinc-700 bg-zinc-100 dark:bg-zinc-800 rounded-lg"><i data-lucide="image" class="w-12 h-12 opacity-30"></i></div>`;

			const hasRating = ['Completed', 'Anticipating', 'Dropped', 'On Hold'].includes(item.status) && item.rating;

			return `
                 <div onclick="openDetail('${item.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail('${item.id}');}" class="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden media-card list-card-mode ${mediaClass} hover:border-[var(--theme-col)] transition-all shadow-lg p-6 cursor-pointer outline-none focus:ring-4 focus:ring-indigo-500/50">
                          <div class="flex flex-col md:flex-row gap-8">
 
                               <div class="w-full md:w-52 shrink-0 flex flex-col">
                                   <div class="w-full aspect-[2/3] bg-zinc-100 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-white/5 relative flex items-center justify-center overflow-hidden">
                                       ${detailCover}
                                        <div class="absolute top-2 left-2 z-20 p-1.5 rounded-md border shadow-lg ${iconColorClass}">
                                           <i data-lucide="${ICON_MAP[item.type] || 'book'}" class="w-4 h-4"></i>
                                       </div>
                                       ${item.isHidden ? `<div class="absolute top-2 right-2 z-20 bg-[var(--col-hidden)] text-white px-2 py-1 rounded text-[10px] font-black tracking-wider shadow-lg">HIDDEN</div>` : ''}
                                   </div>
                                    ${detailedLinksHtml}
                               </div>

                               <div class="flex-1 flex flex-col gap-5">
                                   <div class="flex flex-col gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                                       <div class="flex justify-between items-start">
                                          <h3 class="text-3xl font-heading font-black text-zinc-800 dark:text-[var(--theme-col)] transition-colors">${item.title}</h3>
                                           <div class="flex gap-2">${statusBadge} ${hiddenBadge}</div>
                                       </div>

                                       <div class="flex flex-wrap gap-4 text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                                           ${authors.length ? `<span onclick="event.stopPropagation()" class="flex items-center gap-1.5 cursor-auto"><i data-lucide="pen-tool" class="w-4 h-4 text-zinc-400 dark:text-zinc-600"></i> ${authorsHtml}</span>` : ''}
                                           ${item.series ? `<button type="button" onclick="smartFilter(event, 'series', '${item.series}')" class="bg-transparent border-none p-0 text-emerald-500 dark:text-emerald-400/90 flex items-center gap-1.5 cursor-pointer hover:underline"><i data-lucide="library" class="w-4 h-4"></i> ${seriesDisplayText}</button>` : ''}
                                           ${item.universe ? `<button type="button" onclick="smartFilter(event, 'universe', '${item.universe}')" class="bg-transparent border-none p-0 text-indigo-500 dark:text-indigo-400/90 flex items-center gap-1.5 cursor-pointer hover:underline"><i data-lucide="globe" class="w-4 h-4"></i> ${item.universe}</button>` : ''}
                                       </div>

                                       ${item.description ? `
                                       <div class="text-zinc-600 dark:text-zinc-400 text-sm mt-3 leading-relaxed group/desc relative" onclick="event.stopPropagation()">
                                            <div class="text-[10px] font-bold text-zinc-800 dark:text-[var(--theme-col)] uppercase tracking-wider mb-1 opacity-70">Synopsis</div>
                                           <div id="desc-${item.id}" class="line-clamp-3 whitespace-pre-wrap">${item.description}</div>
                                            <button type="button" id="btn-desc-${item.id}" onclick="event.stopPropagation(); toggleExpand('${item.id}', 'desc')" class="text-xs text-[var(--theme-col)] font-bold mt-1 hover:underline relative z-50 hidden">Read More</button>
                                       </div>` : ''}

                                       ${item.notes ? `
                                       <div class="text-zinc-600 dark:text-zinc-400 text-sm mt-3 leading-relaxed group/notes relative" onclick="event.stopPropagation()">
                                           <div class="text-[10px] font-bold text-zinc-800 dark:text-[var(--theme-col)] uppercase tracking-wider mb-1 opacity-70">Notes</div>
                                            <div id="list-notes-${item.id}" class="line-clamp-3 whitespace-pre-wrap">${item.notes || ''}</div>
                                            <button type="button" id="btn-list-notes-${item.id}" onclick="event.stopPropagation(); toggleExpand('${item.id}', 'list-notes')" class="text-xs text-[var(--theme-col)] font-bold mt-1 hover:underline relative z-50 hidden">Read More</button>
                                        </div>` : ''}

                                   </div>

                                   ${(hasRating || item.review) ? `
                                    <div class="bg-zinc-100 dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-xl p-5 clearfix">
                                       ${hasRating ? `
                                        <div class="float-left mr-6 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col items-center gap-1 shadow-lg">
                                           <div class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Verdict</div>
                                           <div class="text-4xl font-heading font-black uppercase ${TEXT_COLORS[item.rating]}">${RATING_LABELS[item.rating]}</div>
                                           <div class="flex gap-1 mt-1">
                                               ${[1, 2, 3, 4].map(i => `<i data-lucide="star" class="w-4 h-4 ${item.rating >= i ? STAR_FILLS[item.rating] : 'text-zinc-300 dark:text-zinc-800'} fill-current"></i>`).join('')}
                                           </div>
                                        </div>` : ''}

                                        ${item.review ? `
                                        <div class="text-zinc-700 dark:text-zinc-300 italic text-xs leading-relaxed relative" onclick="event.stopPropagation()">
                                           <div id="review-${item.id}" class="line-clamp-3 whitespace-pre-wrap"><i data-lucide="quote" class="inline w-3 h-3 text-zinc-400 dark:text-zinc-600 mr-1 align-top"></i>${item.review}</div>
                                            <button type="button" id="btn-review-${item.id}" onclick="event.stopPropagation(); toggleExpand('${item.id}', 'review')" class="text-xs text-[var(--theme-col)] font-bold ml-1 hover:underline relative z-50 hidden">Read More</button>
                                        </div>` : ''}
                                    </div>` : ''}

                                    ${childrenListHtml ? `
                                    <div onclick="event.stopPropagation()">
                                       <h4 class="text-xs font-bold text-zinc-800 dark:text-[var(--theme-col)] uppercase tracking-widest mb-3 flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4"></i> ${['Book', 'Manga'].includes(item.type) ? 'Volumes' : 'Seasons'}</h4>
                                       ${childrenListHtml}
                                    </div>` : ''}
                                    
                                     ${item.progress ? `<div class="mt-auto pt-2"><div class="text-xs font-mono text-amber-600 dark:text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 inline-block">Progress: ${item.progress}</div></div>` : ''}
                               </div>
                          </div>
                     </div>
             `;
		} else {
			// Condensed List View
			const themeColorClass = TYPE_COLOR_MAP[item.type].split(' ')[0]; // Gets 'text-pink-400' etc.

			return `
                <div onclick="openDetail('${item.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail('${item.id}');}" class="group flex items-center justify-between gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-xl hover:border-[var(--theme-col)] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 cursor-pointer shadow-sm mb-3 media-card list-card-mode ${mediaClass} outline-none focus:ring-4 focus:ring-indigo-500/50">
                    
                    <!-- Left: Cover & Info -->
                    <div class="flex items-center gap-5 flex-1 min-w-0">
                        <!-- Small Cover -->
                        <div class="w-14 h-20 md:w-16 md:h-24 shrink-0 relative overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-lg">
                            ${coverHtml.replace('object-cover', 'object-cover w-full h-full')}
                            ${item.isHidden ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><i data-lucide="eye-off" class="w-6 h-6 text-white/70"></i></div>` : ''}
                        </div>
                        
                        <!-- Text Info -->
                        <div class="flex flex-col gap-1.5 min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                    <h3 class="font-heading font-black text-lg md:text-xl ${themeColorClass} transition-colors truncate leading-tight">${item.title}</h3>
                                    ${item.isHidden ? `<i data-lucide="eye-off" class="w-4 h-4 text-[var(--col-hidden)] shrink-0" title="Hidden"></i>` : ''}
                            </div>
                            
                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                                <div class="flex items-center gap-1.5 shrink-0 px-2 py-0.5 ${TYPE_COLOR_MAP[item.type]} backdrop-blur-md shadow-md">
    <i data-lucide="${ICON_MAP[item.type] || 'book'}" class="w-3.5 h-3.5"></i>
    <span class="font-bold uppercase tracking-wide text-[9px]">${item.type}</span>
</div>
                                
                                ${item.series ? `<div class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400/90 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors cursor-pointer truncate" onclick="smartFilter(event, 'series', '${item.series}')"><i data-lucide="library" class="w-3.5 h-3.5 opacity-70"></i> <span class="truncate max-w-[150px] md:max-w-[200px]">${item.series} ${item.seriesNumber ? '#' + item.seriesNumber : ''}</span></div>` : ''}
                                ${item.universe ? `<div class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400/90 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors cursor-pointer truncate" onclick="smartFilter(event, 'universe', '${item.universe}')"><i data-lucide="globe" class="w-3.5 h-3.5 opacity-70"></i> <span class="truncate max-w-[150px]">${item.universe}</span></div>` : ''}
                            </div>
                            
                            <div class="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                                ${authors.length ? `<span class="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors cursor-pointer" onclick="event.stopPropagation()"><i data-lucide="pen-tool" class="w-3 h-3 opacity-50"></i> ${authorsHtml}</span>` : '<span class="italic text-zinc-700">No Author/Studio</span>'}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Meta Data -->
                    <div class="flex flex-col items-center gap-1 shrink-0 relative z-10 pl-2 ml-auto">
                        
                        <!-- Status Badge -->
                        <div class="hidden sm:block">
                            ${statusBadge}
                        </div>

                        <!-- Rating -->
                        ${['Completed', 'Anticipating', 'Dropped', 'On Hold'].includes(item.status) && item.rating ? `
    <div class="w-auto flex justify-center">
        <span class="text-[10px] md:text-xs font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-md shadow-lg ${TEXT_COLORS[item.rating]} min-w-[70px] text-center whitespace-nowrap">${RATING_LABELS[item.rating]}</span>
    </div>` : `
    <div class="hidden md:block w-20"></div>`}

                        <!-- Progress -->
                        ${item.progress ? `
                            <div class="flex items-center gap-1 justify-center">
                                <span class="text-xs font-mono font-bold text-amber-600 dark:text-amber-500 whitespace-nowrap bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">${item.progress}</span>
                            </div>` : ''}
                        
                    </div>
                </div>`;
		}
	}
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
