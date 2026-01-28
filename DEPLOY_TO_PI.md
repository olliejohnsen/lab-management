# Deploy to Raspberry Pi 5 (Ubuntu Server)

## Prerequisites on Raspberry Pi

1. Docker and Docker Compose installed
2. Git installed

## Deployment Steps

### 1. SSH into your Raspberry Pi:
```bash
ssh your-user@raspberry-pi-ip
```

### 2. Clone the repository:
```bash
cd ~
git clone https://github.com/your-username/lab-management.git
cd lab-management
```

Or if already cloned, pull latest changes:
```bash
cd ~/lab-management
git pull origin main
```

### 3. Create the `.env.production` file:
```bash
cat > .env.production << 'EOF'
# Database
DATABASE_URL="file:/data/app.db"

# Auth.js (Generate new secret: openssl rand -base64 32)
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://your-pi-ip:3000"

# Encryption (Generate new key: openssl rand -base64 32)
ENCRYPTION_KEY="your-encryption-key-here"

# Ollama Server
OLLAMA_SERVER_URL="http://10.10.10.216:11434"

# Application
NODE_ENV="production"
PORT=3000
WS_PORT=3001
EOF
```

### 4. Create data directory:
```bash
mkdir -p data
chmod 777 data
```

### 5. Build and start the container:
```bash
docker-compose down
docker-compose up --build -d
```

### 6. Check logs:
```bash
docker logs dev-management -f
```

Look for:
- ✅ `Created admin user: admin@storio.dev`
- ✅ `Seed complete.`
- ✅ `Ready in XXms`
- ✅ `WebSocket server ready on port 3001`

### 7. Access the application:
```
http://your-raspberry-pi-ip:3000
```

**Login credentials:**
- Email: `admin@storio.dev`
- Password: `QgDFT13W`

## Troubleshooting

### Permission Issues
If you still see permission errors:
```bash
sudo chown -R 1000:1000 data
sudo chmod -R 777 data
```

### Port Already in Use
If port 3000 or 3001 is already in use, change them in `.env.production`:
```bash
PORT=8080
WS_PORT=8081
```

Then update `docker-compose.yml` ports section and restart.

### View Container Logs
```bash
docker logs dev-management --tail 100 -f
```

### Restart Container
```bash
docker-compose restart
```

### Rebuild from Scratch
```bash
docker-compose down -v
rm -rf data/*
docker-compose up --build -d
```

## Notes

- The database is stored in `./data/app.db` and persists across container restarts
- The database is **recreated fresh** on each container start (by design)
- The container runs as root to avoid ARM64 permission issues on Ubuntu Server
- The application uses SQLite for simplicity on Raspberry Pi
