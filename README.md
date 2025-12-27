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

-   **Python 3.11** (Recommended):
    -   **Windows (CMD/PowerShell)**: `winget install Python.Python.3.11`
    -   **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install python3.11 python3.11-venv`
    -   **Linux (Fedora)**: `sudo dnf install python3.11`
-   **Dependencies**: Listed in `requirements.txt` (installed during setup).

### Development Environment Setup
Running from source requires a configured virtual environment. Follow the steps for your operating system:

#### 🖥️ Windows
1.  **Clone & Enter**:
    ```powershell
    git clone https://github.com/TenKdoToLami/UpNext.git
    cd UpNext
    ```
2.  **Initialize Environment**:
    ```powershell
    python -m venv .venv
    .\.venv\Scripts\activate
    pip install -r requirements.txt
    ```
3.  **Run**:
    ```powershell
    python manage.py run
    ```

#### 🐧 Linux
1.  **Clone & Enter**:
    ```bash
    git clone https://github.com/TenKdoToLami/UpNext.git
    cd UpNext
    ```
2.  **Initialize Environment**:
    ```bash
    python3.11 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```
3.  **Run**:
    ```bash
    python3.11 manage.py run
    ```

### Standalone Usage
If you do not wish to set up a Python environment, you can build a standalone executable:
```bash
# Activation required before building
python manage.py build
```
The resulting `UpNext.exe` (Windows) or `UpNext` (Linux) can be moved and run anywhere without Python installed.

## 🛠️ Project Management
Available commands via `manage.py`:
-   `run`: Launch development server and GUI.
-   `build`: Compile into standalone binary.
-   `clean`: Wipe build files and Python cache.

## 📄 License
[MIT License](LICENSE)
