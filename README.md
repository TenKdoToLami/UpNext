# UpNext - Personal Media Tracker

UpNext is a beautiful, local web application designed to help you track your media consumption (Anime, Manga, Books, Movies, Series). It features a modern, glassmorphism-inspired interface, rich metadata tracking, and a powerful rating system.

## ✨ Features

-   **Multi-Type Tracking**: Seamlessly manage Anime, Manga, Books, Movies, and Series in one place.
-   **Status Workflow**: Track progress from Planning -> Watching/Reading -> Completed (or Dropped).
-   **Rich Metadata**: Store authors, studios, alternative titles, series ordering, and universes (e.g., MCU).
-   **Privacy & Review**: Mark items as "Hidden" and add personal reviews with a 4-point rating system.
-   **Modern UI**: Responsive design with dark mode, grid/list views, and vibrant aesthetics.
-   **Portable**: Runs locally with a portable SQLite database (`data/library.db`)—your data stays yours.
-   **Export**: Export your library to JSON or HTML cards/lists.

## 🚀 Getting Started

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/TenKdoToLami/UpNext.git
    cd UpNext
    ```

2.  **Install Dependencies**:
    Ensure you have Python 3.8+ installed.
    ```bash
    pip install -r requirements.txt
    ```

### Usage

We provide a unified management script, `manage.py`, to handle all tasks.

**1. Run the Application**
Start the local server and open the app in your browser:
```bash
python3 manage.py run
```

**2. Build Executable (Standalone)**
Create a native application (`UpNext` or `UpNext.exe`) in the project root:
```bash
python3 manage.py build
```
*Successfully built apps include high-res icons and can be moved anywhere on your system.*

**3. Clean Project**
Remove temporary build files and caches:
```bash
python3 manage.py clean
```

## 🛠️ Development

### Project Structure
-   **`manage.py`**: The main entry point for running and building the project.
-   **`app/`**: Core application code (Flask blueprints, services, models, UI assets).
-   **`data/`**: User data storage (library.db, images).
-   **`scripts/`**: Helper scripts for build/run/clean automation.

### Setting Up Dev Environment
1.  **Create a Virtual Environment**:
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate  # Windows: .venv\Scripts\activate
    ```
2.  **Install Dev Dependencies**:
    ```bash
    pip install pytest black isort
    ```
3.  **Run Tests**:
    ```bash
    pytest
    ```

## 📄 License
[MIT License](LICENSE)
