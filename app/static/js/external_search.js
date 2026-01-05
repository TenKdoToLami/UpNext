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


// Source icons and colors
const SOURCE_CONFIG = {
    anilist: { name: 'AniList', icon: 'sparkles', color: 'text-blue-400' },
    tmdb: { name: 'TMDB', icon: 'film', color: 'text-green-400' },
    openlibrary: { name: 'Open Library', icon: 'book-open', color: 'text-amber-400' }
};

// Debounce timer
let searchDebounceTimer = null;

// Current search state
let currentSearchType = '';
let currentResults = [];

/**
 * Opens the external search modal.
 * @param {string} mediaType - The media type to search for (Anime, Manga, Book, Movie, Series)
 */
export function openExternalSearchModal(mediaType) {
    // Clear fields from Basic Info onwards before starting a new search
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

    // Reset state
    if (typeDisplay) typeDisplay.textContent = mediaType;
    if (input) input.value = '';
    if (resultsContainer) resultsContainer.innerHTML = renderEmptyState();

    // Show modal
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');

    // Focus input
    setTimeout(() => input?.focus(), 100);

    safeCreateIcons();
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
				<div class="p-4 border-b border-zinc-800">
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
				
				<!-- Results -->
				<div id="externalSearchResults" class="max-h-[400px] overflow-y-auto custom-scrollbar p-4">
					${renderEmptyState()}
				</div>
				
				<!-- Footer -->
				<div class="p-3 border-t border-zinc-800 bg-zinc-900/50">
					<p class="text-xs text-zinc-500 text-center">
						Powered by <span class="text-blue-400">AniList</span>, <span class="text-green-400">TMDB</span>, and <span class="text-amber-400">Open Library</span>
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
            resultsContainer.innerHTML = renderNoResults(query);
        } else {
            resultsContainer.innerHTML = renderResults(currentResults);
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
function renderResults(results) {
    return `
		<div class="space-y-2">
			${results.map((item, index) => renderResultCard(item, index)).join('')}
		</div>
	`;
}

/**
 * Renders a single result card.
 */
function renderResultCard(item, index) {
    const sourceConfig = SOURCE_CONFIG[item.source] || { name: item.source, icon: 'globe', color: 'text-zinc-400' };
    const coverUrl = item.cover_url || '';
    const year = item.year || '';
    const descPreview = item.description_preview || '';

    return `
		<button 
			onclick="window.selectExternalResult(${index})"
			class="w-full flex gap-4 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 rounded-xl transition-all text-left group"
		>
			<!-- Cover Image -->
			<div class="w-16 h-24 rounded-lg overflow-hidden bg-zinc-700 flex-shrink-0">
				${coverUrl
            ? `<img src="${coverUrl}" alt="${item.title}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center w-full h-full\\'><i data-lucide=\\'image-off\\' class=\\'w-6 h-6 text-zinc-600\\'></i></div>'">`
            : `<div class="flex items-center justify-center w-full h-full"><i data-lucide="image" class="w-6 h-6 text-zinc-600"></i></div>`
        }
			</div>
			
			<!-- Info -->
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-2">
					<h4 class="font-semibold text-white truncate group-hover:text-indigo-400 transition-colors">${item.title}</h4>
					<span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-700/50 text-xs ${sourceConfig.color} flex-shrink-0">
						<i data-lucide="${sourceConfig.icon}" class="w-3 h-3"></i>
						${sourceConfig.name}
					</span>
				</div>
				
				${year ? `<p class="text-zinc-400 text-sm mt-0.5">${year}</p>` : ''}
				
				${descPreview ? `<p class="text-zinc-500 text-xs mt-1 line-clamp-2">${descPreview}</p>` : ''}
				
				<!-- Additional metadata -->
				<div class="flex items-center gap-3 mt-2 text-xs text-zinc-500">
					${item.episodes ? `<span class="flex items-center gap-1"><i data-lucide="play" class="w-3 h-3"></i>${item.episodes} eps</span>` : ''}
					${item.chapters ? `<span class="flex items-center gap-1"><i data-lucide="book-open" class="w-3 h-3"></i>${item.chapters} ch</span>` : ''}
					${item.volumes ? `<span class="flex items-center gap-1"><i data-lucide="layers" class="w-3 h-3"></i>${item.volumes} vols</span>` : ''}
					${item.page_count ? `<span class="flex items-center gap-1"><i data-lucide="file-text" class="w-3 h-3"></i>${item.page_count} pages</span>` : ''}
				</div>
			</div>
			
			<!-- Select indicator -->
			<div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
				<i data-lucide="chevron-right" class="w-5 h-5 text-indigo-400"></i>
			</div>
		</button>
	`;
}

/**
 * Selects an external search result and imports its data.
 * @param {number} index - Index of the result in currentResults
 */
export async function selectExternalResult(index) {
    const item = currentResults[index];
    if (!item) return;

    showToast('Fetching full details...', 'info');

    try {
        const response = await fetch(
            `/api/external/details?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(currentSearchType)}&source=${encodeURIComponent(item.source)}`
        );
        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || 'Failed to fetch details', 'error');
            return;
        }

        const details = data.item;

        // Close modal
        closeExternalSearchModal();

        // Import to wizard
        prefillWizardFromExternal(details);

        showToast(`Imported "${details.title}" from ${SOURCE_CONFIG[item.source]?.name || item.source}`, 'success');

    } catch (error) {
        console.error('Failed to fetch details:', error);
        showToast('Failed to fetch item details', 'error');
    }
}

/**
 * Prefills wizard fields from external API data.
 * @param {Object} data - Normalized item data from external API
 */
function prefillWizardFromExternal(data) {
    // Title
    const titleInput = document.getElementById('title');
    if (titleInput && data.title) {
        titleInput.value = data.title;
    }

    // Description - Clean up HTML tags from API responses
    const descInput = document.getElementById('description');
    if (descInput && data.description) {
        let cleanDesc = data.description
            .replace(/<br\s*\/?>/gi, '\n')  // Replace <br> with newlines
            .replace(/<\/?i>/gi, '')         // Remove <i> tags
            .replace(/<\/?em>/gi, '')        // Remove <em> tags
            .replace(/<\/?b>/gi, '')         // Remove <b> tags
            .replace(/<\/?strong>/gi, '')   // Remove <strong> tags
            .replace(/<[^>]+>/g, '')         // Remove any remaining HTML tags
            .trim();
        descInput.value = cleanDesc;
    }

    // Cover URL - Load into the wizard's cover preview
    if (data.cover_url) {
        const previewImg = document.getElementById('previewImg');
        const placeholder = document.getElementById('previewPlaceholder');

        if (previewImg) {
            previewImg.src = data.cover_url;
            previewImg.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');

            // Store URL for later use (e.g., when saving)
            previewImg.dataset.externalUrl = data.cover_url;
        }
    }

    // Authors
    if (data.authors && data.authors.length > 0) {
        // Import into state.currentAuthors
        if (!state.currentAuthors) state.currentAuthors = [];
        data.authors.forEach(author => {
            if (!state.currentAuthors.includes(author)) {
                state.currentAuthors.push(author);
            }
        });
        // Trigger re-render if function exists
        if (window.updateModalTags) {
            window.updateModalTags();
            safeCreateIcons();
        }
    }

    // Studios (for Anime, add to authors)
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

    // Alternate titles
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

    // Tags
    if (data.tags && data.tags.length > 0) {
        if (!state.currentTags) state.currentTags = [];
        data.tags.forEach(tag => {
            // Check if tag exists, if not save it
            if (!state.allTags[tag]) {
                const color = getRandomPastelHex();
                // Optimistically update state
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

    // Genres as tags
    if (data.genres && data.genres.length > 0) {
        if (!state.currentTags) state.currentTags = [];
        data.genres.slice(0, 5).forEach(genre => {
            // Check if tag exists, if not save it
            if (!state.allTags[genre]) {
                const color = getRandomPastelHex();
                // Optimistically update state
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

    // Release date
    const releaseDateInput = document.getElementById('releaseDate');
    if (releaseDateInput && data.release_date) {
        releaseDateInput.value = data.release_date;
    }

    // Technical stats
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

    // Auto-populate Season 1 for Anime/Series
    if (['Anime', 'Series'].includes(currentSearchType) && (data.episodes || data.avg_duration_minutes)) {
        if (!state.currentChildren) state.currentChildren = [];

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

            if (currentSearchType === 'Book' || (data.source && data.source.toLowerCase() === 'openlibrary')) {
                sourceName = 'Open Library';
            } else if (currentSearchType === 'Anime' || currentSearchType === 'Manga') {
                sourceName = 'AniList'; // Validated casing
            } else if (currentSearchType === 'Movie' || currentSearchType === 'Series') {
                sourceName = 'TMDB';
            } else if (data.source) {
                // Fallback to data source only if not one of the above types
                const key = data.source.toLowerCase();
                if (SOURCE_CONFIG[key]) {
                    sourceName = SOURCE_CONFIG[key].name;
                } else if (key === 'openlibrary') {
                    sourceName = 'Open Library';
                } else {
                    sourceName = data.source.charAt(0).toUpperCase() + data.source.slice(1);
                }
            }

            state.currentLinks.push({
                label: sourceName,
                url: data.external_link
            });
            if (window.renderLinks) window.renderLinks();
        }
    }
}

// Expose functions to window for inline handlers
window.openExternalSearchModal = openExternalSearchModal;
window.closeExternalSearchModal = closeExternalSearchModal;
window.handleExternalSearchInput = handleExternalSearchInput;
window.selectExternalResult = selectExternalResult;
