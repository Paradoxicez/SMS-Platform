import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    migrate: "src/db/migrate.ts",
  },
  format: ["esm"],
  target: "node22",
  clean: true,
  noExternal: [/@repo\/.*/],
});
