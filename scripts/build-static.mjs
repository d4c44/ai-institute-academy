// Builds the GitHub Pages version of the site into ./out.
//
//   node scripts/build-static.mjs      (PAGES_BASE_PATH=/ai-institute-academy for Pages)
//
// A static export cannot contain a proxy (locale negotiation), route handlers that read requests or a
// catch-all 404 route, so those are moved out of the way for the duration of the build and put back
// afterwards (also when the build fails).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const stash = join(root, ".static-stash");
const moved = [
  ["src/proxy.ts", "proxy.ts"],
  ["src/app/api", "api"],
  // turns unknown paths into the localized 404; a static host serves 404.html by itself
  ["src/app/[locale]/(site)/[...rest]", "rest"],
];

// Without Cache Components the "use cache" directive is an error, and a static export has nothing to
// cache anyway: the catalog is read once, at build time. Strip the directives while building.
const catalog = join(root, "src/lib/api/catalog.ts");
let catalogOriginal = null;
const USE_CACHE = /^\s*"use cache";\r?\n/gm;
const CACHE_CALLS = /^\s*cache(Life|Tag)\(.*\);\r?\n/gm;
const CACHE_IMPORT = /^import \{ cacheLife, cacheTag \} from "next\/cache";\r?\n/m;

function stripCache() {
  catalogOriginal = readFileSync(catalog, "utf8");
  writeFileSync(catalog, catalogOriginal.replace(USE_CACHE, "").replace(CACHE_CALLS, "").replace(CACHE_IMPORT, ""));
}

function stashAway() {
  rmSync(stash, { recursive: true, force: true });
  mkdirSync(stash, { recursive: true });
  for (const [from, name] of moved) if (existsSync(join(root, from))) renameSync(join(root, from), join(stash, name));
}

function restore() {
  if (catalogOriginal !== null) writeFileSync(catalog, catalogOriginal);
  for (const [from, name] of moved) if (existsSync(join(stash, name))) renameSync(join(stash, name), join(root, from));
  rmSync(stash, { recursive: true, force: true });
}

const basePath = process.env.PAGES_BASE_PATH ?? "";
let status = 1;
stashAway();
stripCache();
try {
  rmSync(join(root, ".next"), { recursive: true, force: true });
  rmSync(join(root, "out"), { recursive: true, force: true });
  const run = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, STATIC_EXPORT: "1", NEXT_TELEMETRY_DISABLED: "1", PAGES_BASE_PATH: basePath },
  });
  status = run.status ?? 1;
} finally {
  restore();
}
if (status !== 0) process.exit(status);

// The export writes the per-segment payloads the router prefetches into folders
// (__next.$d$locale/!KHNpdGUp.txt), but the router asks for them with dots (__next.$d$locale.!KHNpdGUp.txt).
// Copy each to the name that is requested, or every prefetch is a 404.
function addDottedPayloadNames(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("__next.")) {
        const copyDotted = (current) => {
          for (const entry of readdirSync(current)) {
            const p = join(current, entry);
            if (statSync(p).isDirectory()) copyDotted(p);
            else {
              const rest = relative(full, p).split(sep).join(".");
              copyFileSync(p, join(dir, name + "." + rest));
            }
          }
        };
        copyDotted(full);
      }
      addDottedPayloadNames(full);
    }
  }
}
addDottedPayloadNames(join(root, "out"));

// "/" is not a locale page, so the export has no index.html: add one that picks a language.
const home = `${basePath}/`;
const index = `<!doctype html><html lang="kk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Institute Academy</title>
<link rel="icon" href="${home}icon.png">
<script>
  var langs = ["kk", "ru", "en", "ko"];
  var saved = null;
  try { saved = localStorage.getItem("ai-locale"); } catch (e) {}
  var pick = saved;
  if (langs.indexOf(pick) < 0) {
    pick = "kk";
    var prefs = navigator.languages || [navigator.language || "kk"];
    for (var i = 0; i < prefs.length; i++) {
      var code = String(prefs[i]).slice(0, 2).toLowerCase();
      if (langs.indexOf(code) >= 0) { pick = code; break; }
    }
  }
  location.replace("${home}" + pick + "/");
</script>
<noscript><meta http-equiv="refresh" content="0; url=${home}kk/"></noscript>
</head><body><p><a href="${home}kk/">Қазақша</a> · <a href="${home}ru/">Русский</a> · <a href="${home}en/">English</a> · <a href="${home}ko/">한국어</a></p></body></html>`;
writeFileSync(join(root, "out", "index.html"), index);

// A /verify/<code> link (what the Go site's QR codes look like) has no page on a static host: send it to
// the /verify/?code= page, which can look any code up. Everything else keeps the normal 404 page.
const notFoundFile = join(root, "out", "404.html");
if (existsSync(notFoundFile)) {
  const redirect = String.raw`<script>(function(){var m=location.pathname.match(/^(.*\/)(kk|ru|en|ko)\/verify\/([^\/]+)\/?$/);if(m)location.replace(m[1]+m[2]+"/verify/?code="+m[3]);})();</script>`;
  writeFileSync(notFoundFile, readFileSync(notFoundFile, "utf8").replace("<head>", "<head>" + redirect));
}
writeFileSync(join(root, "out", ".nojekyll"), "");
console.log("static site written to out/");
