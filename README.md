# Reminder App

AI-powered obligation reminder app with web UI and CLI interfaces.

## Structure

- **Server** (`server.js`) - Express API server with all core logic
- **Web UI** (`public/`) - Minimal frontend that calls API
- **CLI** (`cli.js`) - Command-line interface
- **Core Logic** (`lib/`) - Server-side parsing and obligation management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3000`

## Usage

### Web UI

Open `http://localhost:3000` in your browser. The UI is minimal - just enter obligations and they'll be parsed and stored.

### CLI

**Important:** Make sure the server is running first (`npm start` in another terminal).

```bash
# Add an obligation
npm run cli add "Call dentist tomorrow"

# List all obligations
npm run cli list

# Toggle obligation done status
npm run cli toggle <id>

# Delete an obligation
npm run cli delete <id>
```

Or use directly:
```bash
node cli.js add "Call dentist tomorrow"
node cli.js list
```

## API Endpoints

- `GET /api/obligations` - Get all obligations
- `POST /api/obligations` - Add new obligation
- `PATCH /api/obligations/:id/toggle` - Toggle done status
- `DELETE /api/obligations/:id` - Delete obligation

## Data Storage

Obligations are stored in `data/obligations.json` (created automatically).

