#!/usr/bin/env node
// Patches @cloudflare/next-on-pages output to fix async_hooks import
// async_hooks must use node: prefix in Cloudflare Workers with nodejs_compat

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const funcDir = path.join(
  __dirname,
  ".vercel/output/static/_worker.js/__next-on-pages-dist__/functions"
);

if (!fs.existsSync(funcDir)) {
  console.log("patch-worker: functions dir not found, skipping");
  process.exit(0);
}

const files = glob.sync("**/*.func.js", { cwd: funcDir, absolute: true });

let patched = 0;
for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const before = content;
  // Fix bare async_hooks → node:async_hooks
  content = content.replace(/from"async_hooks"/g, 'from"node:async_hooks"');
  content = content.replace(/from'async_hooks'/g, "from'node:async_hooks'");
  content = content.replace(/require\("async_hooks"\)/g, 'require("node:async_hooks")');
  if (content !== before) {
    fs.writeFileSync(file, content);
    console.log("patch-worker: patched", path.relative(funcDir, file));
    patched++;
  }
}

console.log(`patch-worker: done (${patched} files patched)`);
