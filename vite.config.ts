// Shared Vite + TanStack Start config already includes:
//   TanStack devtools (dev-only), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//   nitro (build-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//   and related plugins. Do not add those manually or you risk duplicate plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
