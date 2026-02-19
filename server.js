import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { validateRequest } from './validate.js';
import { callAnthropic } from './proxy.js';

dotenv.config();

const app = express();

// Fix for Render.com: Trust proxy for X-Forwarded-For headers
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!API_KEY) {
  throw new Error('ANTHROPIC_API_KEY not found in environment variables');
}

// Fix #3: CORS validation - fail fast in production if not set
if (!FRONTEND_ORIGIN) {
  console.warn('⚠️  FRONTEND_ORIGIN not set - using localhost (DEV ONLY)');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_ORIGIN must be set in production');
  }
}

// Fix #10: HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// Security middleware
app.use(helmet());
app.use(cors({ 
  origin: FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: false 
}));
app.use(express.json({ limit: '50kb' }));

// Fix #7: Error response helper
function errorResponse(message, status = 500, details = null) {
  return {
    error: {
      message,
      status,
      ...(details && { details })
    }
  };
}

// Fix #8: Security event logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      console.error(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    }
  });
  next();
});

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: errorResponse('Too many requests, please try again later', 429)
});

// Fix #4: Health endpoint rate limiter
const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: errorResponse('Too many health check requests', 429)
});

app.use('/api/', apiLimiter);

// Health check with rate limiting
app.get('/health', healthLimiter, (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate content endpoint
app.post('/api/generate', async (req, res) => {
  const validation = validateRequest(req.body);
  
  if (!validation.valid) {
    // Log what was rejected for debugging
    console.error('Validation failed:', validation.error, 'Body:', JSON.stringify(req.body));
    return res.status(400).json(errorResponse(validation.error, 400));
  }

  try {
    const result = await callAnthropic(API_KEY, req.body);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json(errorResponse(
      error.message || 'Failed to generate content',
      status,
      error.type
    ));
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json(errorResponse('Endpoint not found', 404));
});

// Fix #5: Server timeout configuration
const server = app.listen(PORT, () => {
  console.log(`✅ Proxy running on port ${PORT}`);
  console.log(`🔒 CORS allowed: ${FRONTEND_ORIGIN || 'http://localhost:3000'}`);
});

server.timeout = 35000; // 35s (5s more than Anthropic timeout)
