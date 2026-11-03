# Containerized CI/CD Workflow Automation Using Dagger

A sample **Notes** web application (Node.js + Express) with a **Dagger** pipeline, written in
TypeScript, that installs dependencies, runs the tests, builds the app and produces a container
image. Every step runs in a container and is cached.

## Architecture

```
                 ┌───────────────────────── Dagger Engine (container in Docker) ─────────────────────────┐
 app/ source ──► │  deps            test              build              image                           │
 Dagger CLI      │  node:20-alpine  npm test (Jest)   npm run build      node:20-alpine + dist/          │
                 │  npm ci          on deps+source    (esbuild → dist/)  EXPOSE 3000, node server.js     │
                 │  + npm cache vol                                                                       │
                 └────────────────────────────────────────────────────────────────────────────────────────┘
                        every step is content-addressed → unchanged steps are reused (CACHED)
```

## Project structure

```
IA/
├── app/                         Sample web app
│   ├── src/app.js               Express app
│   ├── src/server.js            Entry point (port 3000)
│   ├── src/routes/notes.js      Notes REST API
│   ├── src/public/index.html    Web UI
│   ├── tests/notes.test.js      Jest + Supertest tests
│   └── build.js                 esbuild bundle → dist/
├── .dagger/modules/ci/
│   └── src/index.ts             ★ The CI/CD pipeline (Dagger module)
├── dagger.toml                  Dagger workspace config
├── .github/workflows/ci.yml     Runs the same pipeline on GitHub Actions
└── DEMO.md                      Video script + command cheat sheet
```

## Pipeline functions

| Function | Stage | Description |
|---|---|---|
| `deps` | 1 | `npm ci` on `package*.json` only, with a persistent npm cache volume |
| `test` / `test-report` | 2 | Runs Jest (`test` is also a `dagger check`) |
| `build` | 3 | Bundles the app and returns `dist/` |
| `image` | 4 | Slim runtime image: `node:20-alpine` + `dist/` |
| `ci` | all | Full pipeline plus a summary showing when each step really ran |
| `tarball` | – | The image as a `.tar` for `docker load` |
| `web` | – | The image as a running service |

## Prerequisites

- Docker Desktop (running)
- Dagger CLI 1.0 (`winget install Dagger.Cli`)
- Node.js 20+ (only needed to run the app outside Dagger)

## Usage

```powershell
dagger api functions ci                              # list pipeline functions
dagger api call ci ci                                # run the whole pipeline
dagger check ci                                      # run the tests as a check
dagger api call ci build --output=./dist             # export the build output
dagger api call ci tarball --output=notes-image.tar  # export the container image
dagger api call ci web up --ports 3000:3000          # serve the app at http://localhost:3000
```

Run the app without Dagger:

```powershell
cd app; npm install; npm test; npm start
```

## Caching results

| Run | Change | Time | `npm ci` |
|---|---|---|---|
| 1 | Cold (empty cache) | ~70 s | ran |
| 2 | No change | ~5 s | cached |
| 3 | App code changed | ~11 s | cached |
| 4 | Dependency added | ~20 s | ran |

See [DEMO.md](DEMO.md) for the full demonstration script.
