import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import http from 'http';

// Backend (server.py) port; override with TECTONIC_BACKEND_PORT when 8000 is taken.
const BACKEND_PORT = Number(process.env.TECTONIC_BACKEND_PORT ?? 8000);
const BACKEND = `127.0.0.1:${BACKEND_PORT}`;

function backendBridgePlugin(): Plugin {
  return {
    name: 'backend-bridge',
    configureServer(server) {
      const projectRoot = path.resolve(__dirname, '..');
      const envPath = path.join(projectRoot, '.env');
      const generatedAgentsDir = path.join(projectRoot, 'generated_agents');

      // Helper to read body from Node request
      const readBody = (req: any): Promise<string> => {
        return new Promise((resolve, reject) => {
          let data = '';
          req.on('data', (chunk: any) => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
      };

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';

        // 0. Transparent Proxy for ADK Backend Routes (Overriding Origin to prevent 403 Forbidden)
        const isAdkRoute = url === '/run' || url === '/run_sse' || url === '/list-apps' || url.startsWith('/apps');
        if (isAdkRoute) {
          const adkHeaders = {
            ...req.headers,
            host: BACKEND,
            origin: `http://${BACKEND}`,
            referer: `http://${BACKEND}/`
          };

          // A page refresh must not abort an agent run: ADK cancels /run when its client disconnects, so the
          // upstream request is kept open after the browser leaves and its reply drained. The reloaded Studio
          // then finds the finished turn in the session.
          let upstream: http.IncomingMessage | null = null;
          const adkReq = http.request(
            {
              hostname: '127.0.0.1',
              port: BACKEND_PORT,
              path: req.url,
              method: req.method,
              headers: adkHeaders
            },
            (adkRes) => {
              upstream = adkRes;
              if (res.destroyed) {
                adkRes.resume();
                return;
              }
              res.writeHead(adkRes.statusCode || 200, adkRes.headers);
              adkRes.pipe(res);
            }
          );

          res.on('close', () => {
            if (!res.writableFinished) upstream?.resume();
          });
          res.on('error', () => { /* the browser went away; the upstream run continues */ });

          adkReq.on('error', (err) => {
            if (res.headersSent || res.destroyed) return;
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'ADK Backend connection error: ' + err.message }));
          });

          req.pipe(adkReq);
          return;
        }

        // 1. GET /api/env
        if (url === '/api/env' && req.method === 'GET') {
          try {
            let content = '';
            if (fs.existsSync(envPath)) {
              content = fs.readFileSync(envPath, 'utf8');
            }
            const googleKeyMatch = content.match(/^GOOGLE_API_KEY=(.*)$/m);
            const geminiKeyMatch = content.match(/^GEMINI_API_KEY=(.*)$/m);
            const geminiModelMatch = content.match(/^GEMINI_MODEL=(.*)$/m);
            const rawKey = (googleKeyMatch ? googleKeyMatch[1].trim() : '') || (geminiKeyMatch ? geminiKeyMatch[1].trim() : '');
            const model = geminiModelMatch ? geminiModelMatch[1].trim() : 'gemini-3.6-flash';

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              hasKey: rawKey.length > 0,
              apiKey: rawKey,
              model: model,
              envExists: fs.existsSync(envPath)
            }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }

        // 2. POST /api/env (Direct write to .env, ZERO LLM interaction)
        if (url === '/api/env' && req.method === 'POST') {
          try {
            const bodyStr = await readBody(req);
            const body = JSON.parse(bodyStr || '{}');
            const apiKey = (body.apiKey || '').trim();
            const model = (body.model || 'gemini-3.6-flash').trim();

            let currentEnv = '';
            if (fs.existsSync(envPath)) {
              currentEnv = fs.readFileSync(envPath, 'utf8');
            } else if (fs.existsSync(path.join(projectRoot, '.env.example'))) {
              currentEnv = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8');
            }

            // Update or add GOOGLE_API_KEY
            if (/^GOOGLE_API_KEY=/m.test(currentEnv)) {
              currentEnv = currentEnv.replace(/^GOOGLE_API_KEY=.*$/m, `GOOGLE_API_KEY=${apiKey}`);
            } else {
              currentEnv = `GOOGLE_API_KEY=${apiKey}\n` + currentEnv;
            }

            // Update or add GEMINI_API_KEY
            if (/^GEMINI_API_KEY=/m.test(currentEnv)) {
              currentEnv = currentEnv.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${apiKey}`);
            } else {
              currentEnv = `GEMINI_API_KEY=${apiKey}\n` + currentEnv;
            }

            // Update or add GEMINI_MODEL
            if (/^GEMINI_MODEL=/m.test(currentEnv)) {
              currentEnv = currentEnv.replace(/^GEMINI_MODEL=.*$/m, `GEMINI_MODEL=${model}`);
            } else {
              currentEnv = `GEMINI_MODEL=${model}\n` + currentEnv;
            }

            // Ensure other default vars exist if missing
            if (!/^AGENT_BUILDER_OUTPUT_DIR=/m.test(currentEnv)) {
              currentEnv += `\nAGENT_BUILDER_OUTPUT_DIR=./generated_agents\nAGENT_BUILDER_LOG_DIR=./logs\nAGENT_BUILDER_TRACE_LEVEL=INFO\nAGENT_BUILDER_OTEL_CONSOLE=0\n`;
            }

            fs.writeFileSync(envPath, currentEnv, 'utf8');

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              message: 'Successfully written Google API Key to .env without LLM interaction',
              hasKey: apiKey.length > 0,
              model
            }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }

        // 3. GET /api/system/agents (List all generated agents from disk)
        if (url === '/api/system/agents' && req.method === 'GET') {
          try {
            const agents: any[] = [];
            if (fs.existsSync(generatedAgentsDir)) {
              const entries = fs.readdirSync(generatedAgentsDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('_')) {
                  const agentFolder = path.join(generatedAgentsDir, entry.name);
                  // Check inner app folder (ADK convention: generated_agents/<name>/<name>/agent.py)
                  let innerAppPath = path.join(agentFolder, entry.name);
                  let appName = `generated_agents.${entry.name}.${entry.name}`;
                  if (!fs.existsSync(innerAppPath)) {
                    innerAppPath = agentFolder;
                    appName = `generated_agents.${entry.name}`;
                  }

                  // Discover files
                  const files: string[] = [];
                  const scanDir = (dir: string, base: string) => {
                    if (!fs.existsSync(dir)) return;
                    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                      if (f.name.startsWith('.') || f.name === '__pycache__') continue;
                      const rel = base ? `${base}/${f.name}` : f.name;
                      if (f.isDirectory()) {
                        scanDir(path.join(dir, f.name), rel);
                      } else {
                        files.push(rel);
                      }
                    }
                  };
                  scanDir(agentFolder, '');

                  // Try reading prompt.py
                  let promptContent = '';
                  const possiblePromptPaths = [
                    path.join(innerAppPath, 'prompt.py'),
                    path.join(agentFolder, 'prompt.py')
                  ];
                  for (const p of possiblePromptPaths) {
                    if (fs.existsSync(p)) {
                      promptContent = fs.readFileSync(p, 'utf8');
                      break;
                    }
                  }

                  // Try reading agent.py
                  let agentContent = '';
                  const possibleAgentPaths = [
                    path.join(innerAppPath, 'agent.py'),
                    path.join(agentFolder, 'agent.py')
                  ];
                  for (const p of possibleAgentPaths) {
                    if (fs.existsSync(p)) {
                      agentContent = fs.readFileSync(p, 'utf8');
                      break;
                    }
                  }

                  const stats = fs.statSync(agentFolder);

                  agents.push({
                    name: entry.name,
                    appName: appName,
                    path: agentFolder,
                    files,
                    promptPreview: promptContent.slice(0, 300),
                    hasAgentPy: agentContent.length > 0,
                    lastModified: stats.mtime
                  });
                }
              }
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ agents }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }

        // 4. GET /api/system/agents/:name/files
        if (url?.startsWith('/api/system/agents/') && url?.endsWith('/files') && req.method === 'GET') {
          try {
            const parts = url.split('/');
            const agentName = parts[4];
            const agentFolder = path.join(generatedAgentsDir, agentName);

            if (!fs.existsSync(agentFolder)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Agent ${agentName} not found` }));
              return;
            }

            const filesMap: Record<string, string> = {};
            const readRecursive = (dir: string, base: string) => {
              for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                if (f.name.startsWith('.') || f.name === '__pycache__') continue;
                const rel = base ? `${base}/${f.name}` : f.name;
                const full = path.join(dir, f.name);
                if (f.isDirectory()) {
                  readRecursive(full, rel);
                } else if (f.isFile() && (f.name.endsWith('.py') || f.name.endsWith('.txt') || f.name.endsWith('.json') || f.name.endsWith('.md'))) {
                  filesMap[rel] = fs.readFileSync(full, 'utf8');
                }
              }
            };
            readRecursive(agentFolder, '');

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ agentName, files: filesMap }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }

        // 5. POST /api/system/agents/:name/files (Update agent code on disk)
        if (url?.startsWith('/api/system/agents/') && url?.endsWith('/files') && req.method === 'POST') {
          try {
            const parts = url.split('/');
            const agentName = parts[4];
            const agentFolder = path.join(generatedAgentsDir, agentName);

            const bodyStr = await readBody(req);
            const { filePath, content } = JSON.parse(bodyStr || '{}');

            if (!filePath || typeof content !== 'string') {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'filePath and content are required' }));
              return;
            }

            // Prevent path traversal
            const resolvedPath = path.resolve(agentFolder, filePath);
            if (!resolvedPath.startsWith(path.resolve(agentFolder))) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Forbidden path' }));
              return;
            }

            fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
            fs.writeFileSync(resolvedPath, content, 'utf8');

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: `Updated ${filePath} successfully` }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }

        // 6. GET /api/system/agents/:name/env (Check specific agent's .env)
        if (url?.startsWith('/api/system/agents/') && url?.endsWith('/env') && req.method === 'GET') {
          try {
            const parts = url.split('/');
            const agentName = parts[4];
            const agentFolder = path.join(generatedAgentsDir, agentName);
            const agentEnvPath = path.join(agentFolder, '.env');

            let content = '';
            let agentEnvExists = false;
            if (fs.existsSync(agentEnvPath)) {
              content = fs.readFileSync(agentEnvPath, 'utf8');
              agentEnvExists = true;
            } else if (fs.existsSync(envPath)) {
              content = fs.readFileSync(envPath, 'utf8');
            }

            const googleKeyMatch = content.match(/^GOOGLE_API_KEY=(.*)$/m);
            const geminiKeyMatch = content.match(/^GEMINI_API_KEY=(.*)$/m);
            const geminiModelMatch = content.match(/^GEMINI_MODEL=(.*)$/m);
            const rawKey = (googleKeyMatch ? googleKeyMatch[1].trim() : '') || (geminiKeyMatch ? geminiKeyMatch[1].trim() : '');
            const model = geminiModelMatch ? geminiModelMatch[1].trim() : 'gemini-3.6-flash';

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              agentName,
              hasKey: rawKey.length > 0,
              apiKey: rawKey,
              model,
              agentEnvExists,
              envPath: `generated_agents/${agentName}/.env`
            }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }

        // 7. POST /api/system/agents/:name/env (Save specific agent's .env directly with zero LLM)
        if (url?.startsWith('/api/system/agents/') && url?.endsWith('/env') && req.method === 'POST') {
          try {
            const parts = url.split('/');
            const agentName = parts[4];
            const agentFolder = path.join(generatedAgentsDir, agentName);
            const agentEnvPath = path.join(agentFolder, '.env');

            if (!fs.existsSync(agentFolder)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Agent ${agentName} directory does not exist` }));
              return;
            }

            const bodyStr = await readBody(req);
            const { apiKey, model = 'gemini-3.6-flash' } = JSON.parse(bodyStr || '{}');

            if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Valid apiKey is required' }));
              return;
            }

            const cleanKey = apiKey.trim();
            const cleanModel = model.trim();

            const agentEnvContent = `# Agent-specific environment configuration\nGOOGLE_API_KEY=${cleanKey}\nGEMINI_API_KEY=${cleanKey}\nGEMINI_MODEL=${cleanModel}\n`;
            fs.writeFileSync(agentEnvPath, agentEnvContent, 'utf8');

            // Also ensure root .env has key if it was missing
            if (fs.existsSync(envPath)) {
              let rootEnv = fs.readFileSync(envPath, 'utf8');
              if (/^GOOGLE_API_KEY=/m.test(rootEnv)) {
                rootEnv = rootEnv.replace(/^GOOGLE_API_KEY=.*$/m, `GOOGLE_API_KEY=${cleanKey}`);
              } else {
                rootEnv = `GOOGLE_API_KEY=${cleanKey}\n` + rootEnv;
              }
              if (/^GEMINI_API_KEY=/m.test(rootEnv)) {
                rootEnv = rootEnv.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${cleanKey}`);
              } else {
                rootEnv = `GEMINI_API_KEY=${cleanKey}\n` + rootEnv;
              }
              fs.writeFileSync(envPath, rootEnv, 'utf8');
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              message: `Saved Google API key to generated_agents/${agentName}/.env without LLM interaction`,
              envPath: `generated_agents/${agentName}/.env`,
              hasKey: true
            }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), backendBridgePlugin()],
  server: {
    proxy: {
      // Command Center telemetry stream from server.py
      '/ws/telemetry': { target: `ws://${BACKEND}`, ws: true, changeOrigin: true },
      // Agent directory: chat with / delete any agent from the Builder chat (server.py)
      '/directory': {
        target: `http://${BACKEND}`,
        changeOrigin: true,
        configure: (proxy) => proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('origin', `http://${BACKEND}`)),
      },
      // Shared core-module registry and live office simulation (server.py)
      '/modules': {
        target: `http://${BACKEND}`,
        changeOrigin: true,
        // The ADK server rejects unknown origins (403); present the backend's own origin, as the ADK proxy above does.
        configure: (proxy) => proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('origin', `http://${BACKEND}`)),
      }
    }
  }
});
