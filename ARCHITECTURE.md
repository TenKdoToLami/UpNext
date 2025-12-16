# Architecture & Implementation Overview

## Application Overview

**UpNext** is a personal media library manager designed to track Anime, Manga, Books, Movies, and Series. It provides a clean, modern interface for users to organize their collections, track progress, and discover new content.

## Technology Stack

-   **Backend**: Python (Flask)
    -   **Modular Design**: Blueprints for routing, Service layer for logic.
    -   **Data**: JSON-based persistence for portability.
-   **Frontend**: HTML, CSS (Vanilla), JavaScript (Vanilla)
    -   **Design**: Glassmorphism aesthetic.
    -   **Icons**: Lucide Icons.
-   **Packaging**: PyInstaller
    -   **Cross-Platform**: Builds native executables for Linux and Windows.
-   **Tooling**:
    -   `pytest`, `black`, `isort` for quality assurance.

## System Architecture

```mermaid
graph TD
    User[User] -->|Interact| Frontend[Frontend (HTML/JS)]
    Frontend -->|HTTP Requests| Flask[Flask App]
    
    subgraph Backend Structure
        Flask -->|Register| Blueprints[Routes (app/routes/)]
        Blueprints -->|Invoke| Services[Services (app/services/)]
        Services -->|Configure| Config[Config (app/config.py)]
        Services -->|Persist| DataManager[Utils (app/utils/)]
        DataManager -->|Read/Write| JsonDB[(JSON Database)]
    end
    
    subgraph Frontend Components
        Frontend -->|Render| Templates[Jinja2 Templates]
        Frontend -->|Style| CSS[Static CSS]
        Frontend -->|Logic| JS[Static JS]
    end
```

## Directory Structure

The project follows a clean, modular structure:

-   **`manage.py`**: The unified entry point for all commands (`run`, `build`, `clean`).
-   **`app/`**: Core application source code.
    -   `routes/`: Flask Blueprints defining API endpoints.
    -   `services/`: Business logic and data manipulation.
    -   `utils/`: Helper functions (logging, data loading).
    -   `static/`: Assets (CSS, JS, images, icons).
    -   `templates/`: HTML Jinja2 templates.
-   **`scripts/`**: Helper scripts used by `manage.py`.
    -   `run.py`: Server startup logic.
    -   `build.py`: PyInstaller build process.
    -   `clean.py`: Cleanup utilities.
    -   `convert_icon.py`: Icon processing tools.
-   **`data/`**: User data storage (database, uploaded images).
-   **`UpNext.spec`**: PyInstaller build configuration (inside `scripts/`).

## Key Components

### Management Script (`manage.py`)
A single wrapper script that handles the entire development lifecycle:
-   **Smart Venv**: Automatically detects and uses the virtual environment.
-   **Run**: Launches the app and browser.
-   **Build**: Compiles the app to a standalone executable in the project root.
-   **Clean**: Removes build artifacts and temporary files.

### Data Persistence
Data is stored locally in `data/database.json`, making the application portable and easy to back up. Images are stored in `data/images/`.

### Build System
The build process is fully automated via `scripts/build.py`:
1.  **Icon Generation**: Converts SVGs to platform-specific formats (ICO/PNG).
2.  **Compilation**: Uses PyInstaller to bundle Python and dependencies.
3.  **Deployment**: Moves the final executable to the project root and cleans up intermediate `build/` files.
4.  **Integration**: On Linux, generates a `.desktop` entry for system integration.
