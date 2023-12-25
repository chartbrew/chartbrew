import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react-swc"

export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, `${process.cwd()}/..`) }; // eslint-disable-line

  let port = 4018;
  if (process.env.NODE_ENV === "production" && process.env.VITE_APP_CLIENT_PORT) {
    port = process.env.VITE_APP_CLIENT_PORT;
  } else if (process.env.NODE_ENV !== "production" && process.env.VITE_APP_CLIENT_PORT_DEV) {
    port = process.env.VITE_APP_CLIENT_PORT_DEV;
  }

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
