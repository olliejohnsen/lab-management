# DEV Management System

A comprehensive Next.js-based web application for managing DEV Docker infrastructure with real-time monitoring, AI-powered compose generation, and intelligent deployment placement.

## Features

- **Real-time Dashboard**: Monitor CPU, RAM, disk usage, and network ports across all Docker hosts
- **Smart Deployment Placement**: Intelligent algorithm suggests optimal hosts based on resource availability
- **AI-Powered Compose Generation**: Generate docker-compose files using natural language via Ollama
- **Multi-Host Support**: Manage multiple Docker hosts via SSH or Docker Remote API
- **Secure Credentials**: AES-256-GCM encryption for storing host credentials
- **WebSocket Streaming**: Real-time metrics updates without polling
- **Modern UI**: Built with Next.js 15, shadcn/ui, and Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 20 or higher
- Docker and Docker Compose (for containerized deployment)
- Ollama server running (for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dev-management
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `ENCRYPTION_KEY`: Generate with `openssl rand -hex 32`
- `OLLAMA_SERVER_URL`: Your Ollama server URL

4. Initialize the database:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
npm run dev
```

6. Access the application at `http://localhost:3000`

**Default admin credentials:**
- Email: `admin@storio.dev`
- Password: `QgDFT13W`

⚠️ **Important**: You will be prompted to change the password on first login.

## Docker Deployment

### Using Docker Compose

1. Create a `.env` file with required variables:
```bash
NEXTAUTH_SECRET=<your-secret>
ENCRYPTION_KEY=<your-encryption-key>
OLLAMA_SERVER_URL=http://10.10.10.216:11434
NEXTAUTH_URL=http://your-domain.com
```

2. Build and start the container:
```bash
docker compose up -d
```

3. The application will be available at `http://localhost:3000`

### Volumes

The Docker deployment uses a persistent volume for the SQLite database:
- `./data:/data` - SQLite database and application data

## Configuration

### Docker Host Setup

Configure Docker hosts in Settings → Docker Hosts:

**SSH Connection:**
- Host: IP address or hostname
- Port: 22 (default)
- Username: SSH user
- Password: SSH password

**Docker API Connection:**
- Host: IP address or hostname
- Port: 2375/2376
- Credentials: TLS certificates (if required)

### Placement Algorithm

Configure placement weights in Settings → Placement Algorithm:
- CPU Weight: Priority for CPU availability
- RAM Weight: Priority for RAM availability
- Disk Weight: Priority for disk space
- Network Weight: Priority for port availability

Total must equal 100%.

### AI Configuration

Select the Ollama model in Settings → AI Configuration. Available models are fetched from your Ollama server.

## Architecture

```
┌─────────────────────────────────────────┐
│         Next.js Application             │
│  ┌──────────────────────────────────┐   │
│  │  Frontend (React + shadcn/ui)    │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  API Routes (Next.js)            │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Auth.js (Authentication)        │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Prisma + SQLite                 │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  WebSocket Server (Port 3001)    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
            │                    │
            ↓                    ↓
┌──────────────────┐  ┌──────────────────┐
│  Docker Hosts    │  │ Ollama AI Server │
│  (via API/SSH)   │  │  10.10.10.216    │
└──────────────────┘  └──────────────────┘
```

## Tech Stack

- **Framework**: Next.js 15
- **Database**: SQLite with Prisma ORM
- **Authentication**: Auth.js
- **UI**: shadcn/ui + Tailwind CSS
- **Real-time**: WebSocket (ws)
- **Docker**: dockerode, node-ssh
- **AI**: Ollama integration
- **Encryption**: Node.js crypto (AES-256-GCM)

## API Endpoints

### Hosts
- `GET /api/hosts` - List all Docker hosts
- `POST /api/hosts` - Add new host
- `PUT /api/hosts/[id]` - Update host
- `DELETE /api/hosts/[id]` - Remove host
- `POST /api/hosts/[id]/test` - Test connection
- `GET /api/hosts/[id]/metrics` - Get metrics history

### Deployments
- `GET /api/deployments` - List deployments
- `POST /api/deployments` - Deploy compose file
- `GET /api/deployments/[id]` - Get deployment
- `DELETE /api/deployments/[id]` - Remove deployment
- `POST /api/deployments/suggest-host` - Get placement recommendation

### AI
- `GET /api/ai/models` - List Ollama models
- `POST /api/ai/generate` - Generate compose file
- `POST /api/ai/validate` - Validate compose file

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update setting

## Security

- **Authentication**: JWT-based sessions via Auth.js
- **Encryption**: AES-256-GCM for sensitive credentials
- **RBAC**: Admin-only access for host management and settings
- **Force Password Change**: First-time login requires password change
- **Input Validation**: Compose file validation before deployment

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for development setup and guidelines.

## Troubleshooting

### WebSocket Connection Issues

If the dashboard shows "Disconnected":
1. Ensure WebSocket server is running on port 3001
2. Check firewall rules allow port 3001
3. Verify `WS_PORT` environment variable

### Docker Host Connection Failures

1. **SSH**: Verify SSH credentials and firewall rules
2. **API**: Ensure Docker daemon exposes API on configured port
3. Test connection using the "Test" button in Settings

### Ollama Integration Issues

1. Verify Ollama server is running and accessible
2. Check `OLLAMA_SERVER_URL` environment variable
3. Ensure selected model is available on Ollama server

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please open an issue on GitHub.
