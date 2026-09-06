/**
 * Project AIR Client-Side Token & URL Utility
 * Validates cryptographic gate passes and decodes payload metadata.
 */

export function getApiBase() {
  if (typeof window !== 'undefined') {
    if (import.meta.env.VITE_API_BASE) {
      return import.meta.env.VITE_API_BASE;
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:8000/api';
}

/**
 * Extracts and validates a Project AIR token string or scanned QR URL.
 * Rejects invalid, non-JWT, or random internet QR codes.
 */
export function parseAndValidateToken(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, reason: 'Empty or invalid QR code data' };
  }

  let tokenStr = rawInput.trim();

  // If the scanned data is a full URL, extract the 'token' query parameter
  if (tokenStr.startsWith('http://') || tokenStr.startsWith('https://') || tokenStr.includes('token=')) {
    try {
      // Try URL parser
      const urlObj = new URL(tokenStr.startsWith('http') ? tokenStr : `http://dummy.com/${tokenStr}`);
      const param = urlObj.searchParams.get('token');
      if (param) {
        tokenStr = param.trim();
      }
    } catch (err) {
      const match = tokenStr.match(/[?&]token=([^&]+)/);
      if (match) {
        tokenStr = decodeURIComponent(match[1]).trim();
      }
    }
  }

  // A valid Project AIR cryptographic pass is a 3-part HMAC-SHA256 JWT
  const parts = tokenStr.split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      reason: 'This QR code is not a valid Project AIR cryptographic pass (expected 3-part signed token).'
    };
  }

  try {
    // Decode Header
    const headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const headerJson = decodeURIComponent(atob(headerB64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const header = JSON.parse(headerJson);

    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return { valid: false, reason: 'Invalid token header algorithm.' };
    }

    // Decode Payload
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = decodeURIComponent(atob(payloadB64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payload = JSON.parse(payloadJson);

    if (!payload.po_id || !payload.site_id) {
      return {
        valid: false,
        reason: 'Token missing required PO or Project Site scope.'
      };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        expired: true,
        reason: `Pass expired on ${new Date(payload.exp * 1000).toLocaleDateString()}`
      };
    }

    return {
      valid: true,
      token: tokenStr,
      payload
    };
  } catch (e) {
    return {
      valid: false,
      reason: 'Malformed cryptographic payload or failed decoding.'
    };
  }
}
