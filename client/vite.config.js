import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react-swc"

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, `${process.cwd()}/..`) }; // eslint-disable-line

  return defineConfig({
    plugins: [react()],
    server: {
      port: 4018,
    },
  });
};
