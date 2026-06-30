// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

const apiUser = process.env.VITE_WAZUH_API_USER || "";
const apiPass = process.env.WAZUH_API_PASS || "";
const apiAuth = `Basic ${Buffer.from(`${apiUser}:${apiPass}`).toString('base64')}`;

const idxUser = process.env.VITE_WAZUH_INDEXER_USER || "";
const idxPass = process.env.WAZUH_INDEXER_PASS || "";
const idxAuth = `Basic ${Buffer.from(`${idxUser}:${idxPass}`).toString('base64')}`;

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: {
        '/api/manager': {
          target: 'https://54.83.241.104:55000',
          changeOrigin: true,
          secure: false, // Bypasses Wazuh's self-signed certificate
          rewrite: (path) => path.replace(/^\/api\/manager/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              proxyReq.setHeader('Authorization', apiAuth);
            });
          }
        },
        '/api/indexer': {
          target: 'https://54.83.241.104:9200',
          changeOrigin: true,
          secure: false, // Bypasses Indexer's self-signed certificate
          rewrite: (path) => path.replace(/^\/api\/indexer/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              proxyReq.setHeader('Authorization', idxAuth);
            });
          }
        }
      }
    }
  }
});
