/**
 * @fileoverview Card rendering logic for UpNext.
 * Contains functions to generate HTML for media cards in grid and list views.
 * @module card_renderer
 */

import { state, isFieldVisible } from './state.js';
import {
	ICON_MAP, STATUS_ICON_MAP, STATUS_COLOR_MAP, TYPE_COLOR_MAP,
	RATING_LABELS, TEXT_COLORS, STAR_FILLS
} from './constants.js';

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

/**
 * Generates the complete HTML string for a single media card.
 * Supports both grid and list view modes.
 * @param {Object} item - The media item to render.
 * @returns {string} The generated HTML string.
 */
export function generateCardHtml(item) {
	const mediaClass = `media-${item.type}`;
	const authors = item.authors || (item.author ? [item.author] : []);
	const authorsHtml = getAuthorsHtml(authors);

	// Verdict Badge
	let verdictHtml = '';
	// Use isFieldVisible('verdict') instead of checking disabledFeatures directly
	if (['Completed', 'Anticipating', 'Dropped', 'On Hold'].includes(item.status) && item.rating && isFieldVisible('verdict')) {
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
                          ${isFieldVisible('authors') && authors.length ? `<div class="text-zinc-600 dark:text-zinc-300 line-clamp-2 block"><i data-lucide="pen-tool" class="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 inline-block mr-1.5 align-text-bottom pointer-events-none"></i>${authorsHtml}</div>` : ''}
                          ${isFieldVisible('universe') && item.universe ? `<button type="button" onclick="smartFilter(event, 'universe', '${item.universe.replace(/'/g, "\\'")}')" class="bg-transparent border-none p-0 flex items-center gap-1.5 truncate text-indigo-500 dark:text-indigo-300 cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors z-30 max-w-full"><i data-lucide="globe" class="w-3.5 h-3.5 opacity-50 pointer-events-none shrink-0"></i> <span class="truncate">${item.universe}</span></button>` : ''}
                          ${isFieldVisible('series') && item.series ? `<button type="button" onclick="smartFilter(event, 'series', '${item.series.replace(/'/g, "\\'")}')" class="bg-transparent border-none p-0 flex items-center gap-1.5 truncate text-emerald-600 dark:text-emerald-300 cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-200 transition-colors z-30 max-w-full"><i data-lucide="library" class="w-3.5 h-3.5 opacity-50 pointer-events-none shrink-0"></i> <span class="truncate">${seriesDisplayText}</span></button>` : ''}
                     </div>
                     ${getSynopsisBlockHtml(item, authors)}
                 </div>`;
		}

		return `
             <div onclick="openDetail('${item.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetail('${item.id}');}" class="group relative h-auto rounded-xl overflow-hidden cursor-pointer media-card ${mediaClass} bg-white dark:bg-zinc-900 flex flex-col shadow-lg outline-none focus:ring-4 focus:ring-indigo-500/50">
                 <div class="relative w-full aspect-[2/3] overflow-hidden bg-zinc-100 dark:bg-zinc-950 pointer-events-none">
                     ${coverHtml}
                     ${isFieldVisible('progress') ? progressHtml : ''}
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
			if (isFieldVisible('series_number') && item.children && item.children.length) {
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

			const detailedLinksHtml = (isFieldVisible('external_links') && item.externalLinks && item.externalLinks.length)
				? `<div class="flex flex-wrap gap-2 mt-3 justify-center">
                                 ${item.externalLinks.map(l => `<a href="${l.url}" target="_blank" onclick="event.stopPropagation()" class="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 transition-colors"><i data-lucide="link" class="w-3 h-3"></i> ${l.label || 'Link'}</a>`).join('')}
                                </div>`
				: '';

			const detailCover = coverUrl
				? `<img src="${coverUrl}" loading="lazy" class="w-full h-full object-contain rounded-lg shadow-xl">`
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
                                           ${isFieldVisible('authors') && authors.length ? `<span onclick="event.stopPropagation()" class="flex items-center gap-1.5 cursor-auto"><i data-lucide="pen-tool" class="w-4 h-4 text-zinc-400 dark:text-zinc-600"></i> ${authorsHtml}</span>` : ''}
                                           ${isFieldVisible('series') && item.series ? `<button type="button" onclick="smartFilter(event, 'series', '${item.series}')" class="bg-transparent border-none p-0 text-emerald-500 dark:text-emerald-400/90 flex items-center gap-1.5 cursor-pointer hover:underline"><i data-lucide="library" class="w-4 h-4"></i> ${seriesDisplayText}</button>` : ''}
                                           ${isFieldVisible('universe') && item.universe ? `<button type="button" onclick="smartFilter(event, 'universe', '${item.universe}')" class="bg-transparent border-none p-0 text-indigo-500 dark:text-indigo-400/90 flex items-center gap-1.5 cursor-pointer hover:underline"><i data-lucide="globe" class="w-4 h-4"></i> ${item.universe}</button>` : ''}
                                       </div>
 
                                       ${item.description ? `
                                       <div class="text-zinc-600 dark:text-zinc-400 text-sm mt-3 leading-relaxed group/desc relative" onclick="event.stopPropagation()">
                                            <div class="text-[10px] font-bold text-zinc-800 dark:text-[var(--theme-col)] uppercase tracking-wider mb-1 opacity-70">Synopsis</div>
                                           <div id="desc-${item.id}" class="line-clamp-3 whitespace-pre-wrap">${item.description}</div>
                                            <button type="button" id="btn-desc-${item.id}" onclick="event.stopPropagation(); toggleExpand('${item.id}', 'desc')" class="text-xs text-[var(--theme-col)] font-bold mt-1 hover:underline relative z-50 hidden">Read More</button>
                                       </div>` : ''}
 
                                       ${isFieldVisible('notes') && item.notes ? `
                                       <div class="text-zinc-600 dark:text-zinc-400 text-sm mt-3 leading-relaxed group/notes relative" onclick="event.stopPropagation()">
                                           <div class="text-[10px] font-bold text-zinc-800 dark:text-[var(--theme-col)] uppercase tracking-wider mb-1 opacity-70">Notes</div>
                                            <div id="list-notes-${item.id}" class="line-clamp-3 whitespace-pre-wrap">${item.notes || ''}</div>
                                            <button type="button" id="btn-list-notes-${item.id}" onclick="event.stopPropagation(); toggleExpand('${item.id}', 'list-notes')" class="text-xs text-[var(--theme-col)] font-bold mt-1 hover:underline relative z-50 hidden">Read More</button>
                                        </div>` : ''}
 
                                   </div>
 
                                   ${(hasRating || (isFieldVisible('review') && item.review)) ? `
                                    <div class="bg-zinc-100 dark:bg-black/20 border border-zinc-200 dark:border-white/5 rounded-xl p-5 clearfix">
                                       ${hasRating ? `
                                        <div class="float-left mr-6 mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 flex flex-col items-center gap-1 shadow-lg">
                                           <div class="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Verdict</div>
                                           <div class="text-4xl font-heading font-black uppercase ${TEXT_COLORS[item.rating]}">${RATING_LABELS[item.rating]}</div>
                                           <div class="flex gap-1 mt-1">
                                               ${[1, 2, 3, 4].map(i => `<i data-lucide="star" class="w-4 h-4 ${item.rating >= i ? STAR_FILLS[item.rating] : 'text-zinc-300 dark:text-zinc-800'} fill-current"></i>`).join('')}
                                           </div>
                                        </div>` : ''}
 
                                        ${isFieldVisible('review') && item.review ? `
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
                                    
                                     ${isFieldVisible('progress') && item.progress ? `<div class="mt-auto pt-2"><div class="text-xs font-mono text-amber-600 dark:text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 inline-block">Progress: ${item.progress}</div></div>` : ''}
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
                                
                                ${isFieldVisible('series') && item.series ? `<div class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400/90 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors cursor-pointer truncate" onclick="smartFilter(event, 'series', '${item.series}')"><i data-lucide="library" class="w-3.5 h-3.5 opacity-70"></i> <span class="truncate max-w-[150px] md:max-w-[200px]">${item.series} ${item.seriesNumber ? '#' + item.seriesNumber : ''}</span></div>` : ''}
                                ${isFieldVisible('universe') && item.universe ? `<div class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400/90 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors cursor-pointer truncate" onclick="smartFilter(event, 'universe', '${item.universe}')"><i data-lucide="globe" class="w-3.5 h-3.5 opacity-70"></i> <span class="truncate max-w-[150px]">${item.universe}</span></div>` : ''}
                            </div>
                            
                            <div class="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                                ${isFieldVisible('authors') ? (authors.length ? `<span class="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors cursor-pointer" onclick="event.stopPropagation()"><i data-lucide="pen-tool" class="w-3 h-3 opacity-50"></i> ${authorsHtml}</span>` : '<span class="italic text-zinc-700">No Author/Studio</span>') : ''}
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
                        ${isFieldVisible('progress') && item.progress ? `
                            <div class="flex items-center gap-1 justify-center">
                                <span class="text-xs font-mono font-bold text-amber-600 dark:text-amber-500 whitespace-nowrap bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">${item.progress}</span>
                            </div>` : ''}
                        
                    </div>
                </div>`;
		}
	}
}
