import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const apiProxy = env.VITE_API_PROXY || "http://localhost:8000";
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": apiProxy,
        "/health": apiProxy,
      },
    },
  };
});
