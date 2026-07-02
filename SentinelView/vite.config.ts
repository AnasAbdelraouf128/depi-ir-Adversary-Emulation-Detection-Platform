// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

const apiUser = env.VITE_WAZUH_API_USER || "";
const apiPass = env.WAZUH_API_PASS || "";
const apiAuth = `Basic ${Buffer.from(`${apiUser}:${apiPass}`).toString('base64')}`;

const idxUser = env.VITE_WAZUH_INDEXER_USER || "";
const idxPass = env.WAZUH_INDEXER_PASS || "";
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
              if (req.url && req.url.includes('/security/user/authenticate')) {
                proxyReq.setHeader('Authorization', apiAuth);
              }
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
