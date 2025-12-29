# UpNext - Personal Media Tracker

Local web application for tracking media consumption (Anime, Manga, Books, Movies, Series). Glassmorphism interface, metadata tracking, and rating system.

## ✨ Features

-   **Multi-Type Tracking**: Seamlessly manage Anime, Manga, Books, Movies, and Series in one place.
-   **Status Workflow**: Track progress from Planning -> Watching/Reading -> Completed (or Dropped).
-   **Rich Metadata**: Store authors, studios, alternative titles, series ordering, and universes (e.g., MCU).
-   **Privacy & Review**: Mark items as "Hidden" and add personal reviews with a 4-point rating system.
-   **Modern UI**: Responsive design with dark mode, grid/list views, and vibrant aesthetics.
-   **Advanced Tracking**: Store `release_date`, `completed_at`, and `reread_count` for personal statistics.
-   **Normalized Database**: 5-table SQLite architecture (`data/library.db`) for high-performance offline storage.
-   **Export**: Generate JSON, CSV, XML, or HTML cards/lists.
-   **Release Calendar**: Plan future consumption with a dedicated view and overdue notifications.
-   **Multi-Database Support**: Switch between specialized libraries or maintain a private archive.
-   **Library Statistics**: Visualize habits with dynamic charts (Distribution, Status, Ratings, Growth).

## 🚀 Getting Started

### Prerequisites

-   **Python 3.11+** (Python 3.12 also works)
-   **Dependencies**: Listed in `requirements.txt` (installed during setup).

### Development Environment Setup

#### 🖥️ Windows
1.  **Install Python**:
    ```powershell
    winget install Python.Python.3.11
    ```
2.  **Clone & Enter**:
    ```powershell
    git clone https://github.com/TenKdoToLami/UpNext.git
    cd UpNext
    ```
3.  **Initialize Environment**:
    ```powershell
    python -m venv .venv
    .\.venv\Scripts\activate
    pip install -r requirements.txt
    ```
4.  **Run**:
    ```powershell
    python manage.py run
    ```

#### 🐧 Linux (Ubuntu/Debian/Pop!_OS)
1.  **Install Python 3.11** (if not available in default repos):
    ```bash
    sudo add-apt-repository ppa:deadsnakes/ppa
    sudo apt update
    sudo apt install python3.11 python3.11-venv python3.11-dev
    ```
    *Note: On Ubuntu 24.04+, you may also use the system Python 3.12.*

2.  **Install System Dependencies** (required for pywebview):
    ```bash
    sudo apt install libgirepository1.0-dev libcairo2-dev pkg-config gir1.2-webkit2-4.1
    ```

3.  **Clone & Enter**:
    ```bash
    git clone https://github.com/TenKdoToLami/UpNext.git
    cd UpNext
    ```

4.  **Initialize Environment**:
    ```bash
    python3.11 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```

5.  **Run**:
    ```bash
    python manage.py run
    ```

#### 🐧 Linux (Fedora)
1.  **Install Python & Dependencies**:
    ```bash
    sudo dnf install python3.11 python3.11-devel gobject-introspection-devel cairo-devel webkit2gtk4.1
    ```
2.  Follow steps 3-5 from Ubuntu instructions above.

### Building Standalone Executable
To create a standalone executable that doesn't require Python installed:
```bash
# Activate virtual environment first
source .venv/bin/activate  # Linux
# or
.\.venv\Scripts\activate   # Windows

# Build
python manage.py build
```
The resulting `UpNext.exe` (Windows) or `UpNext` (Linux) binary will be in the `dist/` folder.

## 🛠️ Project Management
Available commands via `manage.py`:
-   `run`: Launch development server and GUI.
-   `build`: Compile into standalone binary.
-   `clean`: Wipe build files and Python cache.

## 📄 License
[MIT License](LICENSE)
