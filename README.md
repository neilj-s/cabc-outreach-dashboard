# CABC Community Relations (CR) Ministry Dashboard

A full-stack operations and management dashboard designed for the Community Relations (CR) ministry. This application helps coordinate events, manage volunteers, track budgets, reserve assets, and monitor project timelines in real-time.

## Key Features
- **Operations Overview**: High-level metrics on event performance, volunteer workloads, and equipment status.
- **Planning Centre**: Collaborative workspace featuring live-editing tables, a real-time scratchpad, and integrated Google Drive document hubs.
- **Logistics & Asset Tracking**: Catalog assets in inventory and track reservation checkout lists for each ministry event.
- **Volunteers & Lanes**: Assign team leads to ministry divisions ("Lanes") and monitor workload levels to prevent burnout.

## Getting Started

### 1. Install Dependencies
```bash
bun install
```

> **Package manager:** This project standardizes on **bun** — `bun.lock` is the
> single source of truth. Please don't commit a `package-lock.json` or other
> lockfile; installing with a different package manager can cause version drift.

### 2. Configure Environment Variables
Create a `.env` file at the root of the project by copying the example template:
```bash
cp .env.example .env
```

Configure the following variables:
- `GEMINI_API_KEY`: Required for AI planning features and suggestions.
- `APP_URL`: The server URL (e.g., `http://localhost:3000`).
- `PERSISTENT_DISK_PATH`: Optional path to persistent storage; defaults to the local `db_storage.json` file.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` / `GOOGLE_SERVICE_ACCOUNT_KEY`: Optional credentials for the Google Drive integration.

### 3. Run the App Locally
```bash
bun run dev
```
Open `http://localhost:3000` in your browser.
