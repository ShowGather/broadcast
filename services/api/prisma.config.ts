import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const projectRootEnv = resolve(fileURLToPath(new URL("../../.env", import.meta.url)));
if (existsSync(projectRootEnv)) process.loadEnvFile(projectRootEnv);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
