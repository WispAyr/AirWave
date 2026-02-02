/**
 * Authentication Middleware for Admin Routes
 * Validates bearer tokens against ADMIN_TOKEN environment variable
 */

const authenticate = (req, res, next) => {
  const adminToken = process.env.ADMIN_TOKEN;
  
  // If no admin token is configured, deny access in production
  if (!adminToken) {
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️  ADMIN_TOKEN not configured - denying admin access');
      return res.status(503).json({ 
        error: 'Admin authentication not configured',
        message: 'Please configure ADMIN_TOKEN environment variable'
      });
    } else {
      // In development, log warning but allow access
      console.warn('⚠️  ADMIN_TOKEN not configured - allowing access in development mode');
      return next();
    }
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide Authorization header with Bearer token'
    });
  }

  // Expect "Bearer <token>" format
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ 
      error: 'Invalid authentication format',
      message: 'Use "Authorization: Bearer <token>" format'
    });
  }

  const token = parts[1];

  // Validate token
  if (token !== adminToken) {
    console.warn(`❌ Invalid admin token attempt from ${req.ip}`);
    return res.status(403).json({ 
      error: 'Invalid credentials',
      message: 'The provided token is not valid'
    });
  }

  // Token is valid, proceed
  console.log(`✅ Admin authenticated from ${req.ip}`);
  next();
};

module.exports = { authenticate };

