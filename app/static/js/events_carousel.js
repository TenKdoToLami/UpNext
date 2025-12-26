
/**
 * Fetches and renders the events carousel for a specific item.
 * @param {string} itemId - The ID of the item.
 * @param {HTMLElement} container - The container to render into.
 */
export async function loadItemEvents(itemId, container) {
    if (!container) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        // Fetch future releases for the next year
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const toDate = nextYear.toISOString().split('T')[0];

        const response = await fetch(`/api/releases?item_id=${itemId}&from=${today}&to=${toDate}`);
        if (!response.ok) return;

        const releases = await response.json();
        if (releases.length === 0) {
            container.classList.add('hidden'); // Hide if no events
            return;
        }

        renderCarousel(releases, container);
        container.classList.remove('hidden');

    } catch (e) {
        console.error("Error loading item events:", e);
        container.classList.add('hidden');
    }
}

/**
 * Renders the carousel UI.
 * @param {Array} releases - List of release objects
 * @param {HTMLElement} container - Container element
 */
function renderCarousel(releases, container) {
    // Structure with Theme Color support
    // Border uses theme color
    container.innerHTML = `
        <div class="bg-zinc-100 dark:bg-zinc-900/50 border border-[color:var(--theme-col)] rounded-xl p-4 relative group/carousel">
             <h4 class="text-xs font-bold text-[var(--theme-col)] uppercase tracking-widest mb-3 flex items-center gap-2">
                <i data-lucide="calendar" class="w-4 h-4"></i> Planned Events
             </h4>
             
             <div class="relative flex items-center justify-between">
                 <button id="carousel-prev" class="p-2 text-[var(--theme-col)] hover:brightness-125 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <i data-lucide="chevron-left" class="w-5 h-5"></i>
                 </button>
                 
                 <div class="flex-1 overflow-hidden">
                     <div id="carousel-track" class="flex transition-transform duration-300 ease-out">
                         ${releases.map(renderReleaseCard).join('')}
                     </div>
                 </div>

                 <button id="carousel-next" class="p-2 text-[var(--theme-col)] hover:brightness-125 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <i data-lucide="chevron-right" class="w-5 h-5"></i>
                 </button>
             </div>

             <div id="carousel-dots" class="flex justify-center gap-1.5 mt-3">
                 ${releases.map((_, i) => `<button type="button" data-index="${i}" class="w-1.5 h-1.5 rounded-full transition-all bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600"></button>`).join('')}
             </div>
        </div>
    `;

    // State
    let currentIndex = 0;
    const track = container.querySelector('#carousel-track');
    const prevBtn = container.querySelector('#carousel-prev');
    const nextBtn = container.querySelector('#carousel-next');
    const dots = container.querySelectorAll('#carousel-dots button');
    const total = releases.length;

    const updateView = () => {
        // Move track
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        // Update buttons
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === total - 1;

        // Update dots
        dots.forEach((d, i) => {
            if (i === currentIndex) {
                d.className = 'w-3 h-1.5 rounded-full transition-all bg-[var(--theme-col)] cursor-default';
            } else {
                d.className = 'w-1.5 h-1.5 rounded-full transition-all bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 cursor-pointer';
            }
        });
    };

    // Events
    prevBtn.onclick = () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateView();
        }
    };

    nextBtn.onclick = () => {
        if (currentIndex < total - 1) {
            currentIndex++;
            updateView();
        }
    };

    // Clickable Dots
    dots.forEach(dot => {
        dot.onclick = () => {
            const index = parseInt(dot.getAttribute('data-index'));
            currentIndex = index;
            updateView();
        };
    });

    // Init icons
    if (window.lucide) window.lucide.createIcons();

    // Initial state
    updateView();
}

/**
 * Renders a single release card HTML.
 * @param {Object} release - Release data
 * @returns {string} HTML string
 */
function renderReleaseCard(release) {
    const dateObj = new Date(release.date);
    // Full format date (e.g. "Monday, December 26")
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = release.time ? release.time : '';
    const isToday = new Date().toDateString() === dateObj.toDateString();

    return `
        <div class="min-w-full flex items-center gap-5 px-4 py-2">
            <div class="shrink-0 text-right w-1/3 border-r-2 border-[var(--theme-col)] pr-4 py-1">
                 <span class="block text-sm font-bold ${isToday ? 'text-[var(--theme-col)]' : 'text-zinc-900 dark:text-white'}">
                    ${isToday ? 'Today' : dateStr}
                 </span>
                 ${timeStr ? `<span class="block text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">${timeStr}</span>` : ''}
            </div>
            <div class="flex-1 text-left">
                <span class="text-base text-zinc-700 dark:text-zinc-300 font-bold leading-tight line-clamp-2">
                    ${release.content || 'New Release'}
                </span>
            </div>
        </div>
    `;
}
