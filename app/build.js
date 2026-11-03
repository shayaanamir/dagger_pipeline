// Bundles the server into dist/ and copies static assets alongside it
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "dist");
fs.rmSync(outDir, { recursive: true, force: true });

esbuild.buildSync({
  entryPoints: ["src/server.js"],
  bundle: true,
  platform: "node",
  target: "node20",
  minify: true,
  outfile: path.join(outDir, "server.js"),
});

fs.cpSync(path.join(__dirname, "src", "public"), path.join(outDir, "public"), { recursive: true });

console.log("Build complete -> dist/");
