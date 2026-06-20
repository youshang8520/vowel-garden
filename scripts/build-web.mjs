import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "www");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await cp(join(root, "index.html"), join(out, "index.html"));
await cp(join(root, "src"), join(out, "src"), { recursive: true });
await cp(join(root, "assets"), join(out, "assets"), {
  recursive: true,
  filter: (source) => !source.split(/[\\/]/).some((part) => part.startsWith(".")),
});

console.log(`Built web assets into ${out}`);
