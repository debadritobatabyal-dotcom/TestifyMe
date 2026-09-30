/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Local dev server cross-window test and attempt synchronization middleware
function testSyncPlugin() {
  const testsStore = new Map<string, any>();
  const testAccessStore = new Map<string, any>();
  const attemptsStore = new Map<string, any>();
  const usersStore = new Map<string, any>();

  return {
    name: 'test-sync-server',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // Test Access Lookup
        if (pathname.startsWith('/api/test-access/')) {
          const code = decodeURIComponent(pathname.replace('/api/test-access/', '')).trim().toUpperCase();
          res.setHeader('Content-Type', 'application/json');
          const found = testAccessStore.get(code);
          if (found) {
            res.statusCode = 200;
            res.end(JSON.stringify(found));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Test code not found' }));
          }
          return;
        }

        if (pathname === '/api/test-access' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data && (data.testCode || data.accessCode)) {
                const code = (data.testCode || data.accessCode).trim().toUpperCase();
                testAccessStore.set(code, data);
              }
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // Full Test by Code
        if (pathname.startsWith('/api/tests/code/')) {
          const code = decodeURIComponent(pathname.replace('/api/tests/code/', '')).trim().toUpperCase();
          res.setHeader('Content-Type', 'application/json');
          let found: any = null;
          for (const t of testsStore.values()) {
            if (
              (t.testCode && t.testCode.toUpperCase() === code) ||
              (t.accessCode && t.accessCode.toUpperCase() === code) ||
              t.id.toUpperCase() === code
            ) {
              found = t;
              break;
            }
          }
          if (found) {
            res.statusCode = 200;
            res.end(JSON.stringify(found));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Test not found' }));
          }
          return;
        }

        // Full Test by ID
        if (pathname.startsWith('/api/tests/') && !pathname.startsWith('/api/tests/code/')) {
          const id = decodeURIComponent(pathname.replace('/api/tests/', '')).trim();
          res.setHeader('Content-Type', 'application/json');
          const found = testsStore.get(id);
          if (found) {
            res.statusCode = 200;
            res.end(JSON.stringify(found));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Test not found' }));
          }
          return;
        }

        // Attempts Lookup and Creation
        if (pathname.startsWith('/api/attempts/')) {
          const id = decodeURIComponent(pathname.replace('/api/attempts/', '')).trim();
          res.setHeader('Content-Type', 'application/json');
          const found = attemptsStore.get(id);
          if (found) {
            res.statusCode = 200;
            res.end(JSON.stringify(found));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Attempt not found' }));
          }
          return;
        }

        if (pathname === '/api/attempts') {
          res.setHeader('Content-Type', 'application/json');
          if (req.method === 'GET') {
            const testId = parsedUrl.searchParams.get('testId');
            const studentId = parsedUrl.searchParams.get('studentId');
            const teacherId = parsedUrl.searchParams.get('teacherId');
            let list = Array.from(attemptsStore.values());
            if (testId) list = list.filter(a => a.testId === testId);
            if (studentId) list = list.filter(a => a.studentId === studentId);
            if (teacherId) list = list.filter(a => a.ownerId === teacherId);
            res.statusCode = 200;
            res.end(JSON.stringify(list));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try {
                const attempt = JSON.parse(body);
                if (attempt && attempt.id) {
                  attemptsStore.set(attempt.id, attempt);
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, id: attempt?.id }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        // Users Lookup and Creation
        if (pathname.startsWith('/api/users/')) {
          const uid = decodeURIComponent(pathname.replace('/api/users/', '')).trim();
          res.setHeader('Content-Type', 'application/json');
          const found = usersStore.get(uid);
          if (found) {
            res.statusCode = 200;
            res.end(JSON.stringify(found));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'User not found' }));
          }
          return;
        }

        if (pathname === '/api/users' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const u = JSON.parse(body);
              if (u && u.id) {
                usersStore.set(u.id, u);
              }
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // Test Sync
        if (pathname === '/api/test-sync') {
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'GET') {
            res.statusCode = 200;
            res.end(JSON.stringify({
              tests: Array.from(testsStore.values()),
              testAccess: Array.from(testAccessStore.entries()),
              attempts: Array.from(attemptsStore.values()),
            }));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                if (Array.isArray(data.tests)) {
                  data.tests.forEach((t: any) => {
                    testsStore.set(t.id, t);
                    const code = (t.testCode || t.accessCode || '').trim().toUpperCase();
                    if (code) {
                      testAccessStore.set(code, {
                        testId: t.id,
                        testCode: code,
                        accessCode: code,
                        name: t.name,
                        description: t.description,
                        status: t.status,
                        durationMinutes: t.durationMinutes,
                        startTime: t.startTime,
                        endTime: t.endTime,
                        totalQuestions: t.totalQuestions,
                        assertionReasonCount: t.assertionReasonCount,
                        mcqCount: t.mcqCount,
                        positiveMarks: t.positiveMarks,
                        negativeMarkingEnabled: t.negativeMarkingEnabled,
                        negativeMarks: t.negativeMarks,
                        ownerId: t.ownerId || t.createdBy,
                        createdAt: t.createdAt,
                      });
                    }
                  });
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, count: testsStore.size }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), testSyncPlugin()],
  server: {
    port: 5173,
    host: true
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});

