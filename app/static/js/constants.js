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
	3: 'Basic Information',
	4: 'Cover Image',
	5: 'Synopsis / Description',
	6: 'External Links',
	7: 'Current Progress',
	8: 'Review & Verdict',
	9: 'Personal Notes',
	10: 'Seasons / Volumes',
	11: 'Privacy Setting',
	12: 'Calendar Event'
};

/** Suggested external links by media type */
export const LINK_SUGGESTIONS = {
	'Anime': ['My Anime List', 'Anilist', 'CSFD', 'Fandom'],
	'Manga': ['Mangadex', 'Anilist', 'Manga Updates', 'Fandom'],
	'Book': ['Goodreads', 'Amazon', 'OpenLibrary', 'Author', 'Fandom'],
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
	{ id: 'seriesNumber', label: 'Series Number', default: false, backendField: 'seriesNumber' },
	{ id: 'universe', label: 'Universe', default: false, backendField: 'universe' },
	{ id: 'releaseDate', label: 'Release Date', default: false, backendField: 'releaseDate' },
	{ id: 'tags', label: 'Tags', default: false, backendField: 'tags' },
	{ id: 'abbreviations', label: 'Abbreviations', default: false, backendField: 'abbreviations' },
	{ id: 'episodeCount', label: 'Episode Count', default: false, backendField: 'episodeCount' },
	{ id: 'chapterCount', label: 'Chapter Count', default: false, backendField: 'chapterCount' },
	{ id: 'volumeCount', label: 'Volume Count', default: false, backendField: 'volumeCount' },
	{ id: 'pageCount', label: 'Page Count', default: false, backendField: 'pageCount' },
	{ id: 'wordCount', label: 'Word Count', default: false, backendField: 'wordCount' },
	{ id: 'avgDurationMinutes', label: 'Avg Duration', default: false, backendField: 'avgDurationMinutes' },
	{ id: 'completedAt', label: 'Completed Date', default: false, backendField: 'completedAt' },
	{ id: 'rereadCount', label: 'Reread Count', default: false, backendField: 'rereadCount' },
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
		defaultOn: [
			'title', 'type', 'status', 'rating', 'coverUrl', 'progress',
			'authors', 'description', 'children',
			'episodeCount', 'chapterCount', 'volumeCount', 'pageCount'
		],
		excluded: ['isHidden'],
		icon: 'list-collapse'
	},
	'html_list': {
		label: 'Detailed List',
		category: 'visual',
		mandatory: ['title', 'coverUrl'],
		defaultOn: [
			'title', 'coverUrl', 'type', 'status', 'rating', 'authors',
			'description', 'tags', 'children',
			'episodeCount', 'chapterCount', 'volumeCount', 'pageCount'
		],
		excluded: ['isHidden'],
		icon: 'layout-list'
	},
	'html_card': {
		label: 'Card Grid',
		category: 'visual',
		mandatory: ['coverUrl', 'title', 'type', 'status'],
		defaultOn: ['coverUrl', 'title', 'type', 'status', 'rating'],
		excluded: [
			// Card view is compact - most fields don't fit
			'description', 'notes', 'review', 'alternateTitles', 'externalLinks',
			'children', 'abbreviations', 'episodeCount', 'chapterCount',
			'volumeCount', 'pageCount', 'wordCount', 'avgDurationMinutes',
			'rereadCount', 'completedAt', 'releaseDate', 'tags', 'isHidden'
		],
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
	},
	'db': {
		label: 'SQLite',
		category: 'raw',
		mandatory: [],
		defaultOn: [],
		excluded: [],
		icon: 'database'
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
 * Defines structure, icons, fields, and locked status.
 * Fields marked `locked: true` cannot be disabled.
 * Fields marked `defaultHidden: true` are hidden by default on first use.
 * The `affects` array shows which UI components are impacted by each field.
 */
export const FEATURE_GROUPS = [
	{
		id: 'core_assets',
		label: 'What You\'re Tracking',
		desc: 'The basics: what is this thing? These fields identify each entry in your library.',
		icon: 'fingerprint',
		color: 'fuchsia',
		fields: [
			{ id: 'title', label: 'Title', desc: 'The name of the anime, book, movie, etc.', locked: true, affects: ['Wizard', 'Edit', 'Details', 'Cards'] },
			{ id: 'cover_image', label: 'Cover Image', desc: 'The poster/cover art that shows in your library', locked: true, affects: ['Wizard', 'Edit', 'Details', 'Cards'] },
			{ id: 'description', label: 'Description', desc: 'A summary or synopsis of the content', affects: ['Wizard', 'Edit', 'Details'] }
		]
	},
	{
		id: 'categorization',
		label: 'Organization',
		desc: 'How do you want to organize and find things? Tags help you filter and search.',
		icon: 'tag',
		color: 'cyan',
		fields: [
			{ id: 'tags', label: 'Tags', desc: 'Add labels like "Action", "Favorite", "Summer 2024" to group entries', affects: ['Wizard', 'Edit', 'Details', 'Filter'] },
			{ id: 'authors', label: 'Authors/Studios', desc: 'Track who made it (author, studio, director)', affects: ['Wizard', 'Edit', 'Details', 'Cards'] },
			{ id: 'universe', label: 'Universe', desc: 'Group entries in the same fictional world (MCU, Cosmere, etc.)', affects: ['Wizard', 'Edit', 'Details'] }
		]
	},
	{
		id: 'tracking',
		label: 'Your Progress',
		desc: 'Keep track of where you are. Never lose your place again!',
		icon: 'activity',
		color: 'blue',
		fields: [
			{ id: 'progress', label: 'Current Progress', desc: 'Which episode/chapter are you on?', affects: ['Wizard', 'Edit', 'Details', 'Cards'] },
			{ id: 'reread_count', label: 'Reread Count', desc: 'How many times have you re-watched/re-read this?', defaultHidden: true, affects: ['Wizard', 'Edit', 'Details'] },
			{ id: 'completed_at', label: 'Completion Date', desc: 'When did you finish it?', defaultHidden: true, affects: ['Wizard', 'Edit', 'Details'] }
		]
	},
	{
		id: 'reviews',
		label: 'Your Opinions',
		desc: 'Rate it, review it, remember what you thought. Your personal judgments.',
		icon: 'star',
		color: 'amber',
		fields: [
			{ id: 'rating', label: 'Rating', desc: 'Give it a star rating (1-4 stars)', affects: ['Wizard', 'Edit', 'Details', 'Cards'] },
			{ id: 'review', label: 'Review', desc: 'Write down your thoughts and opinions', affects: ['Wizard', 'Edit', 'Details'] },
			{ id: 'verdict', label: 'Verdict Badge', desc: 'Show a label like "Masterpiece" on library cards', defaultHidden: true, affects: ['Cards'] }
		]
	},
	{
		id: 'series_info',
		label: 'Seasons & Volumes',
		desc: 'Break down longer content. Track individual seasons of a show or volumes of a book series.',
		icon: 'layers',
		color: 'teal',
		fields: [
			{ id: 'series', label: 'Series Info', desc: 'Is this part of a larger series? (Book 1 of 5, etc.)', affects: ['Wizard', 'Edit', 'Details', 'Cards'] },
			{ id: 'series_number', label: 'Breakdown', desc: 'Add individual seasons/volumes with their own ratings', affects: ['Wizard', 'Edit', 'Details'] }
		]
	},
	{
		id: 'metadata',
		label: 'Extra Details',
		desc: 'Optional extra information. Nice to have but not essential.',
		icon: 'list',
		color: 'emerald',
		fields: [
			{ id: 'alternate_titles', label: 'Alternate Titles', desc: 'Other names (Japanese title, English title, etc.)', defaultHidden: true, affects: ['Wizard', 'Edit', 'Details'] },
			{ id: 'abbreviations', label: 'Abbreviations', desc: 'Short codes for quick search (AOT, FMAB)', defaultHidden: true, affects: ['Wizard', 'Edit', 'Search'] },
			{ id: 'release_date', label: 'Release Date', desc: 'When was this first released?', affects: ['Wizard', 'Edit', 'Details'] },
			{ id: 'technical_stats', label: 'Technical Stats', desc: 'Episode counts, page counts, durations', defaultHidden: true, affects: ['Wizard', 'Edit', 'Details'] },
			{ id: 'external_links', label: 'External Links', desc: 'Links to MAL, IMDB, Amazon, etc.', affects: ['Wizard', 'Edit', 'Details'] }
		]
	},
	{
		id: 'personal',
		label: 'Personal Notes',
		desc: 'Your private space. Only you see these.',
		icon: 'file-text',
		color: 'zinc',
		fields: [
			{ id: 'notes', label: 'Notes', desc: 'Jot down anything you want to remember', affects: ['Wizard', 'Edit', 'Details'] }
		]
	},
	{
		id: 'calendar',
		label: 'Release Calendar',
		desc: 'Coming soon! Track when new episodes/volumes release.',
		icon: 'calendar',
		color: 'violet',
		fields: [
			{ id: 'calendar_upcoming', label: 'Upcoming Releases', desc: 'See what\'s coming out soon', affects: ['Details'] },
			{ id: 'calendar_month', label: 'Calendar View', desc: 'Visual monthly calendar of releases', affects: ['Calendar'] },
			{ id: 'calendar_notifications', label: 'Notifications', desc: 'Get alerts for new releases', affects: ['System'] }
		]
	},
	{
		id: 'stats',
		label: 'Statistics',
		desc: 'See analytics about your library. How much have you watched/read?',
		icon: 'pie-chart',
		color: 'indigo',
		fields: []
	}
];

