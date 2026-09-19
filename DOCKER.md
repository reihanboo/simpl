# Docker Development & Production Release Guide

This guide documents how to develop, test, and release the `simpl` full-stack application using Docker and Docker Compose.

---

## Architecture Overview

The application is split into two independent containerized services:
- **Backend**: Go application powered by the **Gin Web Framework** (`github.com/gin-gonic/gin`).
- **Frontend**: React + TypeScript single-page application built with **Vite**.

```
+-----------------------------------------------------------------------+
|                                Host                                   |
|                                                                       |
|  http://localhost:${FRONTEND_PORT}   http://localhost:${BACKEND_PORT} |
|            |                                    |                     |
+------------|------------------------------------|---------------------+
             |                                    |
             v                                    v
+------------------------+             +------------------------+
|   Frontend Container   |             |   Backend Container    |
| (Nginx / Vite Dev Server)            | (Gin Go Application)   |
+------------------------+             +------------------------+
```

---

## Environment Configuration

Ports and environment settings are controlled via `.env` in the root folder.

### `.env` File Structure
```env
FRONTEND_PORT=3000
BACKEND_PORT=8080
```

- `FRONTEND_PORT`: Host port mapped to the frontend web server (Default: `3000`).
- `BACKEND_PORT`: Host port mapped to the backend Go Gin server (Default: `8080`).

---

## 1. Development Workflow (`docker-compose.dev.yml`)

The development setup mounts your local source code into the containers with live reload enabled. Any changes made to `frontend/src` or `backend/main.go` in your editor instantly trigger hot updates inside the running containers.

### Development Features
- **Frontend**: Runs Vite dev server with Hot Module Replacement (HMR) on container port `5173`.
- **Backend**: Runs `go run main.go` with source mounted at `/app`.

### Commands for Development

```bash
# Start development containers in foreground (view live logs)
docker compose -f docker-compose.dev.yml up --build

# Start development containers in background (detached mode)
docker compose -f docker-compose.dev.yml up --build -d

# View live logs for development containers
docker compose -f docker-compose.dev.yml logs -f

# Stop development containers
docker compose -f docker-compose.dev.yml down
```

### Accessing Services in Dev Mode
- **Frontend**: [http://localhost:3000](http://localhost:3000) (or custom `${FRONTEND_PORT}`)
- **Backend**: [http://localhost:8080](http://localhost:8080) (or custom `${BACKEND_PORT}`)
- **Backend Health Check**: [http://localhost:8080/health](http://localhost:8080/health)

---

## 2. Production Release Workflow (`docker-compose.yml`)

The production setup uses optimized multi-stage Docker builds to produce lightweight, secure, and production-ready containers.

### Production Features
- **Frontend Stage 1**: Node `node:22-alpine` compiles static Vite production assets (`npm run build`).
- **Frontend Stage 2**: Nginx `nginx:alpine` serves static assets via high-performance web server.
- **Backend Stage 1**: Go `golang:1.24-alpine` compiles a static Linux binary (`CGO_ENABLED=0`).
- **Backend Stage 2**: Ultra-lightweight `alpine:latest` image runs the standalone binary.

### Commands for Production Release

```bash
# 1. Build and launch production containers in detached mode
docker compose up --build -d

# 2. Verify running container status
docker compose ps

# 3. Stream production logs
docker compose logs -f

# 4. Stop production containers
docker compose down
```

---

## 3. Adding New Libraries & Dependencies

When developing inside Docker, you can install new packages directly into running containers using `docker compose exec`. Because host directories are mounted as volumes, your `package.json` / `go.mod` files will be updated automatically on your host machine!

### A. Adding Frontend NPM Packages

#### 1. Inside Running Dev Container (Recommended)
```bash
# Install a production dependency (e.g. axios, lucide-react)
docker compose -f docker-compose.dev.yml exec frontend npm install <package-name>

# Example:
docker compose -f docker-compose.dev.yml exec frontend npm install axios

# Install a dev dependency (e.g. @types/node)
docker compose -f docker-compose.dev.yml exec frontend npm install -D <package-name>
```

#### 2. Locally from Host Machine
If containers are stopped, install from the `frontend` folder:
```bash
cd frontend
npm install <package-name>
```

---

### B. Adding Backend Go Modules

#### 1. Inside Running Dev Container (Recommended)
```bash
# Add a new Go module (e.g. gorm.io/gorm, github.com/google/uuid)
docker compose -f docker-compose.dev.yml exec backend go get <package-name>

# Example:
docker compose -f docker-compose.dev.yml exec backend go get github.com/google/uuid

# Clean up & tidy dependencies
docker compose -f docker-compose.dev.yml exec backend go mod tidy
```

#### 2. Locally from Host Machine
If containers are stopped, install from the `backend` folder:
```bash
cd backend
go get <package-name>
go mod tidy
```

---

## Quick Reference Commands

| Action | Development Command | Production Command |
| :--- | :--- | :--- |
| **Start Services** | `docker compose -f docker-compose.dev.yml up --build` | `docker compose up --build -d` |
| **Stop Services** | `docker compose -f docker-compose.dev.yml down` | `docker compose down` |
| **View Logs** | `docker compose -f docker-compose.dev.yml logs -f` | `docker compose logs -f` |
| **Install Frontend Pkg** | `docker compose -f docker-compose.dev.yml exec frontend npm i <pkg>` | *(Run in dev mode)* |
| **Install Backend Pkg** | `docker compose -f docker-compose.dev.yml exec backend go get <pkg>` | *(Run in dev mode)* |
| **Rebuild Single Service** | `docker compose -f docker-compose.dev.yml build backend` | `docker compose build backend` |

---

## Troubleshooting & Tips

- **Hot Reloading on Windows**: On Windows host filesystems, Linux container inotify events do not trigger automatically over Docker volume mounts. We configured Vite with `watch.usePolling: true` and `CHOKIDAR_USEPOLLING=true` in [frontend/vite.config.ts](file:///c:/Users/Joenathan/Documents/code/simpl/frontend/vite.config.ts) so changes are detected immediately.
- **Development vs Production Compose**: Ensure you run `docker compose -f docker-compose.dev.yml up` for development mode with hot reloading. Running `docker compose up` starts production mode (which serves static compiled Nginx assets without hot reloading).
- **Port Conflicts**: If port `3000` or `8080` is in use, modify `FRONTEND_PORT` or `BACKEND_PORT` in `.env`.
- **Node Modules cache**: `docker-compose.dev.yml` uses an anonymous volume (`/app/node_modules`) to prevent host node_modules mismatch with Linux container dependencies.
- **Clean rebuild**: To clean build cache and recreate containers from scratch:
  ```bash
  docker compose down -v --remove-orphans
  docker compose up --build --force-recreate
  ```
