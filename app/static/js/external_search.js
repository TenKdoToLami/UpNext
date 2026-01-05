/**
 * @fileoverview External API search module for UpNext.
 * Handles searching external APIs (AniList, TMDB, OpenLibrary) and importing metadata.
 * @module external_search
 */

import { state } from './state.js';
import { safeCreateIcons, getRandomPastelHex } from './dom_utils.js';
import { showToast } from './toast.js';
import { ICON_MAP, TYPE_COLOR_MAP } from './constants.js';
import { saveTag } from './api_service.js';
import { resetWizardFields } from './wizard_logic.js';


const SOURCE_CONFIG = {
    anilist: { name: 'AniList', icon: 'sparkles', color: 'text-blue-400' },
    tmdb: { name: 'TMDB', icon: 'film', color: 'text-green-400' },
    openlibrary: { name: 'Open Library', icon: 'book-open', color: 'text-amber-400' },
    tvmaze: { name: 'TVMaze', icon: 'tv', color: 'text-teal-400' },
    mangadex: { name: 'MangaDex', icon: 'book', color: 'text-orange-400' },
    googlebooks: { name: 'Google Books', icon: 'search', color: 'text-blue-500' },
    comicvine: { name: 'Comic Vine', icon: 'zap', color: 'text-yellow-400' }
};

let searchDebounceTimer = null;

let currentSearchType = '';
let currentSearchSource = '';
let searchPriorities = {};
let currentResults = [];

/**
 * Opens the external search modal.
 * @param {string} mediaType - The media type to search for (Anime, Manga, Book, Movie, Series)
 */
export function openExternalSearchModal(mediaType) {
    if (resetWizardFields) resetWizardFields(3);

    currentSearchType = mediaType;

    const modal = document.getElementById('externalSearchModal');
    if (!modal) {
        createSearchModal();
    }

    const modalEl = document.getElementById('externalSearchModal');
    const typeDisplay = document.getElementById('externalSearchType');
    const input = document.getElementById('externalSearchInput');
    const resultsContainer = document.getElementById('externalSearchResults');

    if (typeDisplay) typeDisplay.textContent = mediaType;
    if (input) input.value = '';
    if (resultsContainer) resultsContainer.innerHTML = renderEmptyState();

    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');

    setTimeout(() => input?.focus(), 100);

    fetch('/api/config')
        .then(res => res.json())
        .then(config => {
            searchPriorities = config.searchPriorities || {};

            currentSearchSource = searchPriorities[mediaType] || null;

            if (!currentSearchSource) {
                if (mediaType === 'Anime') currentSearchSource = 'anilist';
                else if (mediaType === 'Manga') currentSearchSource = 'mangadex';
                else if (mediaType === 'Movie') currentSearchSource = 'tmdb';
                else if (mediaType === 'Series') currentSearchSource = 'tmdb';
                else if (mediaType === 'Book') currentSearchSource = 'openlibrary';
            }

            updateSearchHeader();
        })
        .catch(err => console.error("Failed to load search config", err));

    safeCreateIcons();
}

function updateSearchHeader() {
    const btn = document.querySelector('button[onclick="window.toggleSearchInput()"]');
    if (btn && currentSearchSource) {
        const config = SOURCE_CONFIG[currentSearchSource] || { name: 'External', icon: 'globe' };
        btn.innerHTML = `
            <div class="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                 <i data-lucide="${config.icon}" class="w-3 h-3"></i>
                 <span class="text-[10px] font-bold uppercase tracking-wider">Searching in ${config.name}</span>
            </div>
            <i id="searchInputArrow" data-lucide="chevron-up" class="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-transform"></i>
        `;
        safeCreateIcons();
    }
}

/**
 * Creates the search modal HTML structure.
 */
function createSearchModal() {
    const modalHtml = `
		<div id="externalSearchModal" class="fixed inset-0 z-[100] hidden items-center justify-center bg-black/60 backdrop-blur-sm">
			<div class="relative w-full max-w-2xl mx-4 bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 overflow-hidden">
				<!-- Header -->
				<div class="flex items-center justify-between p-4 border-b border-zinc-700">
					<div class="flex items-center gap-3">
						<div class="p-2 rounded-xl bg-indigo-500/20">
							<i data-lucide="search" class="w-5 h-5 text-indigo-400"></i>
						</div>
						<div>
							<h3 class="font-bold text-white">Search Online</h3>
							<p class="text-xs text-zinc-400">Searching for <span id="externalSearchType" class="text-indigo-400 font-medium">Anime</span></p>
						</div>
					</div>
					<button onclick="window.closeExternalSearchModal()" class="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
						<i data-lucide="x" class="w-5 h-5 text-zinc-400"></i>
					</button>
				</div>
				
				<!-- Search Input -->
				<div id="externalSearchInputContainer" class="p-4 border-b border-zinc-800 transition-all origin-top duration-300">
					<div class="relative">
						<i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"></i>
						<input 
							type="text" 
							id="externalSearchInput"
							placeholder="Type to search..."
							class="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
							oninput="window.handleExternalSearchInput(this.value)"
						>
						<div id="externalSearchSpinner" class="hidden absolute right-3 top-1/2 -translate-y-1/2">
							<i data-lucide="loader-2" class="w-4 h-4 text-indigo-400 animate-spin"></i>
						</div>
					</div>
				</div>

				<!-- Search Controls Header (Searching In Status) -->
                <div 
                    class="w-full flex items-center justify-between px-4 py-2 bg-zinc-800/30 border-b border-zinc-800 transition-colors">
                    <div class="flex items-center gap-2 text-zinc-500">
                         <i data-lucide="filter" class="w-3 h-3"></i>
                         <span class="text-[10px] font-bold uppercase tracking-wider">Search Parameters</span>
                    </div>
                </div>
				
				<!-- Results -->
				<div id="externalSearchResults" class="max-h-[400px] overflow-y-auto custom-scrollbar p-4">
					${renderEmptyState()}
				</div>
				
				<!-- Footer -->
				<div class="p-3 border-t border-zinc-800 bg-zinc-900/50">
					<p class="text-xs text-zinc-500 text-center">
						Powered by <span class="text-blue-400">AniList</span>, <span class="text-green-400">TMDB</span>, <span class="text-blue-500">TVMaze</span>, <span class="text-amber-400">Open Library</span>, <span class="text-pink-500">MangaDex</span>, <span class="text-indigo-400">Google Books</span>, and <span class="text-zinc-300">Comic Vine</span>
					</p>
				</div>
			</div>
		</div>
	`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Close on backdrop click
    const modal = document.getElementById('externalSearchModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeExternalSearchModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeExternalSearchModal();
        }
    });
}

/**
 * Closes the external search modal.
 */
export function closeExternalSearchModal() {
    const modal = document.getElementById('externalSearchModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/**
 * Handles search input with debouncing.
 * @param {string} query - Search query
 */
export function handleExternalSearchInput(query) {
    clearTimeout(searchDebounceTimer);

    const spinner = document.getElementById('externalSearchSpinner');
    const resultsContainer = document.getElementById('externalSearchResults');

    if (!query || query.trim().length < 2) {
        if (resultsContainer) resultsContainer.innerHTML = renderEmptyState();
        return;
    }

    // Show spinner
    if (spinner) spinner.classList.remove('hidden');

    searchDebounceTimer = setTimeout(async () => {
        await performSearch(query.trim());
    }, 300);
}

/**
 * Performs the actual API search.
 * @param {string} query - Search query
 */
async function performSearch(query) {
    const spinner = document.getElementById('externalSearchSpinner');
    const resultsContainer = document.getElementById('externalSearchResults');

    try {
        const response = await fetch(`/api/external/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(currentSearchType)}`);
        const data = await response.json();

        if (!response.ok) {
            // Handle specific errors
            if (data.error === 'TMDB API key not configured') {
                resultsContainer.innerHTML = renderApiKeyMissing();
            } else {
                resultsContainer.innerHTML = renderError(data.message || data.error);
            }
            return;
        }

        currentResults = data.results || [];

        if (currentResults.length === 0) {
            resultsContainer.innerHTML = renderNoResults(query) + renderSecondarySearchOptions(query);
        } else {
            // Updated to use the correct function name for grouped results
            renderSearchResults(currentResults);
        }

    } catch (error) {
        console.error('External search failed:', error);
        resultsContainer.innerHTML = renderError('Failed to search. Please check your connection.');
    } finally {
        if (spinner) spinner.classList.add('hidden');
        safeCreateIcons();
    }
}

/**
 * Handles secondary search (e.g. Anime in TMDB, Series in AniList)
 */
/**
 * Handles secondary search (e.g. Anime in TMDB, Series in AniList)
 * Triggered by expanding the details element.
 */
window.performSecondarySearch = async function (source, detailsEl) {
    // Only fetch if opening
    if (!detailsEl.open) return;

    // Check if already loaded to prevent refetch
    const resultsContainer = document.getElementById(`secondary-results-${source}`);
    if (resultsContainer && resultsContainer.children.length > 0) return;

    const query = document.getElementById('externalSearchInput').value.trim();
    if (!query) return;

    const spinner = document.getElementById(`secondary-spinner-${source}`);

    // UI Loading state
    if (spinner) spinner.classList.remove('hidden');

    try {
        const response = await fetch(`/api/external/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(currentSearchType)}&source=${source}`);
        const data = await response.json();

        if (!response.ok) {
            if (resultsContainer) resultsContainer.innerHTML = `<div class="p-3 text-red-400 text-xs text-center">${data.message || 'Search failed'}</div>`;
            return;
        }

        const newResults = data.results || [];

        if (newResults.length === 0) {
            if (resultsContainer) resultsContainer.innerHTML = `<div class="p-3 text-zinc-500 text-xs text-center italic">No additional results found in ${source.toUpperCase()}</div>`;
        } else {
            // Append these results to currentResults so index works for selection
            const startIdx = currentResults.length;
            currentResults = [...currentResults, ...newResults];

            if (resultsContainer) {
                resultsContainer.innerHTML = ''; // Clear container
                const listWrapper = document.createElement('div');
                listWrapper.className = 'space-y-2 pb-2';

                newResults.forEach(item => {
                    listWrapper.appendChild(createResultItem(item));
                });

                resultsContainer.appendChild(listWrapper);
            }
        }

    } catch (error) {
        console.error(`Secondary search for ${source} failed:`, error);
        if (resultsContainer) resultsContainer.innerHTML = `<div class="p-3 text-red-400 text-xs text-center">Connection error</div>`;
    } finally {
        if (spinner) spinner.classList.add('hidden');
        safeCreateIcons();
    }
};


function renderSecondarySearchOptions(query) {
    if (!query) return '';

    let secondarySources = [];

    // Define all potential sources for types
    const sourcesForType = {
        'Anime': ['anilist', 'tmdb', 'tvmaze'],
        'Series': ['tmdb', 'tvmaze', 'anilist'],
        'Movie': ['tmdb', 'anilist'],
        'Manga': ['mangadex', 'anilist', 'comicvine'],
        'Book': ['openlibrary', 'googlebooks', 'comicvine']
    };

    const candidates = sourcesForType[currentSearchType] || [];

    // Filter out the current primary source
    secondarySources = candidates
        .filter(id => id !== currentSearchSource)
        .map(id => ({ id, ...SOURCE_CONFIG[id] }));

    if (secondarySources.length === 0) return '';

    return `
        <div class="mt-6 pt-4 border-t border-zinc-800">
            <div class="space-y-3">
                ${secondarySources.map(src => `
                    <details class="group/item bg-zinc-900/30 rounded-xl overflow-hidden border border-zinc-800/50" 
                        ontoggle="window.performSecondarySearch('${src.id}', this)">
                        <summary class="list-none w-full flex items-center justify-between p-3 hover:bg-zinc-800 transition-colors cursor-pointer select-none">
                            <div class="flex items-center gap-2 text-zinc-400 group-hover/item:text-zinc-300">
                                <i data-lucide="${src.icon}" class="w-4 h-4"></i>
                                <span class="text-xs font-medium">Search in ${src.name}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <div id="secondary-spinner-${src.id}" class="hidden animate-spin">
                                    <i data-lucide="loader-2" class="w-3 h-3 text-indigo-500"></i>
                                </div>
                                <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-600 group-hover/item:text-zinc-500 transition-transform group-open/item:rotate-180"></i>
                            </div>
                        </summary>
                        <div id="secondary-results-${src.id}" class="px-2 empty:hidden border-t border-zinc-800/50"></div>
                    </details>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Renders empty state HTML.
 */
function renderEmptyState() {
    return `
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="p-4 rounded-full bg-zinc-800 mb-4">
				<i data-lucide="globe" class="w-8 h-8 text-zinc-600"></i>
			</div>
			<p class="text-zinc-400 font-medium">Search for media</p>
			<p class="text-zinc-500 text-sm mt-1">Start typing to search external databases</p>
		</div>
	`;
}

/**
 * Renders no results state.
 */
function renderNoResults(query) {
    return `
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="p-4 rounded-full bg-zinc-800 mb-4">
				<i data-lucide="search-x" class="w-8 h-8 text-zinc-600"></i>
			</div>
			<p class="text-zinc-400 font-medium">No results found</p>
			<p class="text-zinc-500 text-sm mt-1">Try a different search term for "${query}"</p>
		</div>
	`;
}

/**
 * Renders error state.
 */
function renderError(message) {
    return `
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="p-4 rounded-full bg-red-500/20 mb-4">
				<i data-lucide="alert-triangle" class="w-8 h-8 text-red-400"></i>
			</div>
			<p class="text-red-400 font-medium">Search Error</p>
			<p class="text-zinc-500 text-sm mt-1">${message}</p>
		</div>
	`;
}

/**
 * Renders API key missing state.
 */
function renderApiKeyMissing() {
    return `
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="p-4 rounded-full bg-amber-500/20 mb-4">
				<i data-lucide="key" class="w-8 h-8 text-amber-400"></i>
			</div>
			<p class="text-amber-400 font-medium">TMDB API Key Required</p>
			<p class="text-zinc-500 text-sm mt-2 max-w-xs">
				To search for movies and series, you need a free TMDB API key.
			</p>
			<a href="https://www.themoviedb.org/settings/api" target="_blank" 
				class="mt-4 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors">
				Get API Key →
			</a>
			<p class="text-zinc-600 text-xs mt-3">Then add it in Settings → API Keys</p>
		</div>
	`;
}

/**
 * Renders search results.
 */
/**
 * Renders the search results grouped by source.
 */
function renderSearchResults(results) {
    const container = document.getElementById('externalSearchResults');
    if (!container) return;

    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = renderEmptyState();
        return;
    }

    // Group items by source
    const grouped = results.reduce((acc, item) => {
        const src = item.source || 'unknown';
        if (!acc[src]) acc[src] = [];
        acc[src].push(item);
        return acc;
    }, {});

    // Config for ordering groups if desired, or just key order
    const sourceKeys = Object.keys(grouped);

    sourceKeys.forEach(sourceKey => {
        const items = grouped[sourceKey];
        const config = SOURCE_CONFIG[sourceKey] || { name: 'Unknown', icon: 'help-circle', color: 'text-zinc-500' };

        const groupEl = document.createElement('div');
        groupEl.className = 'mb-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50';

        const headerId = `group-header-${sourceKey}`;
        const contentId = `group-content-${sourceKey}`;

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between p-3 bg-zinc-800/50 cursor-pointer hover:bg-zinc-800 transition-colors select-none';
        header.onclick = () => {
            const content = document.getElementById(contentId);
            const chevron = document.getElementById(`chevron-${sourceKey}`);
            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                chevron.classList.remove('-rotate-90');
            } else {
                content.classList.add('hidden');
                chevron.classList.add('-rotate-90');
            }
        };

        header.innerHTML = `
            <div class="flex items-center gap-2">
                <i data-lucide="${config.icon}" class="w-4 h-4 ${config.color}"></i>
                <span class="text-sm font-medium text-zinc-300">${config.name}</span>
                <span class="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">${items.length}</span>
            </div>
             <i id="chevron-${sourceKey}" data-lucide="chevron-down" class="w-4 h-4 text-zinc-500 transition-transform"></i>
        `;

        const content = document.createElement('div');
        content.id = contentId;
        content.className = 'divide-y divide-zinc-800/50';

        items.forEach(item => {
            content.appendChild(createResultItem(item));
        });

        groupEl.appendChild(header);
        groupEl.appendChild(content);
        container.appendChild(groupEl);
    });

    if (window.lucide) window.lucide.createIcons();

    const secondaryHtml = renderSecondarySearchOptions(document.getElementById('externalSearchInput')?.value || '');
    if (secondaryHtml) {
        const div = document.createElement('div');
        div.innerHTML = secondaryHtml;
        container.appendChild(div);
        if (window.lucide) window.lucide.createIcons();
    }
}

function createResultItem(item) {
    const el = document.createElement('div');
    el.className = 'p-3 hover:bg-zinc-800/50 transition-colors cursor-pointer group flex gap-4';
    el.onclick = () => selectExternalResult(item.id, item.source, document.getElementById('externalSearchType').textContent);

    const config = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.anilist;
    const year = item.year ? `<span class="text-zinc-500">• ${item.year}</span>` : '';
    const itemsLabel = item.episodes ? `${item.episodes} eps` : (item.chapters ? `${item.chapters} ch` : '');
    const meta = itemsLabel ? `<span class="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">${itemsLabel}</span>` : '';

    let coverHtml = '';
    if (item.cover_url) {
        coverHtml = `<img src="${item.cover_url}" referrerpolicy="no-referrer" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`;
    } else {
        coverHtml = `<div class="w-full h-full bg-zinc-800 flex items-center justify-center"><i data-lucide="image-off" class="w-6 h-6 text-zinc-600"></i></div>`;
    }

    el.innerHTML = `
        <div class="w-12 h-16 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/50">
             ${coverHtml}
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-center">
            <h4 class="text-sm font-medium text-zinc-200 group-hover:text-white truncate transition-colors">${item.title}</h4>
            <div class="flex items-center gap-2 text-xs mt-1">
                 <span class="${config.color} font-medium text-[10px]">${config.name}</span>
                 ${year}
                 ${meta}
            </div>
            ${item.original_title ? `<p class="text-[10px] text-zinc-500 truncate mt-0.5">${item.original_title}</p>` : ''}
        </div>
        <div class="flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
            <i data-lucide="arrow-right" class="w-4 h-4 text-indigo-400"></i>
        </div>
    `;
    return el;
}

/**
 * Selects an external search result and imports its data.
 * @param {number} index - Index of the result in currentResults
 */
/**
 * Selects an external search result and imports its data.
 * @param {string} id - External ID
 * @param {string} source - Source name
 * @param {string} type - Media Type
 */
export async function selectExternalResult(id, source, type) {
    if (state.isSelecting) return;
    state.isSelecting = true;

    showToast('Fetching full details...', 'info');

    const spinner = document.getElementById('externalSearchSpinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
        const response = await fetch(
            `/api/external/details?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&source=${encodeURIComponent(source)}`
        );
        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || 'Failed to fetch details', 'error');
            return;
        }

        const details = data.item;

        closeExternalSearchModal();

        prefillWizardFromExternal(details);

        showToast(`Imported "${details.title}" from ${SOURCE_CONFIG[source]?.name || source}`, 'success');

    } catch (error) {
        console.error('Failed to fetch details:', error);
        showToast('Failed to fetch item details', 'error');
    } finally {
        state.isSelecting = false;
        if (spinner) spinner.classList.add('hidden');
    }
}

/**
 * Prefills wizard fields from external API data.
 * @param {Object} data - Normalized item data from external API
 */
function prefillWizardFromExternal(data) {
    const titleInput = document.getElementById('title');
    if (titleInput && data.title) {
        titleInput.value = data.title;
    }

    const descInput = document.getElementById('description');
    if (descInput && data.description) {
        let cleanDesc = data.description
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?i>/gi, '')
            .replace(/<\/?em>/gi, '')
            .replace(/<\/?b>/gi, '')
            .replace(/<\/?strong>/gi, '')
            .replace(/<[^>]+>/g, '')
            .trim();
        descInput.value = cleanDesc;
    }

    if (data.cover_url) {
        const previewImg = document.getElementById('previewImg');
        const placeholder = document.getElementById('previewPlaceholder');

        if (previewImg) {
            previewImg.setAttribute('referrerpolicy', 'no-referrer');
            previewImg.src = data.cover_url;
            previewImg.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');

            previewImg.dataset.externalUrl = data.cover_url;
        }
    }

    if (data.authors && data.authors.length > 0) {
        if (!state.currentAuthors) state.currentAuthors = [];
        data.authors.forEach(author => {
            if (!state.currentAuthors.includes(author)) {
                state.currentAuthors.push(author);
            }
        });
        if (window.updateModalTags) {
            window.updateModalTags();
            safeCreateIcons();
        }
    }

    if (data.studios && data.studios.length > 0 && currentSearchType === 'Anime') {
        if (!state.currentAuthors) state.currentAuthors = [];
        data.studios.forEach(studio => {
            if (!state.currentAuthors.includes(studio)) {
                state.currentAuthors.push(studio);
            }
        });
        if (window.updateModalTags) {
            window.updateModalTags();
            safeCreateIcons();
        }
    }

    if (data.alternate_titles && data.alternate_titles.length > 0) {
        if (!state.currentAlternateTitles) state.currentAlternateTitles = [];
        data.alternate_titles.forEach(alt => {
            if (!state.currentAlternateTitles.includes(alt)) {
                state.currentAlternateTitles.push(alt);
            }
        });
        if (window.renderAltTitles) {
            window.renderAltTitles();
            safeCreateIcons();
        }
    }

    if (data.tags && data.tags.length > 0) {
        if (!state.currentTags) state.currentTags = [];
        data.tags.forEach(tag => {
            if (!state.allTags[tag]) {
                const color = getRandomPastelHex();
                state.allTags[tag] = { name: tag, color: color, description: '' };
                saveTag(tag, color).catch(err => console.error("Failed to auto-save tag:", tag, err));
            }

            if (!state.currentTags.includes(tag)) {
                state.currentTags.push(tag);
            }
        });
        if (window.renderGenericTags) {
            window.renderGenericTags();
        }
    }

    if (data.genres && data.genres.length > 0) {
        if (!state.currentTags) state.currentTags = [];
        data.genres.slice(0, 5).forEach(genre => {
            if (!state.allTags[genre]) {
                const color = getRandomPastelHex();
                state.allTags[genre] = { name: genre, color: color, description: '' };
                saveTag(genre, color).catch(err => console.error("Failed to auto-save genre tag:", genre, err));
            }

            if (!state.currentTags.includes(genre)) {
                state.currentTags.push(genre);
            }
        });
        if (window.renderGenericTags) {
            window.renderGenericTags();
        }
    }

    const releaseDateInput = document.getElementById('releaseDate');
    if (releaseDateInput && data.release_date) {
        releaseDateInput.value = data.release_date;
    }

    const episodeInput = document.getElementById('episodeCount');
    if (episodeInput && data.episodes) {
        episodeInput.value = data.episodes;
    }

    const chapterInput = document.getElementById('chapterCount');
    if (chapterInput && data.chapters) {
        chapterInput.value = data.chapters;
    }

    const volumeInput = document.getElementById('volumeCount');
    if (volumeInput && data.volumes) {
        volumeInput.value = data.volumes;
    }

    const durationInput = document.getElementById('avgDurationMinutes');
    if (durationInput && data.avg_duration_minutes) {
        durationInput.value = data.avg_duration_minutes;
    }

    const pageInput = document.getElementById('pageCount');
    if (pageInput && data.page_count) {
        pageInput.value = data.page_count;
        pageInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (['Anime', 'Series'].includes(currentSearchType)) {
        if (!state.currentChildren) state.currentChildren = [];

        if (data.seasons && data.seasons.length > 0) {
            data.seasons.forEach(s => {
                const title = `Season ${s.number}`;
                let season = state.currentChildren.find(c =>
                    c.title.toLowerCase() === title.toLowerCase() ||
                    c.title.toLowerCase() === `season ${s.number}`.toLowerCase()
                );

                if (!season) {
                    season = {
                        id: crypto.randomUUID(),
                        title: title,
                        rating: 0
                    };
                    state.currentChildren.push(season);
                }

                season.hasDetails = true;
                if (s.episodes !== undefined && s.episodes !== null) season.episodes = s.episodes;
                if (s.duration !== undefined && s.duration !== null) season.duration = s.duration;
                // Add release date if we have a field for it in child entries
                if (s.release_date) season.release_date = s.release_date;
            });
        } else if (data.episodes || data.avg_duration_minutes) {
            // Fallback: Populate Season 1 if no specific seasons list available
            let season1 = state.currentChildren.find(c => c.title.toLowerCase().startsWith('season 1'));
            if (!season1) {
                season1 = {
                    id: crypto.randomUUID(),
                    title: 'Season 1',
                    rating: 0
                };
                state.currentChildren.push(season1);
            }

            season1.hasDetails = true;
            if (data.episodes) season1.episodes = data.episodes;
            if (data.avg_duration_minutes) season1.duration = data.avg_duration_minutes;
        }

        if (window.renderChildren) window.renderChildren();
    }

    // Book specific: Approximate Words from Page Count
    // If we have page count but no word count, estimate it (250 words/page)
    // and enable manual override to persist it.
    if (currentSearchType === 'Book' && data.page_count && !data.word_count) {
        const estWords = data.page_count * 250;
        const wordInput = document.getElementById('wordCount');
        if (wordInput) {
            wordInput.value = estWords;

            // Enable manual override to prevent auto-calc from overwriting with 0
            const overrideCheck = document.getElementById('overrideTotals');
            if (overrideCheck && !overrideCheck.checked) {
                overrideCheck.checked = true;
                if (window.toggleTotalsOverride) window.toggleTotalsOverride(true);
            }
        }
    }

    // External link
    if (data.external_link) {
        if (!state.currentLinks) state.currentLinks = [];
        // Check if we already have this link
        const exists = state.currentLinks.some(l => l.url === data.external_link);
        if (!exists) {
            // Strict naming based on media type for known sources
            let sourceName = 'External';

            if (data.source && data.source.toLowerCase() === 'tvmaze') {
                sourceName = 'TVMaze';
            } else if (data.source && data.source.toLowerCase() === 'anilist') {
                sourceName = 'AniList';
            } else if (data.source && data.source.toLowerCase() === 'tmdb') {
                sourceName = 'TMDB';
            } else if (data.source && data.source.toLowerCase() === 'openlibrary') {
                sourceName = 'Open Library';
            } else if (data.source && data.source.toLowerCase() === 'mangadex') {
                sourceName = 'MangaDex';
            } else if (data.source && data.source.toLowerCase() === 'jikan') {
                sourceName = 'MyAnimeList';
            } else if (data.source && data.source.toLowerCase() === 'googlebooks') {
                sourceName = 'Google Books';
            } else if (data.source && data.source.toLowerCase() === 'comicvine') {
                sourceName = 'Comic Vine';
            } else if (currentSearchType === 'Book') {
                sourceName = 'Open Library';
            } else if (currentSearchType === 'Anime' || currentSearchType === 'Manga') {
                sourceName = 'AniList';
            } else if (currentSearchType === 'Movie' || currentSearchType === 'Series') {
                sourceName = 'TMDB';
            } else if (data.source) {
                const key = data.source.toLowerCase();
                sourceName = data.source.charAt(0).toUpperCase() + data.source.slice(1);
            }

            state.currentLinks.push({
                label: sourceName,
                url: data.external_link
            });
            if (window.renderLinks) window.renderLinks();
        }
    }
}

/**
 * Toggles the visibility of the search input.
 */
export function toggleSearchInput() {
    const container = document.getElementById('externalSearchInputContainer');
    const arrow = document.getElementById('searchInputArrow');

    if (container) {
        if (container.classList.contains('hidden')) {
            container.classList.remove('hidden');
            if (arrow) arrow.classList.remove('rotate-180');
        } else {
            container.classList.add('hidden');
            if (arrow) arrow.classList.add('rotate-180');
        }
    }
}

// Expose functions to window for inline handlers
window.openExternalSearchModal = openExternalSearchModal;
window.closeExternalSearchModal = closeExternalSearchModal;
window.handleExternalSearchInput = handleExternalSearchInput;
window.selectExternalResult = selectExternalResult;
window.toggleSearchInput = toggleSearchInput;
window.performSecondarySearch = performSecondarySearch;
