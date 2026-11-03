/**
 * CI/CD pipeline for the Notes app, written as code with Dagger.
 *
 * Stages: deps -> test -> build -> image
 * Every stage runs inside a container, and Dagger caches each step,
 * so unchanged work is reused on the next run.
 */
import { dag, Workspace, Directory, Container, File, Service, object, func, check } from "@dagger.io/dagger"

const NODE_IMAGE = "node:20-alpine"

/** Shell snippet that writes the current time (UTC) to a file. */
const stamp = (path: string) => `date -u +%H:%M:%S > ${path}`

@object()
export class Ci {
  /** Application source code (the app/ folder of the workspace). */
  source: Directory

  constructor(ws: Workspace) {
    this.source = ws.directory("/app", {
      exclude: ["node_modules", "dist", "*.tar"],
    })
  }

  /**
   * Stage 1: install dependencies.
   * Only package*.json is copied before `npm ci`, so this step stays cached
   * until the dependency list changes, even when the app code changes.
   */
  @func()
  deps(): Container {
    return dag
      .container()
      .from(NODE_IMAGE)
      .withWorkdir("/app")
      .withMountedCache("/root/.npm", dag.cacheVolume("notes-npm-cache"))
      .withFile("/app/package.json", this.source.file("package.json"))
      .withFile("/app/package-lock.json", this.source.file("package-lock.json"))
      // The timestamp records when this step really ran; a cached step keeps its old time
      .withExec(["sh", "-c", `npm ci --no-audit --no-fund && ${stamp("/tmp/ran-at")}`])
  }

  /** Dependencies installed plus the full application source. */
  @func()
  workspace(): Container {
    return this.deps().withDirectory("/app", this.source)
  }

  /** The container after the test suite has run (fails if any test fails). */
  private tested(): Container {
    // Jest reports on stderr; merge it so the results show in the output
    return this.workspace().withExec(["sh", "-c", `npm test 2>&1 && ${stamp("/tmp/ran-at")}`])
  }

  /** Container after the build step; dist/ holds the bundled app. */
  private built(): Container {
    return this.workspace().withExec(["sh", "-c", `npm run build && ${stamp("/tmp/ran-at")}`])
  }

  /** Stage 2: run the unit tests with Jest and return the report. */
  @func()
  async testReport(): Promise<string> {
    return await this.tested().stdout()
  }

  /** Stage 2 as a Dagger check, so `dagger check` runs the tests. */
  @func()
  @check()
  async test(): Promise<void> {
    await this.testReport()
  }

  /** Stage 3: build (bundle) the application and return the dist/ folder. */
  @func()
  build(): Directory {
    return this.built().directory("/app/dist")
  }

  /** Stage 4: package the built app into a slim runtime container image. */
  @func()
  image(): Container {
    return dag
      .container()
      .from(NODE_IMAGE)
      .withLabel("org.opencontainers.image.title", "dagger-notes")
      .withWorkdir("/app")
      .withDirectory("/app", this.build())
      .withEnvVariable("NODE_ENV", "production")
      .withEnvVariable("PORT", "3000")
      .withExposedPort(3000)
      .withEntrypoint(["node", "server.js"])
  }

  /** The image as a tarball that `docker load` can import. */
  @func()
  tarball(): File {
    return this.image().asTarball()
  }

  /** Run the built image as a service (used by `dagger start`). */
  @func()
  web(): Service {
    return this.image().asService({ useEntrypoint: true })
  }

  /**
   * Full pipeline: install -> test -> build -> image.
   * Tests run first, so a failing test stops the pipeline before any image is built.
   */
  @func()
  async ci(): Promise<string> {
    const testOutput = await this.testReport()
    const files = await this.build().entries()
    await this.image().sync()

    const ranAt = async (c: Container) => (await c.file("/tmp/ran-at").contents()).trim()
    const summary = (testOutput.match(/Tests:\s*(.*)/)?.[1] ?? "passed").trim()

    return [
      "================ Test output ================",
      testOutput.trim(),
      "",
      "========== Dagger CI/CD pipeline ===========",
      "stage        ran at (UTC)  result",
      `[1/4] deps   ${await ranAt(this.deps())}      npm ci - dependencies installed`,
      `[2/4] test   ${await ranAt(this.tested())}      ${summary}`,
      `[3/4] build  ${await ranAt(this.built())}      dist/ -> ${files.join(", ")}`,
      `[4/4] image  ready         ${NODE_IMAGE} + dist/, port 3000`,
      "",
      "An old time means Dagger reused the cached result of that step.",
    ].join("\n")
  }
}
