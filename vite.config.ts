// Shared Vite + TanStack Start config already includes:
//   TanStack devtools (dev-only), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//   nitro (build-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//   and related plugins. Do not add those manually or you risk duplicate plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const APP_BASE = "/krumath-flash/";

export default defineConfig({
  vite: {
    base: APP_BASE,
  },
  // Lovable's typed nitro knobs omit baseURL / wrangler; Nitro accepts them at runtime.
  nitro: {
    baseURL: APP_BASE,
    cloudflare: {
      deployConfig: true,
      wrangler: {
        name: "krumath-flash",
        routes: [
          { pattern: "krumath.com/krumath-flash*", zone_name: "krumath.com" },
        ],
      },
    },
  } as { preset?: string },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
