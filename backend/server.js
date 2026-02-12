import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { setupRoutes } from './routes/index.js';
import { setupWebSocket } from './websocket/server.js';
import { initDatabase } from './database/init.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend builds (only if they exist)
const mobileFormDist = join(__dirname, '../mobile-form/dist');
const signageDist = join(__dirname, '../signage-display/dist');
const adminDist = join(__dirname, '../admin-dashboard/dist');

const p = (path) => BASE_PATH ? `${BASE_PATH}${path}` : path;

const staticOpts = { fallthrough: true };

if (existsSync(mobileFormDist)) {
  app.use(p('/play'), express.static(mobileFormDist, staticOpts));
}
if (existsSync(signageDist)) {
  app.use(p('/signage'), express.static(signageDist, staticOpts));
}
if (existsSync(adminDist)) {
  app.use(p('/admin'), express.static(adminDist, staticOpts));
} else {
  console.log('⚠️  Admin dashboard not built. Run: cd admin-dashboard && npm install && npm run build');
}

// SPA fallback routes (must come before router so /questionnaire/play doesn't hit /questionnaire router)
const servePlay = (req, res) => {
  const f = join(__dirname, '../mobile-form/dist/index.html');
  if (existsSync(f)) res.sendFile(f);
  else res.status(503).send('Mobile form not built.');
};
const serveSignage = (req, res) => {
  const f = join(__dirname, '../signage-display/dist/index.html');
  if (existsSync(f)) res.sendFile(f);
  else res.status(503).send('Signage display not built.');
};
const serveAdmin = (req, res) => {
  const f = join(__dirname, '../admin-dashboard/dist/index.html');
  if (existsSync(f)) res.sendFile(f);
  else res.status(503).send('Admin dashboard not built.');
};

app.get(p('/play'), servePlay);
app.get(p('/play') + '/*', servePlay);
app.get(p('/signage'), serveSignage);
app.get(p('/signage') + '/*', serveSignage);
app.get(p('/admin'), serveAdmin);
app.get(p('/admin') + '/*', serveAdmin);
app.get(p('/superadmin'), serveAdmin);
app.get(p('/superadmin') + '/*', serveAdmin);
app.get(p('/admin/super'), serveAdmin);

// Redirect /questionnaire to /questionnaire/signage
if (BASE_PATH) {
  app.get(BASE_PATH, (req, res) => res.redirect(301, BASE_PATH + '/signage'));
  app.get(BASE_PATH + '/', (req, res) => res.redirect(301, BASE_PATH + '/signage'));
}

// Routes (API, etc.) - router only handles /questionnaire/api/*
setupRoutes(app, BASE_PATH);

// WebSocket Server
const wss = new WebSocketServer({ server });
setupWebSocket(wss);

// Initialize database (non-blocking)
initDatabase().then(() => {
  console.log('✅ Database initialized successfully');
}).catch(err => {
  console.error('⚠️  Database initialization failed:', err.message);
  console.error('⚠️  Server will start but database features will be unavailable');
  console.error('⚠️  To fix: Install PostgreSQL and create database "questionnaire"');
});

// Start server regardless of database status
server.listen(PORT, () => {
  const base = BASE_PATH || '';
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Mobile form: http://localhost:${PORT}${base}/play`);
  console.log(`🖥️  Signage display: http://localhost:${PORT}${base}/signage`);
  console.log(`📊 Admin dashboard: http://localhost:${PORT}${base}/admin`);
});
