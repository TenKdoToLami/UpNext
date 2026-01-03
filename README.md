# UpNext - Personal Media Tracker

**UpNext** is a sophisticated, local-first web application designed for tracking your personal media consumption. Whether it's Anime, Manga, Novels, Movies, or Series, UpNext provides a beautifully crafted glassmorphism interface to organize your collections, track your progress, and visualize your habits.

---

## ✨ Features

-   **Multi-Type Tracking**: Deep support for Anime, Manga, Books, Movies, and Series with metadata tailored to each medium.
-   **Modern Wizard Entry**: A dynamic 12-step wizard that adapts its questions based on the media type and status you select.
-   **Status Workflow**: Manage content through a lifecycle: Planning → Reading/Watching → Completed, or use statuses like "Anticipating" and "On Hold".
-   **Automated Technical Stats**: Automatically calculate total chapters, episode counts, and durations from child items (seasons/volumes) with manual override support.
-   **Tag Customization**: Create custom tags with persistent colors and descriptions to categorize your library beyond media types.
-   **Rich Metadata**: Store studios, authors, alternate titles, series order, fictional universes (e.g., MCU), and dedicated personal notes.
-   **Privacy & Privacy Mode**: Mark sensitive entries as "Hidden" and use the global "Privacy Mode" toggle to instantly conceal them from the main view.
-   **Release Calendar**: A dedicated calendar view to track upcoming releases with support for recurring events (weekly/daily) and overdue notifications.
-   **Library Statistics**: Visualize your consumption habits with interactive Chart.js graphs (Rating distribution, Type breakdown, and Growth over time).
-   **Unified Configuration**: A centralized `config.json` system manages all application settings, window geometry, and database preferences.
-   **Multi-Database Support**: Easily switch between specialized libraries (e.g., "Main", "Vault", "Archive") or create new ones on the fly.
-   **Dynamic Export**: Generate beautiful HTML card grids, detailed lists, or raw data formats (JSON, CSV, XML) for sharing or backup.

---

## 🎨 UI & Aesthetics

UpNext is designed with a focus on premium aesthetics and smooth user experience:
-   **Glassmorphism**: Elegant translucent panels with backdrop blurring and subtle borders.
-   **Dynamic Themes**: Native Dark and Light mode support with curated color palettes.
-   **Responsive Design**: A fluid layout that adapts from large desktop screens down to narrow windows.
-   **Lucide Icons**: A consistent, high-quality icon set used throughout the application.
-   **Interactive Elements**: Smooth transitions, hover effects, and micro-animations for a "live" feel.

---

## 🚀 Getting Started

### Prerequisites

-   **Python 3.11+**
-   **System Dependencies (Linux)**:
    ```bash
    sudo apt install libgirepository1.0-dev libcairo2-dev pkg-config gir1.2-webkit2-4.1
    ```

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/TenKdoToLami/UpNext.git
    cd UpNext
    ```

2.  **Initialize Environment**:
    ```bash
    # Windows
    py -3.11 -m venv .venv
    .\.venv\Scripts\activate
    pip install -r requirements.txt

    # Linux
    python3.11 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```

3.  **Run Application**:
    ```bash
    python manage.py run
    ```

---

## 🛠️ Project Management

The `manage.py` script is the central hub for development and distribution:

-   `python manage.py run`: Launches the Flask backend and native GUI window.
-   `python manage.py build`: Compiles the entire project into a standalone executable using PyInstaller.
-   `python manage.py clean`: Wipes build artifacts, temporary files, and Python cache.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
