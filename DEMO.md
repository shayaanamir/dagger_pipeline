# Video Demo Script & Command Cheat Sheet

Keep this open on a second screen while recording. Run every command from the project root:

```powershell
cd "C:\Users\shaya\Documents\College\Sem VII\DevOps\IA"
```

> Use a **real terminal** (Windows Terminal / VS Code terminal). Dagger's interactive view
> (every step, with `CACHED` labels) only appears in a real terminal.
> Press `+` / `-` in the view to show more or fewer steps, `q` to quit.

---

## 0. Before recording (one-time prep)

1. Start Docker Desktop and wait until it says *Engine running*.
2. Make sure the app is at its baseline (no `/api/health` endpoint; 6 tests).
3. **Reset Dagger's cache** so Run 1 is truly cold:
   ```powershell
   docker rm -f -v dagger-engine-v1.0.0-beta.23
   ```
   (The next `dagger` command recreates the engine with an empty cache.)
4. Remove leftovers from earlier rehearsals:
   ```powershell
   docker rm -f dagger-notes; Remove-Item notes-image.tar -ErrorAction SilentlyContinue
   ```
5. Increase the terminal font size and close unrelated windows.

---

## 1. Intro (≈0:30)

Say: *"My topic is Containerized CI/CD Workflow Automation using Dagger. Dagger lets you write a
CI/CD pipeline as normal code instead of YAML. Every step runs inside a container, and every
step is cached, so the same pipeline runs identically on my laptop and in CI."*

## 2. Architecture (≈1:00)

Show the diagram in the README (or your slide):

```
 app/ source ──► Dagger CLI ──► Dagger Engine (a container in Docker)
                                     │
             deps (npm ci) ──► test (jest) ──► build (esbuild) ──► image (node:20-alpine)
```

## 3. Code walkthrough (≈2:00)

Open and explain, in this order:

| File | What to point out |
|---|---|
| `app/src/routes/notes.js` | The sample REST API (create / list / delete notes) |
| `app/tests/notes.test.js` | 6 Jest + Supertest tests |
| `app/build.js` | The "build": esbuild bundles the app into `dist/` |
| `.dagger/modules/ci/src/index.ts` | **The pipeline as code**: `deps()`, `test()`, `build()`, `image()`, `ci()` |
| `dagger.toml` | The workspace config that registers the `ci` module |

In `index.ts`, point out:
- `deps()` copies **only `package.json` + `package-lock.json`** before `npm ci`, so code changes don't invalidate the dependency cache.
- `dag.cacheVolume("notes-npm-cache")` is a persistent npm download cache.
- Each stage writes the time it actually ran, so the report shows what was cached.

List the pipeline's functions:
```powershell
dagger api functions ci
```

## 4. Run 1: cold run (≈1:30)

```powershell
Measure-Command { dagger api call ci ci | Out-Host }
```

Say: *"This is the first run with an empty cache. Dagger pulls node:20-alpine, installs
dependencies, runs the tests, builds the app and creates the image, each step in its own
container."* Expected: about **70 s**. Note the times in the summary table.

## 5. Run 2: unchanged repeat (≈0:45)

```powershell
Measure-Command { dagger api call ci ci | Out-Host }
```

Expected: about **5 s**. Every step shows `CACHED`, and the "ran at" times in the table **did not
change**. Dagger reused every result.

## 6. Run 3: modify the application (≈1:30)

Add a health-check endpoint. In `app/src/app.js`, below the `app.use("/api/notes", ...)` line:

```js
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.1.0" });
});
```

And a test in `app/tests/notes.test.js` (inside the `describe` block):

```js
  test("GET /api/health reports ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.status).toBe("ok");
  });
```

Run again:
```powershell
Measure-Command { dagger api call ci ci | Out-Host }
```

Expected: about **11 s**, with **7 tests** passing. In the table:
- `deps` keeps its **old** time, because `npm ci` was **CACHED** (the dependencies didn't change)
- `test` and `build` show **new** times (the code changed)

## 7. (Optional) Run 4: change a dependency

```powershell
cd app; npm install dayjs; cd ..
dagger api call ci ci
```

Now `deps` also gets a new time, because the dependency layer was invalidated. It's still faster
than Run 1 thanks to the npm cache volume. Undo it afterwards with `cd app; npm uninstall dayjs; cd ..`.

## 8. (Optional) Failing test stops the pipeline

Change `toBe("ok")` to `toBe("broken")` in the health test and run `dagger api call ci ci`.
The pipeline fails at the **test** stage, and no image is built. Change it back.

Tests also run as a Dagger *check*:
```powershell
dagger check ci
```

## 9. Run the built container image (≈1:00)

**Option A: serve it straight from Dagger:**
```powershell
dagger api call ci web up --ports 3000:3000
```
Open http://localhost:3000 and http://localhost:3000/api/health. Press `q` / Ctrl+C to stop.

**Option B: export it and run it with Docker:**
```powershell
dagger api call ci tarball --output=notes-image.tar
docker load -i notes-image.tar
docker images        # copy the IMAGE ID of the newest <none> image
docker tag <IMAGE_ID> dagger-notes:latest
docker run -d --name dagger-notes -p 3000:3000 dagger-notes:latest
```
Open http://localhost:3000, add a note, and visit `/api/health`. Stop it with `docker rm -f dagger-notes`.

## 10. (Bonus) Same pipeline in GitHub Actions (≈1:00)

Push the repo to GitHub. `.github/workflows/ci.yml` installs Dagger and runs **the same**
`dagger api call ci ci` command. Show the green run and the uploaded `notes-image` artifact.

## 11. Conclusion (≈0:30)

- **Portable:** the same pipeline runs locally and in CI, because everything runs in containers.
- **Fast:** content-addressed caching skips unchanged steps (70 s → 5 s).
- **Pipelines as code:** TypeScript instead of YAML, so they're testable, reusable and type-checked.
- **Limitations:** it needs a container engine, there's a learning curve, and Dagger 1.0 is still in beta.

---

## Measured timings (this machine)

| Run | Change | Time | `npm ci` |
|---|---|---|---|
| 1 | Cold (empty cache) | ~70 s | ran |
| 2 | No change | ~5 s | cached |
| 3 | App code (new endpoint + test) | ~11 s | **cached** |
| 4 | New dependency (`dayjs`) | ~20 s | ran (npm cache volume helped) |

Times in the summary table are **UTC** (IST = UTC + 5:30).
