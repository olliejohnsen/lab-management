/**
 * Predefined deployment templates with docker-compose content.
 * Users can deploy these one-click (after choosing host and project name).
 */

export interface DeploymentTemplate {
  id: string;
  name: string;
  description: string;
  category: "ai" | "database" | "runtime" | "app";
  composeContent: string;
  /** Optional default env lines (e.g. POSTGRES_PASSWORD=changeme) */
  defaultEnv?: string;
}

export const deploymentTemplates: DeploymentTemplate[] = [
  {
    id: "langflow",
    name: "Langflow",
    description: "Visual framework for building LLM apps and agents. Low-code flow builder.",
    category: "ai",
    composeContent: `services:
  langflow:
    image: langflow/langflow:latest
    container_name: langflow
    ports:
      - "7860:7860"
    environment:
      - LANGFLOW_DATABASE_URL=sqlite:///langflow.db
      - LANGFLOW_AUTO_LOGIN=true
    volumes:
      - langflow_data:/langflow
    restart: unless-stopped

volumes:
  langflow_data: {}
`,
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Run Llama, Mistral, and other LLMs locally. No GPU required for smaller models.",
    category: "ai",
    composeContent: `services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

volumes:
  ollama_data: {}
`,
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Popular open-source relational database. Use for apps, analytics, or backups.",
    category: "database",
    defaultEnv: "POSTGRES_PASSWORD=changeme",
    composeContent: `services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD:-changeme}
      - POSTGRES_DB=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data: {}
`,
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Document database for flexible schemas and horizontal scaling.",
    category: "database",
    defaultEnv: "MONGO_INITDB_ROOT_PASSWORD=changeme",
    composeContent: `services:
  mongodb:
    image: mongo:7
    container_name: mongodb
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=\${MONGO_INITDB_ROOT_PASSWORD:-changeme}
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongodb_data: {}
`,
  },
  {
    id: "redis",
    name: "Redis",
    description: "In-memory cache and message broker. Ideal for sessions, queues, and real-time data.",
    category: "database",
    composeContent: `services:
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  redis_data: {}
`,
  },
  {
    id: "nodejs",
    name: "Node.js",
    description: "Minimal Node.js 22 container. Use as a base or attach your app via volumes.",
    category: "runtime",
    composeContent: `services:
  node:
    image: node:22-alpine
    container_name: nodejs
    ports:
      - "3000:3000"
    volumes:
      - node_app:/app
    working_dir: /app
    command: sh -c "npm install 2>/dev/null; node server.js || node -e \\"require('http').createServer((q,r)=>r.end('OK')).listen(3000)\\""
    restart: unless-stopped

volumes:
  node_app: {}
`,
  },
  {
    id: "nextapp",
    name: "Next.js",
    description: "Minimal Next.js standalone server. Mount your app or use as a starter.",
    category: "app",
    composeContent: `services:
  next:
    image: node:22-alpine
    container_name: nextapp
    ports:
      - "3000:3000"
    volumes:
      - next_app:/app
    working_dir: /app
    command: sh -c "npm install 2>/dev/null; npm run build 2>/dev/null; npm start 2>/dev/null || node -e \\"require('http').createServer((q,r)=>r.end('Next.js ready')).listen(3000)\\""
    restart: unless-stopped

volumes:
  next_app: {}
`,
  },
  {
    id: "nginx",
    name: "Nginx",
    description: "Lightweight reverse proxy and static file server. Expose and protect your apps.",
    category: "app",
    composeContent: `services:
  nginx:
    image: nginx:alpine
    container_name: nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - nginx_html:/usr/share/nginx/html
      - nginx_conf:/etc/nginx/conf.d
    restart: unless-stopped

volumes:
  nginx_html: {}
  nginx_conf: {}
`,
  },
  {
    id: "traefik",
    name: "Traefik",
    description: "Modern reverse proxy with automatic HTTPS and service discovery.",
    category: "app",
    composeContent: `services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_data:/etc/traefik
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
    restart: unless-stopped

volumes:
  traefik_data: {}
`,
  },
  {
    id: "portainer",
    name: "Portainer",
    description: "Web UI for managing Docker. Manage containers, images, and stacks from the browser.",
    category: "app",
    composeContent: `services:
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    ports:
      - "9443:9443"
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    restart: unless-stopped

volumes:
  portainer_data: {}
`,
  },
];

export const templateCategories: Record<DeploymentTemplate["category"], string> = {
  ai: "AI & ML",
  database: "Databases",
  runtime: "Runtimes",
  app: "Apps & Tools",
};
