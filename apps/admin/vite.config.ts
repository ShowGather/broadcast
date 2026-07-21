import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.API_URL || "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
