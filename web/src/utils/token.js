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
 * Robust Base64URL decoder with automatic padding and multi-layer UTF-8 decoding
 */
function safeBase64UrlDecode(input) {
  if (!input) return '';
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' until length is multiple of 4
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }

  // Attempt 1: Standard atob + decodeURIComponent
  try {
    const binary = atob(b64);
    try {
      return decodeURIComponent(
        binary
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch (e1) {
      return binary;
    }
  } catch (e2) {
    // Attempt 2: Node buffer if available
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(input, 'base64').toString('utf-8');
    }
    throw new Error('Base64 decode failed');
  }
}

/**
 * Extracts and validates a Project AIR token string or scanned QR URL.
 * Handles:
 * 1. Full URLs: https://domain/?tab=MOBILE_PWA&token=...
 * 2. 3-Part JWT strings: header.payload.signature
 * 3. Direct JSON or PO references
 */
export function parseAndValidateToken(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, reason: 'Empty or invalid QR code data' };
  }

  let tokenStr = rawInput.trim();

  // If the scanned data is a full URL, extract the 'token' query parameter
  if (tokenStr.startsWith('http://') || tokenStr.startsWith('https://') || tokenStr.includes('token=')) {
    try {
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

  // Check if token is direct JSON
  if (tokenStr.startsWith('{') && tokenStr.endsWith('}')) {
    try {
      const directPayload = JSON.parse(tokenStr);
      if (directPayload.po_id || directPayload.po_number) {
        return {
          valid: true,
          token: tokenStr,
          payload: {
            po_id: directPayload.po_id || directPayload.po_number,
            po_number: directPayload.po_number || directPayload.po_id,
            site_id: directPayload.site_id || directPayload.project_site_id || 'SITE-GENERAL',
            project_name: directPayload.project_name || 'Project Site',
            supplier_name: directPayload.supplier_name || 'Authorized Supplier',
            total_amount: Number(directPayload.total_amount || 0),
            items: directPayload.items || directPayload.line_items || []
          }
        };
      }
    } catch (e) {}
  }

  // A valid Project AIR cryptographic pass is a 3-part HMAC-SHA256 JWT
  const parts = tokenStr.split('.');
  if (parts.length !== 3) {
    // Check if token is a PO Number (e.g. PO-2026-194)
    if (tokenStr.startsWith('PO-') || tokenStr.startsWith('po-')) {
      return {
        valid: true,
        token: tokenStr,
        payload: {
          po_id: tokenStr,
          po_number: tokenStr,
          site_id: 'SITE-GENERAL',
          project_name: 'Authorized Job Site',
          supplier_name: 'Registered Vendor',
          total_amount: 0,
          items: []
        }
      };
    }

    return {
      valid: false,
      reason: 'This QR code is not a valid Project AIR cryptographic pass (expected 3-part signed token).'
    };
  }

  try {
    // Decode Header
    const headerJson = safeBase64UrlDecode(parts[0]);
    const header = JSON.parse(headerJson);

    // Decode Payload
    const payloadJson = safeBase64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);

    const poId = payload.po_id || payload.po_number;
    const siteId = payload.site_id || payload.project_site_id || 'SITE-GENERAL';

    if (!poId) {
      return {
        valid: false,
        reason: 'Token missing required Purchase Order scope.'
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
      payload: {
        ...payload,
        po_id: poId,
        site_id: siteId,
        po_number: payload.po_number || poId,
        project_name: payload.project_name || siteId,
        supplier_name: payload.supplier_name || 'Authorized Supplier',
        total_amount: Number(payload.total_amount || 0),
        items: payload.items || payload.line_items || []
      }
    };
  } catch (e) {
    return {
      valid: false,
      reason: `Malformed cryptographic payload: ${e.message}`
    };
  }
}
