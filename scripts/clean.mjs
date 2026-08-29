import { rm } from "node:fs/promises";

for (const path of ["dist", "coverage"]) {
  await rm(path, { force: true, recursive: true });
}

