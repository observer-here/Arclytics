import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      "/arcscan": {
        target: "https://testnet.arcscan.app",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/arcscan/, "/api/v2"),
      },
      "/arcrpc": {
        target: "https://rpc.testnet.arc.network",
        changeOrigin: true,
        rewrite: () => "/",
      },
      "/arcstats": {
        target: "https://testnet.arcscan.app",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/arcstats/, "/stats-service/api/v1"),
      },
    },
  },
});
