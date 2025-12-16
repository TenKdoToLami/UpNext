"""
Constants and Configuration mappings for the UpNext application.
"""

# Centralized Constants for UpNext

# --- Definitions ---
MEDIA_TYPES = ['Anime', 'Manga', 'Book', 'Movie', 'Series']
STATUS_TYPES = ['Planning', 'Reading/Watching', 'Dropped', 'On Hold', 'Anticipating', 'Completed']

RATING_MAP = {1: "BAD", 2: "OK", 3: "GOOD", 4: "MASTERPIECE"}

# --- Color mappings (Consistent with style.css & Tailwind) ---
# Note: These hex codes match the CSS variables defined in static/css/style.css
# --col-anime: #8b5cf6 (Violet-500)
# --col-manga: #ec4899 (Pink-500)
# --col-book: #3b82f6 (Blue-500)
# --col-movie: #ef4444 (Red-500)
# --col-series: #f59e0b (Amber-500)

MEDIA_COLOR_MAP = {
    'Anime': '#8b5cf6',
    'Manga': '#ec4899',
    'Book': '#3b82f6',
    'Movie': '#ef4444',
    'Series': '#f59e0b'
}

# Values for Light Mode Exports (White Background)
# These differ from the App's Dark Mode to ensure readability on white paper/screen.
STATUS_BG_MAP = {
    'Planning': '#f4f4f5',        # Zinc-100
    'Reading/Watching': '#e0f2fe', # Sky-100
    'Dropped': '#fee2e2',         # Red-100
    'On Hold': '#ffedd5',         # Orange-100
    'Anticipating': '#fae8ff',    # Fuchsia-100
    'Completed': '#d1fae5'        # Emerald-100
}

STATUS_TEXT_MAP = {
    'Planning': '#52525b',        # Zinc-600
    'Reading/Watching': '#0284c7', # Sky-600
    'Dropped': '#b91c1c',         # Red-700
    'On Hold': '#c2410c',         # Orange-700
    'Anticipating': '#9333ea',    # Fuchsia-600
    'Completed': '#059669'        # Emerald-600
}
