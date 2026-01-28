# DEV Management System - Project Scope

## Project Overview

A Next.js-based web application for managing DEV resources, enabling administrators to monitor capacity, deploy Docker applications, and leverage AI-assisted Docker Compose generation.

## Core Features

### 1. Capacity Overview Dashboard

- **Real-time Monitoring**: Display capacity overview of all DEV servers
- **Metrics Tracking**:
  - Current CPU/RAM load per host
  - Available disk storage
  - Network port availability
  - Resource utilization trends

### 2. Application Deployment Management

- **Docker Deployment**: Deploy applications via Docker containers using docker-compose
- **Smart Placement Algorithm**:
  - Analyze current host load
  - Evaluate available disk storage
  - Check RAM availability
  - Verify network port availability
  - Weight multiple factors for intelligent host selection
  - Suggest optimal host for deployment
- **Manual Override**: Allow users to manually select host placement if desired
- **Host Management**: Admin settings page for configuring and managing Docker hosts

### 3. AI-Powered Docker Compose Generator

- **Integration**: Connect to Ollama server at `http://10.10.10.216:11434`
- **Chatbot Interface**: Natural language interface for generating docker-compose files
- **Use Cases**:
  - "Give me a docker compose for postgres"
  - "I want to spin up Langflow"
  - Custom application requests
- **Storage**: Persist all generated docker-compose files in database
- **Model Selection**: Admin can select available models from Ollama server in settings UI

## Technical Requirements

### Database

- **ORM**: Prisma
- **Database**: SQLite
- **Storage**: Docker-compose file history and configurations

### Authentication & Authorization

- **Framework**: Auth.js
- **Authentication Method**: Username/Password login
- **User Management**:
  - Admin-only user creation (no self-registration)
  - Built-in admin account: `admin@storio.dev`
  - Default password: `QgDFT13W`
  - Force password change on first login

### UI/UX Requirements

- **Design**: Modern, clean interface
- **Responsiveness**: 
  - Optimized for desktop views
  - Separate mobile-optimized layouts
  - Touch-friendly controls for mobile
- **Component Library**: shadcn/ui

### Deployment

- **Containerization**: Single Docker container deployment
- **Requirements**:
  - Dockerfile for application
  - docker-compose.yml for orchestration
  - Environment configuration
  - Volume mounts for SQLite persistence

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend Framework | Next.js 15 |
| Database ORM | Prisma |
| Database | SQLite |
| UI Components | shadcn/ui |
| AI Service | Ollama (External Server) |
| Authentication | Auth.js |
| Containerization | Docker |

## System Architecture

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
└─────────────────────────────────────────┘
            │                    │
            │                    │
            ↓                    ↓
┌──────────────────┐  ┌──────────────────┐
│  Docker Hosts    │  │ Ollama AI Server │
│  (via API/SSH)   │  │  10.10.10.216    │
└──────────────────┘  └──────────────────┘
```

## Code Architecture & Organization

The application must be built following clean code principles with functionality organized into well-structured services, libraries, and frameworks.

### Architectural Principles

- **Separation of Concerns**: Clear boundaries between presentation, business logic, and data access layers
- **Service-Oriented Design**: Encapsulate business logic in reusable service classes
- **DRY (Don't Repeat Yourself)**: Extract common functionality into shared libraries and utilities
- **SOLID Principles**: Follow object-oriented design principles for maintainable code

### Recommended Structure

```
src/
├── app/                    # Next.js app directory (routes & pages)
├── components/             # React UI components
│   ├── ui/                # shadcn/ui base components
│   ├── features/          # Feature-specific components
│   └── layout/            # Layout components
├── lib/                    # Shared libraries and utilities
│   ├── prisma.ts          # Prisma client instance
│   ├── auth.ts            # Auth.js configuration
│   └── utils.ts           # Helper functions
├── services/              # Business logic services
│   ├── docker/            # Docker host management
│   │   ├── connection.ts  # Docker API/SSH connections
│   │   ├── deployment.ts  # Deployment orchestration
│   │   └── metrics.ts     # Host metrics collection
│   ├── ai/                # AI integration
│   │   ├── ollama.ts      # Ollama API client
│   │   └── composer.ts    # Docker compose generation
│   └── placement/         # Smart placement algorithm
│       └── analyzer.ts    # Host selection logic
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
└── config/                # Configuration files
```

### Service Layer Requirements

- **Docker Service**: Handle all Docker host communications, deployment operations, and metrics collection
- **AI Service**: Manage Ollama integration, model selection, and compose file generation
- **Placement Service**: Implement intelligent host selection algorithm with configurable weighting
- **Auth Service**: Handle user authentication, authorization, and session management
- **Metrics Service**: Aggregate and process host resource metrics

### Code Quality Standards

- **TypeScript**: Strict type checking enabled
- **Error Handling**: Comprehensive error handling with proper logging
- **Testing**: Unit tests for services and integration tests for critical paths
- **Documentation**: JSDoc comments for public APIs and complex logic
- **Linting**: ESLint configuration for code consistency
- **Formatting**: Prettier for consistent code style

## Security Considerations

- Secure credential storage for Docker host connections
- API authentication for all endpoints
- Input validation for AI-generated docker-compose files
- Role-based access control (Admin vs. User permissions)
- Secure password hashing and storage

## Future Enhancements (Out of Scope for v1)

- Multi-user role management
- Application health monitoring
- Automated backup scheduling
- Resource usage alerts and notifications
- Integration with additional container orchestration platforms
