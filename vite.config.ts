import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks: (id) => (id.includes("/three/") ? "three" : undefined),
      },
    },
  },
});
