# Development Guide

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Git

### Initial Setup

1. Clone and install:
```bash
git clone <repository-url>
cd dev-management
npm install
```

2. Set up environment:
```bash
cp .env.example .env
```

3. Initialize database:
```bash
npx prisma migrate dev
```

4. Run development server:
```bash
npm run dev
```

The app will be available at:
- Next.js: http://localhost:3000
- WebSocket: ws://localhost:3001

## Project Structure

```
dev-management/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Database migrations
│   └── seed.ts               # Database seed data
├── src/
│   ├── app/                  # Next.js app directory
│   │   ├── api/              # API routes
│   │   ├── dashboard/        # Dashboard page
│   │   ├── deployments/      # Deployments pages
│   │   ├── ai/              # AI assistant page
│   │   ├── settings/        # Settings page
│   │   ├── login/           # Login page
│   │   └── layout.tsx       # Root layout
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── features/        # Feature-specific components
│   │   └── layout/          # Layout components
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client
│   │   ├── auth.ts          # Auth.js config
│   │   ├── auth-utils.ts    # Auth helpers
│   │   ├── utils.ts         # Utility functions
│   │   └── websocket-server.ts # WebSocket server
│   ├── services/
│   │   ├── docker/          # Docker services
│   │   │   ├── base-connector.ts
│   │   │   ├── api-connector.ts
│   │   │   ├── ssh-connector.ts
│   │   │   ├── connection-manager.ts
│   │   │   ├── metrics.ts
│   │   │   └── metrics-stream.ts
│   │   ├── ai/              # AI services
│   │   │   ├── ollama-client.ts
│   │   │   ├── compose-generator.ts
│   │   │   └── compose-validator.ts
│   │   ├── placement/       # Placement algorithm
│   │   │   ├── analyzer.ts
│   │   │   └── requirements-parser.ts
│   │   └── encryption/      # Encryption service
│   │       └── crypto.ts
│   ├── types/              # TypeScript types
│   └── hooks/              # Custom React hooks
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose config
└── server.js              # Custom server with WebSocket
```

## Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start               # Start production server
npm run lint            # Run ESLint

# Database
npx prisma migrate dev  # Create and apply migration
npx prisma migrate deploy # Apply migrations (production)
npx prisma studio       # Open Prisma Studio
npx prisma generate     # Generate Prisma Client
npx prisma db seed      # Seed database

# Docker
docker compose build    # Build Docker image
docker compose up -d    # Start container
docker compose down     # Stop container
docker compose logs -f  # View logs
```

## Key Technologies

### Frontend
- **Next.js 15**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **shadcn/ui**: Component library
- **Radix UI**: Headless components

### Backend
- **Next.js API Routes**: REST API
- **Prisma**: ORM
- **SQLite**: Database
- **Auth.js**: Authentication
- **bcryptjs**: Password hashing
- **WebSocket (ws)**: Real-time updates

### Docker Integration
- **dockerode**: Docker Remote API client
- **node-ssh**: SSH client
- **js-yaml**: YAML parsing

### AI Integration
- **Ollama**: LLM inference

## Development Workflow

### Adding a New Feature

1. Create database schema changes in `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name feature-name`
3. Create API routes in `src/app/api/`
4. Create services in `src/services/`
5. Create UI components in `src/components/`
6. Add pages in `src/app/`

### Creating a New Service

```typescript
// src/services/example/example-service.ts
export class ExampleService {
  static async doSomething(): Promise<void> {
    // Implementation
  }
}
```

### Adding a New API Route

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  await requireAuth();
  
  // Implementation
  
  return NextResponse.json({ data: "example" });
}
```

### Creating a New Component

```typescript
// src/components/features/example-component.tsx
"use client";

export function ExampleComponent() {
  return <div>Example</div>;
}
```

## Testing

### Manual Testing

1. Start the development server
2. Log in with admin credentials
3. Test each feature:
   - Dashboard metrics
   - Host management
   - Deployment creation
   - AI generation
   - Settings configuration

### Testing Docker Connections

1. Set up a test Docker host
2. Add host in Settings
3. Use "Test Connection" button
4. Verify metrics collection
5. Deploy a test compose file

### Testing AI Generation

1. Configure Ollama server URL
2. Select a model in Settings
3. Generate a compose file
4. Validate the output
5. Deploy the generated file

## Common Development Tasks

### Adding a New Docker Connector Type

1. Extend `BaseDockerConnector` in `src/services/docker/`
2. Implement all abstract methods
3. Update `DockerConnectionManager` factory
4. Add connection type to UI

### Modifying Placement Algorithm

1. Update weights in `src/services/placement/analyzer.ts`
2. Adjust scoring logic in `calculateScore()`
3. Update reasons in `generateReasons()`
4. Test with different compose files

### Adding New Ollama Models

Models are automatically fetched from Ollama server.
To add a new model to Ollama:
```bash
ollama pull model-name
```

## Debugging

### Enable Debug Logging

Set environment variable:
```bash
DEBUG=* npm run dev
```

### Inspect Database

```bash
npx prisma studio
```

### Check WebSocket Connection

Open browser console and check for WebSocket errors:
```javascript
// In browser console
console.log(window.location)
```

### Monitor API Requests

Use browser DevTools Network tab to monitor API calls.

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over types for objects
- Use proper null checking
- Document complex functions with JSDoc

### React

- Use functional components
- Prefer hooks over classes
- Keep components focused and small
- Extract reusable logic to custom hooks

### Naming Conventions

- Components: PascalCase (`UserProfile`)
- Functions: camelCase (`getUserData`)
- Constants: UPPER_SNAKE_CASE (`API_ENDPOINT`)
- Files: kebab-case (`user-profile.tsx`)

## Performance Optimization

### Database

- Use indexes on frequently queried fields
- Limit query results when possible
- Use transactions for multiple operations

### WebSocket

- Debounce metrics updates
- Close connections on component unmount
- Implement reconnection logic

### API

- Cache responses when appropriate
- Use pagination for large lists
- Implement rate limiting

## Security Best Practices

1. **Never commit secrets**: Use environment variables
2. **Validate input**: Always validate user input
3. **Sanitize output**: Escape HTML in user content
4. **Use HTTPS**: In production, always use HTTPS
5. **Update dependencies**: Regularly update packages

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker Build

```bash
docker compose build
docker compose up -d
```

### Environment Variables

Required for production:
- `NEXTAUTH_SECRET`: Strong random string
- `ENCRYPTION_KEY`: 32-byte hex string
- `NEXTAUTH_URL`: Production URL
- `OLLAMA_SERVER_URL`: Ollama server URL

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Database Issues

```bash
# Reset database
rm prisma/dev.db
npx prisma migrate dev
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Auth.js Documentation](https://authjs.dev)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Ollama Documentation](https://ollama.ai/docs)
