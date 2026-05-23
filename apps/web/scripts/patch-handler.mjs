/**
 * Post-build patch:
 *   1. make __require return stub manifests instead of throwing for known
 *      Next.js server manifests that OpenNext can't bundle
 *   2. copy @vercel/og font assets that OpenNext misses, so wrangler's
 *      absolute-path import resolves at bundle time
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const HANDLER =
  ".open-next/server-functions/default/apps/web/handler.mjs";

let code = readFileSync(HANDLER, "utf8");

// The esbuild shim:  throw Error('Dynamic require of "'+x3+'" is not supported')
// Replace with a version that returns stubs for known manifests.
const oldThrow = `throw Error('Dynamic require of "'+x3+'" is not supported')`;
const newThrow = `{
  const _m = String(x3);
  if (_m.includes("middleware-manifest.json"))
    return { version: 3, middleware: {}, functions: {}, sortedMiddleware: [] };
  if (_m.includes("routes-manifest.json"))
    return { version: 3, pages404: true, caseSensitive: false, basePath: "",
             redirects: [], rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
             headers: [], staticRoutes: [], dynamicRoutes: [], dataRoutes: [] };
  if (_m.includes("functions-config-manifest.json"))
    return { version: 1, functions: {} };
  if (_m.includes("prefetch-hints.json"))
    return {};
  throw Error('Dynamic require of "' + x3 + '" is not supported');
}`;

if (code.includes(oldThrow)) {
  code = code.replace(oldThrow, newThrow);
  writeFileSync(HANDLER, code);
  console.log("✅ Patched handler.mjs — manifest stubs injected");
} else {
  console.log("ℹ  __require throw pattern not found — already patched");
}

// ---- copy missing @vercel/og font assets ----
// handler.mjs contains absolute-path imports like:
//   await import("<abs>/@vercel/og/noto-sans-v27-latin-regular.ttf.bin")
// OpenNext's copyPackageTemplateFiles misses .ttf.bin, breaking `wrangler deploy`.
const OG_ASSETS = ["noto-sans-v27-latin-regular.ttf.bin"];

const importRe = /"(\/[^"]+?\/@vercel\/og)\/[^"/]+"/;
const match = code.match(importRe);
if (match) {
  const destDir = match[1];                      // absolute path in built tree
  const srcDir = destDir.replace(
    "/apps/web/.open-next/server-functions/default/node_modules/",
    "/node_modules/",
  );
  for (const f of OG_ASSETS) {
    const src = `${srcDir}/${f}`;
    const dst = `${destDir}/${f}`;
    if (!existsSync(dst) && existsSync(src)) {
      copyFileSync(src, dst);
      console.log(`✅ Copied ${f} into built @vercel/og`);
    }
  }
} else {
  console.log("ℹ  No @vercel/og import found — skipping font copy");
}
