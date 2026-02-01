import express from 'express';
import { submitQuestionnaire, broadcastQuestion } from './questionnaire.js';
import {
  getSignageConfig,
  getSignageStats,
  updateSignageBackground,
  getSignageBackground,
  listSignageInstances,
  createSignageInstance,
  updateSignageInstance,
  deleteSignageInstance
} from './signage.js';
import { getUsers, getSessions, exportUsers, exportSessions } from './admin.js';
import { getValidationConfig, updateValidationConfig } from './validation.js';
import { generateToken, validateToken } from './tokens.js';
import {
  authMiddleware,
  requireSuperAdmin,
  requireAdminOrSuperAdmin,
  loginSuperAdmin,
  loginAdmin,
  verifyAuth,
  initiateGoogleAuth,
  googleAuthCallback
} from './auth.js';
import { setInstanceCredentials, getInstanceCredentials } from './credentials.js';

export function setupRoutes(app, basePath = '') {
  const router = express.Router();
  const apiPrefix = basePath ? basePath + '/api' : '/api';

  // Public routes (no auth)
  router.get('/token/generate', generateToken);
  router.get('/token/validate', validateToken);
  router.post('/submit-questionnaire', submitQuestionnaire);
  router.post('/questionnaire/broadcast-question', broadcastQuestion);
  router.get('/signage/:id', getSignageConfig);

  // Auth routes
  router.post('/auth/superadmin/login', loginSuperAdmin);
  router.post('/auth/admin/login', loginAdmin);
  router.get('/auth/google', initiateGoogleAuth);
  router.get('/auth/google/callback', googleAuthCallback);
  router.get('/auth/verify', authMiddleware, verifyAuth);

  // SuperAdmin-only routes
  router.get('/signage', authMiddleware, requireSuperAdmin, listSignageInstances);
  router.post('/signage', authMiddleware, requireSuperAdmin, createSignageInstance);
  router.delete('/signage/:id', authMiddleware, requireSuperAdmin, deleteSignageInstance);
  router.put('/signage/:id/credentials', authMiddleware, requireSuperAdmin, setInstanceCredentials);
  router.get('/signage/:id/credentials', authMiddleware, requireSuperAdmin, getInstanceCredentials);

  // Admin or SuperAdmin routes (instance-scoped)
  router.patch('/signage/:id', authMiddleware, requireAdminOrSuperAdmin('id'), updateSignageInstance);
  router.get('/signage/:id/stats', authMiddleware, requireAdminOrSuperAdmin('id'), getSignageStats);
  router.get('/signage/:id/background', authMiddleware, requireAdminOrSuperAdmin('id'), getSignageBackground);
  router.put('/signage/:id/background', authMiddleware, requireAdminOrSuperAdmin('id'), updateSignageBackground);

  router.get('/admin/users', authMiddleware, requireAdminOrSuperAdminQuery('signageId'), getUsers);
  router.get('/admin/sessions', authMiddleware, requireAdminOrSuperAdminQuery('signageId'), getSessions);
  router.get('/admin/export/users', authMiddleware, requireAdminOrSuperAdminQuery('signageId'), exportUsers);
  router.get('/admin/export/sessions', authMiddleware, requireAdminOrSuperAdminQuery('signageId'), exportSessions);

  router.get('/validation/:signageId', authMiddleware, requireAdminOrSuperAdmin('signageId'), getValidationConfig);
  router.put('/validation/:signageId', authMiddleware, requireAdminOrSuperAdmin('signageId'), updateValidationConfig);

  app.use(apiPrefix, router);
}

function requireAdminOrSuperAdminQuery(queryParam) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.auth.role === 'superadmin') return next();
    const signageId = req.query[queryParam];
    if (!signageId) {
      return res.status(400).json({ error: `${queryParam} required` });
    }
    if (req.auth.role === 'admin' && req.auth.signageId === signageId) return next();
    return res.status(403).json({ error: 'Access denied for this instance' });
  };
}
