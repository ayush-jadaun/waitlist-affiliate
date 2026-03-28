import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "WaitlistWidget",
      fileName: "waitlist-widget",
      formats: ["es", "umd"],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
