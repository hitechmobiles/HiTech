/**
 * HiTech Enterprise Attack Shield & Threat Protection Middleware
 * - DDoS Burst Detection & Auto-Jail (IP Blocking)
 * - Sliding Window Rate Limiting
 * - WAF Signature Inspection (SQLi, XSS, Path Traversal)
 * - Bot & Honeypot Trap Detection
 * - Body Payload Size & Memory Guard
 * - Observability & Vercel Structured Security Logging
 */

// In-memory sliding window trackers (persists across warm serverless execution)
const ipRequestWindow = new Map(); // ip -> array of timestamps
const jailedIps = new Map();        // ip -> unban timestamp

// Configurable constants
const RATE_LIMIT_WINDOW_MS = 60 * 1000;     // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 15;        // 15 requests / minute
const BURST_LIMIT = 8;                     // max 8 requests in 3 seconds triggers jail
const BURST_WINDOW_MS = 3 * 1000;
const JAIL_DURATION_MS = 15 * 60 * 1000;    // 15 minutes IP block on attack / burst
const MAX_PAYLOAD_SIZE_BYTES = 64 * 1024;  // 64 KB max payload size to prevent ReDoS

// Known malicious user agent signatures
const MALICIOUS_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /nessus/i,
  /masscan/i,
  /nmap/i,
  /wpscan/i,
  /zgrab/i,
  /dirbuster/i
];

// Attack patterns (SQLi, XSS, Path Traversal)
const ATTACK_PATTERNS = [
  /(\bunion\s+select\b|\bselect\s+.*\s+from\b|\bdrop\s+table\b|\binsert\s+into\b)/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /(javascript:|data:text\/html|vbscript:)/i,
  /(<iframe|<object|<embed|<applet)/i,
  /(\.\.\/|\.\.%2f|\.\.\\|\.\.%5c)/i,
  /(\/etc\/passwd|\/etc\/shadow|c:\\windows\\system32)/i
];

/**
 * Extracts client IP from standard proxy headers
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Anonymizes IP for privacy-compliant logging
 */
function maskIp(ip) {
  if (!ip) return 'unknown';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.***.***` : ip;
  }
  return ip.substring(0, 8) + ':****';
}

/**
 * Structured security logging compatible with Vercel Log Drains
 */
function logSecurityEvent(event, req, details = {}) {
  const ip = getClientIp(req);
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: 'HiTech-Security-Shield',
    event,
    clientIp: maskIp(ip),
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'] || 'unknown',
    ...details
  };
  console.warn(`[SECURITY] ${JSON.stringify(logEntry)}`);
}

/**
 * Recursively scans object values for malicious attack patterns
 */
function inspectPayloadForAttacks(obj) {
  if (!obj) return null;
  if (typeof obj === 'string') {
    for (const pattern of ATTACK_PATTERNS) {
      if (pattern.test(obj)) {
        return pattern.toString();
      }
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const val of Object.values(obj)) {
      const match = inspectPayloadForAttacks(val);
      if (match) return match;
    }
  }
  return null;
}

/**
 * Core Security Shield Middleware
 * Returns { allowed: true } or { allowed: false, status: number, error: string }
 */
function checkSecurity(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const userAgent = req.headers['user-agent'] || '';

  // 1. Set Enterprise Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Defense-Shield', 'HiTech-Active-Protect');

  // 2. Check Static Blocklist from environment
  const envBlocked = (process.env.BLOCKED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (envBlocked.includes(ip)) {
    logSecurityEvent('BLOCKED_STATIC_IP', req, { reason: 'Permanent IP Blocklist' });
    return {
      allowed: false,
      status: 403,
      error: 'Access Denied: Your IP address is blocked by HiTech Security Policy.'
    };
  }

  // 3. Check Dynamic Jail / DDoS ban
  if (jailedIps.has(ip)) {
    const unbanAt = jailedIps.get(ip);
    if (now < unbanAt) {
      const remainingSec = Math.ceil((unbanAt - now) / 1000);
      res.setHeader('Retry-After', remainingSec);
      logSecurityEvent('BLOCKED_JAILED_IP', req, { remainingSeconds: remainingSec });
      return {
        allowed: false,
        status: 403,
        error: `Access Temporarily Suspended: High threat activity detected. Retry in ${remainingSec} seconds.`
      };
    } else {
      jailedIps.delete(ip); // Ban expired
    }
  }

  // 4. Scanner / Exploit User-Agent Detection
  for (const botPattern of MALICIOUS_AGENTS) {
    if (botPattern.test(userAgent)) {
      jailedIps.set(ip, now + JAIL_DURATION_MS);
      logSecurityEvent('BLOCKED_MALICIOUS_AGENT', req, { agent: userAgent });
      return {
        allowed: false,
        status: 403,
        error: 'Forbidden: Automated security scanning tool detected.'
      };
    }
  }

  // 5. Sliding-Window Rate Limiting & Burst Protection
  const timestamps = (ipRequestWindow.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  ipRequestWindow.set(ip, timestamps);

  // Check aggressive burst (DDoS signature)
  const recentBurstCount = timestamps.filter(t => now - t < BURST_WINDOW_MS).length;
  if (recentBurstCount > BURST_LIMIT) {
    jailedIps.set(ip, now + JAIL_DURATION_MS);
    logSecurityEvent('BLOCKED_DDOS_BURST', req, { burstCount: recentBurstCount });
    return {
      allowed: false,
      status: 403,
      error: 'Threat Protection Triggered: Abnormal request burst detected. IP address temporarily blocked.'
    };
  }

  // Standard rate limit check
  if (timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', 0);
    logSecurityEvent('RATE_LIMITED', req, { requestCount: timestamps.length, retryAfter });
    return {
      allowed: false,
      status: 429,
      error: `Too Many Requests: Rate limit exceeded (${MAX_REQUESTS_PER_WINDOW}/min). Please retry after ${retryAfter} seconds.`
    };
  }

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_WINDOW - timestamps.length));

  // 6. Payload Inspection on POST/PUT requests
  if (req.method === 'POST' || req.method === 'PUT') {
    const bodyStr = JSON.stringify(req.body || '');
    if (bodyStr.length > MAX_PAYLOAD_SIZE_BYTES) {
      logSecurityEvent('BLOCKED_OVERSIZED_PAYLOAD', req, { size: bodyStr.length });
      return {
        allowed: false,
        status: 413,
        error: 'Payload Too Large: Maximum allowed payload is 64KB.'
      };
    }

    // Check honeypot field
    if (req.body && (req.body._hp_trap || req.body.bot_trap || req.body.company_fax)) {
      logSecurityEvent('BOT_HONEYPOT_TRIGGERED', req);
      return {
        allowed: false,
        status: 400,
        error: 'Invalid submission detected.'
      };
    }

    // Inspect content for SQLi / XSS injection
    const attackFound = inspectPayloadForAttacks(req.body);
    if (attackFound) {
      jailedIps.set(ip, now + JAIL_DURATION_MS);
      logSecurityEvent('ATTACK_SIGNATURE_DETECTED', req, { pattern: attackFound });
      return {
        allowed: false,
        status: 403,
        error: 'Malicious input signature detected. Request blocked by Web Application Firewall.'
      };
    }
  }

  return { allowed: true };
}

module.exports = {
  checkSecurity,
  getClientIp,
  logSecurityEvent
};

