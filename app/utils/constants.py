"""
Constants and Configuration mappings for the UpNext application.

Defines valid media types, status categories, and UI color schemes.
"""

# --- Schema and Validation Constants ---
MEDIA_TYPES = ['Anime', 'Manga', 'Book', 'Movie', 'Series']
STATUS_TYPES = ['Planning', 'Reading/Watching', 'Dropped', 'On Hold', 'Anticipating', 'Completed']

RATING_MAP = {1: "BAD", 2: "OK", 3: "GOOD", 4: "MASTERPIECE"}

# --- UI Aesthetic Mappings ---
# These hex codes are used for visual indicators in the frontend and exports.
# They are kept in sync with the CSS variable definitions in style.css.

MEDIA_COLOR_MAP = {
    'Anime': '#8b5cf6',   # Violet
    'Manga': '#ec4899',   # Pink
    'Book': '#3b82f6',    # Blue
    'Movie': '#ef4444',   # Red
    'Series': '#f59e0b'   # Amber
}

# --- Export Styles (Light Mode) ---
# Used for generated documents (PDF/HTML exports) to ensure readability on white backgrounds.
STATUS_BG_MAP = {
    'Planning': '#f4f4f5',
    'Reading/Watching': '#e0f2fe',
    'Dropped': '#fee2e2',
    'On Hold': '#ffedd5',
    'Anticipating': '#fae8ff',
    'Completed': '#d1fae5'
}

STATUS_TEXT_MAP = {
    'Planning': '#52525b',
    'Reading/Watching': '#0284c7',
    'Dropped': '#b91c1c',
    'On Hold': '#c2410c',
    'Anticipating': '#9333ea',
    'Completed': '#059669'
}
