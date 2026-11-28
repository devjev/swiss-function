#!/usr/bin/env node
// The package's command: `npx swiss-function guide` writes the usage guide for
// coding agents into the host project. See bin/guide.mjs.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./guide.mjs";

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), "..");

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  pkgDir,
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});
