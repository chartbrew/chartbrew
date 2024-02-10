import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react-swc"

export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, `${process.cwd()}/..`) };

  let port = 4018;
  if (process.env.NODE_ENV === "production" && process.env.VITE_APP_CLIENT_PORT) {
    port = process.env.VITE_APP_CLIENT_PORT;
  } else if (process.env.NODE_ENV !== "production" && process.env.VITE_APP_CLIENT_PORT_DEV) {
    port = process.env.VITE_APP_CLIENT_PORT_DEV;
  }

  process.env.VITE_APP_VERSION = process.env.npm_package_version;

  return defineConfig({
    plugins: [react()],
    server: {
      port,
    },
    preview: {
      port,
      host: "0.0.0.0"
    },
  });
};
