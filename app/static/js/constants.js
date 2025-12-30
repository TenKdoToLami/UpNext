/**
 * @fileoverview Application constants and configuration.
 * Contains all static data like media types, status types, color maps, and export configurations.
 * @module constants
 */

// ============================================================================
// MEDIA & STATUS TYPES
// ============================================================================

/** Available media types */
export const MEDIA_TYPES = ['Anime', 'Manga', 'Book', 'Movie', 'Series'];

/** Available status types */
export const STATUS_TYPES = [
	'Planning',
	'Reading/Watching',
	'Dropped',
	'On Hold',
	'Anticipating',
	'Completed'
];

// ============================================================================
// DATE & TIME
// ============================================================================

export const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_SHORT = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// ============================================================================
// RATING CONFIGURATION
// ============================================================================

/** Rating labels by value (1-4 scale) */
export const RATING_LABELS = {
	1: 'Bad',
	2: 'Ok',
	3: 'Good',
	4: 'Masterpiece'
};

/** Rating background colors */
export const RATING_COLORS = {
	1: 'bg-red-500 shadow-red-500/30',
	2: 'bg-amber-500 shadow-amber-500/30',
	3: 'bg-blue-500 shadow-blue-500/30',
	4: 'bg-emerald-500 shadow-emerald-500/30'
};

/** Rating text colors */
export const TEXT_COLORS = {
	1: 'text-red-600 dark:text-red-500',
	2: 'text-amber-600 dark:text-amber-400',
	3: 'text-blue-600 dark:text-blue-400',
	4: 'text-emerald-600 dark:text-emerald-400'
};

/** Star icon fill colors for ratings */
export const STAR_FILLS = {
	1: 'fill-red-600 dark:fill-red-500 text-red-600 dark:text-red-500',
	2: 'fill-amber-600 dark:fill-amber-500 text-amber-600 dark:text-amber-500',
	3: 'fill-blue-500 dark:fill-blue-400 text-blue-500 dark:text-blue-400',
	4: 'fill-emerald-500 dark:fill-emerald-400 text-emerald-500 dark:text-emerald-400'
};

// ============================================================================
// ICON MAPPINGS
// ============================================================================

/** Lucide icon names for each media type */
export const ICON_MAP = {
	'Book': 'book',
	'Anime': 'tv',
	'Manga': 'file-text',
	'Movie': 'film',
	'Series': 'tv-2'
};

/** Lucide icon names for each status type */
export const STATUS_ICON_MAP = {
	'Planning': 'calendar',
	'Reading/Watching': 'play-circle',
	'Dropped': 'x-circle',
	'On Hold': 'pause-circle',
	'Anticipating': 'clock',
	'Completed': 'check-circle'
};

// ============================================================================
// COLOR MAPPINGS
// ============================================================================

/** Color classes for status badges */
export const STATUS_COLOR_MAP = {
	'Planning': 'text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/80',
	'Reading/Watching': 'text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-500/30 bg-sky-100 dark:bg-sky-500/10',
	'Dropped': 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30 bg-red-100 dark:bg-red-500/10',
	'On Hold': 'text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-500/30 bg-orange-100 dark:bg-orange-500/10',
	'Anticipating': 'text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-300 dark:border-fuchsia-500/30 bg-fuchsia-100 dark:bg-fuchsia-500/10',
	'Completed': 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/10'
};

/** Color classes for media type cards */
export const TYPE_COLOR_MAP = {
	'Anime': 'text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-500/30 bg-violet-100 dark:bg-violet-500/10 hover:bg-violet-200 dark:hover:bg-violet-500/20 ring-violet-500',
	'Manga': 'text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-500/30 bg-pink-100 dark:bg-pink-500/10 hover:bg-pink-200 dark:hover:bg-pink-500/20 ring-pink-500',
	'Book': 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/30 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 ring-blue-500',
	'Movie': 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30 bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 ring-red-500',
	'Series': 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-200 dark:hover:bg-amber-500/20 ring-amber-500'
};

// ============================================================================
// WIZARD CONFIGURATION
// ============================================================================

/** Wizard step titles */
export const STEP_TITLES = {
	1: 'Media Type',
	2: 'Status',
	3: 'Cover Image',
	4: 'Basic Information',
	5: 'Synopsis / Description',
	6: 'External Links',
	7: 'Current Progress',
	8: 'Review & Verdict',
	9: 'Personal Notes',
	10: 'Seasons / Volumes',
	11: 'Privacy Setting'
};

/** Suggested external links by media type */
export const LINK_SUGGESTIONS = {
	'Anime': ['My Anime List', 'Anilist', 'CSFD', 'Fandom'],
	'Manga': ['Mangadex', 'Anilist', 'Manga Updates', 'Fandom'],
	'Book': ['Goodreads', 'Amazon', 'Author', 'Fandom'],
	'Movie': ['IMDB', 'Rotten Tomatoes', 'CSFD', 'Fandom'],
	'Series': ['IMDB', 'Rotten Tomatoes', 'CSFD', 'Fandom']
};

// ============================================================================
// SORT CONFIGURATION
// ============================================================================

/** Available sort field options */
export const SORT_OPTIONS = [
	{ id: 'title', label: 'Title' },
	{ id: 'universe', label: 'Universe' },
	{ id: 'series', label: 'Series' },
	{ id: 'updatedAt', label: 'Date' }
];

// ============================================================================
// EXPORT CONFIGURATION
// ============================================================================

/** All available export fields with their configurations */
export const ALL_EXPORT_FIELDS = [
	{ id: 'coverUrl', label: 'Cover Image', default: false, backendField: 'coverUrl' },
	{ id: 'title', label: 'Title', default: true, backendField: 'title', mandatory: true },
	{ id: 'type', label: 'Media Type', default: true, backendField: 'type' },
	{ id: 'status', label: 'Status', default: true, backendField: 'status' },
	{ id: 'rating', label: 'Rating / Review', default: true, backendField: 'rating' },
	{ id: 'review', label: 'Review Text', default: false, backendField: 'review' },
	{ id: 'notes', label: 'Personal Notes', default: false, backendField: 'notes' },
	{ id: 'progress', label: 'Progress', default: false, backendField: 'progress' },
	{ id: 'description', label: 'Description (Synopsis)', default: false, backendField: 'description' },
	{ id: 'authors', label: 'Authors/Studios', default: true, backendField: 'authors' },
	{ id: 'alternateTitles', label: 'Alt. Titles', default: false, backendField: 'alternateTitles' },
	{ id: 'children', label: 'Seasons/Volumes', default: false, backendField: 'children' },
	{ id: 'series', label: 'Series / Collection', default: false, backendField: 'series' },
	{ id: 'universe', label: 'Universe', default: false, backendField: 'universe' },
	{ id: 'externalLinks', label: 'External Links', default: false, backendField: 'externalLinks' },
	{ id: 'isHidden', label: '"Hidden" Tag', default: false, backendField: 'isHidden', color: 'text-red-600 dark:text-red-400' }
];

/** Export format configurations */
export const EXPORT_CONFIG = {
	// Visual Export Formats
	'html_accordion': {
		label: 'Simple List',
		category: 'visual',
		mandatory: ['title'],
		defaultOn: ['title', 'type', 'status', 'rating', 'coverUrl'],
		excluded: [],
		icon: 'list-collapse'
	},
	'html_list': {
		label: 'Detailed List',
		category: 'visual',
		mandatory: ['title', 'coverUrl'],
		defaultOn: ['title', 'coverUrl', 'type', 'status', 'rating', 'authors', 'description'],
		excluded: [],
		icon: 'layout-list'
	},
	'html_card': {
		label: 'Card Grid',
		category: 'visual',
		mandatory: ['coverUrl', 'title', 'type', 'status'],
		defaultOn: ['coverUrl', 'title', 'type', 'status', 'rating'],
		excluded: ['description', 'notes', 'review', 'alternateTitles', 'externalLinks'],
		icon: 'layout-grid'
	},
	// Raw Data Formats
	'json_raw': {
		label: 'JSON',
		category: 'raw',
		mandatory: [],
		defaultOn: [],
		excluded: [],
		icon: 'file-json'
	},
	'csv': {
		label: 'CSV',
		category: 'raw',
		mandatory: [],
		defaultOn: [],
		excluded: ['children', 'externalLinks'],
		icon: 'file-spreadsheet'
	},
	'xml': {
		label: 'XML',
		category: 'raw',
		mandatory: [],
		defaultOn: [],
		excluded: [],
		icon: 'file-code'
	}
};

/** Fields allowed in card view mode */
export const CARD_VIEW_ALLOWED_FIELDS = [
	'coverUrl',
	'type',
	'status',
	'progress',
	'series',
	'universe',
	'rating'
];

// ============================================================================
// SETTINGS CONFIGURATION
// ============================================================================

/**
 * Feature groups configuration for settings modal.
 * Defines structure, icons, and fields.
 */
export const FEATURE_GROUPS = [
	{
		id: 'metadata',
		label: 'Detailed Metadata',
		desc: 'Extended information fields and organization details.',
		icon: 'list',
		color: 'emerald',
		fields: [
			{ id: 'authors', label: 'Authors/Studios', desc: 'Creators or production studios' },
			{ id: 'series', label: 'Series Info', desc: 'Series name and position' },
			{ id: 'series_number', label: 'Series Number', desc: 'Volume/Season number in a series' },
			{ id: 'universe', label: 'Universe', desc: 'Shared universe or franchise' },
			{ id: 'alternate_titles', label: 'Alternate Titles', desc: 'Native or alias titles' },
			{ id: 'external_links', label: 'External Links', desc: 'Links to tracking sites or stores' },
			{ id: 'abbreviations', label: 'Abbreviations', desc: 'Short codes for quick search' }
		]
	},
	{
		id: 'tracking',
		label: 'Library Tracking',
		desc: 'Core progress and status tracking features.',
		icon: 'activity',
		color: 'blue',
		fields: [
			{ id: 'progress', label: 'Progress/Status', desc: 'Current episode/chapter progress and status' },
			{ id: 'reread_count', label: 'Reread Count', desc: 'Track number of times read/watched' },
			{ id: 'length', label: 'Length/Duration', desc: 'Page count, episode count, or duration' },
			{ id: 'avg_episode_length', label: 'Avg Episode Length', desc: 'Average duration per episode' }
		]
	},
	{
		id: 'reviews',
		label: 'Reviews & Ratings',
		desc: 'Personal thoughts, scoring, and critiques.',
		icon: 'star',
		color: 'amber',
		fields: [
			{ id: 'rating', label: 'Rating Score', desc: 'Numerical/Star rating of the entry' },
			{ id: 'review', label: 'Review Text', desc: 'Written review body/essay' },
			{ id: 'verdict', label: 'Verdict Badge', desc: 'Visual label (e.g. Masterpiece) on cards' }
		]
	},
	{
		id: 'calendar',
		label: 'Release Calendar',
		desc: 'Track upcoming season premieres and volume releases.',
		icon: 'calendar',
		color: 'fuchsia',
		fields: [
			{ id: 'calendar_upcoming', label: 'Upcoming Events', desc: 'Show upcoming releases in detail view' },
			{ id: 'calendar_month', label: 'Monthly View', desc: 'Show visual calendar availability' },
			{ id: 'calendar_notifications', label: 'Missed Release Alerts', desc: 'Notify for past releases not yet seen' }
		]
	},
	{
		id: 'stats',
		label: 'Statistics Graphs',
		desc: 'Visual breakdown of types, statuses, and ratings.',
		icon: 'pie-chart',
		color: 'indigo',
		fields: []
	},
	{
		id: 'general',
		label: 'General Interface',
		desc: 'Miscellaneous UI elements.',
		icon: 'layout',
		color: 'zinc',
		fields: [
			{ id: 'notes', label: 'Private Notes', desc: 'Your personal notes and thoughts' }
		]
	}
];
