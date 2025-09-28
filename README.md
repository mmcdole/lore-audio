# 🎧 Flix Audio

A modern, self-hosted audiobook server with a beautiful web interface.

## Quick Start

**The easiest way to run the entire stack:**

```bash
./run.sh
```

This will start both the backend (port 8080) and frontend (port 3000) with proper configuration.

## What You Get

- **Backend**: Go-based server with SQLite database
- **Frontend**: Modern Next.js web interface
- **Features**: Library management, import staging, metadata handling

## Manual Setup

If you prefer to run components separately:

### 1. Backend Setup
```bash
cd backend
# Create .env file (see backend/README.md)
export $(cat .env | xargs)
go run ./cmd/server
```

### 2. Frontend Setup
```bash
cd web
# Create .env.local file (see web/README.md)
npm install
npm run dev
```

## Configuration

### Required Directories
The server expects these directories to exist:
- `/Users/drake/Documents/audiobooks` - Your audiobook library
- `/Users/drake/Documents/import` - Staging area for new imports

These are created automatically by `run.sh`.

### Environment Variables
All configuration is handled through environment files:
- `backend/.env` - Server configuration
- `web/.env.local` - Frontend configuration

## First Time Setup

1. **Clone and setup**:
   ```bash
   git clone <repo>
   cd flix-audio
   chmod +x run.sh
   ```

2. **Install frontend dependencies**:
   ```bash
   cd web && npm install && cd ..
   ```

3. **Start everything**:
   ```bash
   ./run.sh
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - Default admin: username=`admin`, password=`admin`

## Development

See individual README files:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./web/README.md)

## Troubleshooting

**Port conflicts**: Make sure ports 3000 and 8080 are available. You can kill existing processes with:
```bash
killall server
pkill -f "npm run dev"
```

**Permission errors**: Make sure the script is executable:
```bash
chmod +x run.sh
```