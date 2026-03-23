import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  outfile: "main.js",
  format: "cjs",
  platform: "node",
  target: "es2022",
  external: ["obsidian", "electron"],
  sourcemap: false,
  minify: false,
  legalComments: "none",
});

if (watch) {
  await context.watch();
  console.log("[tdm-obsidian] watching...");
} else {
  await context.rebuild();
  await context.dispose();
  console.log("[tdm-obsidian] build complete");
}
