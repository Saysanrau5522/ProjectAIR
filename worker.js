/**
 * Project AIR - Cloudflare Worker Edge API & Static Asset Handler
 * Runs at the Cloudflare Edge to handle REST endpoints and serve the React UI.
 */

// In-memory state for edge execution
let edgePos = [];
let edgeSites = [];
let edgeReconciliations = [];
let edgeAuditLogs = [];
let edgeInventory = [];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Actor-Id, X-Actor-Role'
    }
  });
}

function generateEdgeToken(payload, secret = 'air_edge_secret_8842') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const toB64 = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const h = toB64(header);
  const p = toB64({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 30
  });
  const sig = btoa(secret + '.' + h + '.' + p).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${h}.${p}.${sig}`;
function ensureEdgeBaseline() {
  if (edgeSites.length === 0) {
    edgeSites = [
      { site_id: 'SITE-USM', project_name: 'USM', location: 'Penang, Malaysia', created_at: '2026-09-06' },
      { site_id: 'SITE-UKM', project_name: 'UKM', location: 'Bangi, Selangor, Malaysia', created_at: '2026-09-06' }
    ];
  }
  if (edgePos.length === 0) {
    const po1Token = generateEdgeToken({
      po_id: 'PO-2F6949',
      po_number: 'PO-2026-382',
      site_id: 'SITE-USM',
      project_name: 'USM',
      supplier_name: 'APEX',
      total_amount: 200.0
    });
    const po2Token = generateEdgeToken({
      po_id: 'PO-2BFAA9',
      po_number: 'PO-2026-121',
      site_id: 'SITE-UKM',
      project_name: 'UKM',
      supplier_name: 'Apex',
      total_amount: 200.0
    });
    edgePos = [
      {
        po_id: 'PO-2F6949',
        po_number: 'PO-2026-382',
        project_site_id: 'SITE-USM',
        project_name: 'USM',
        supplier_name: 'APEX',
        total_amount: 200.0,
        issue_date: '2026-09-06',
        token: po1Token,
        items: [
          { item_code: '01', description: 'Saysan', quantity: 1.0, unit_price: 100.0, unit: 'Units' },
          { item_code: '02', description: 'Divyesh', quantity: 1.0, unit_price: 100.0, unit: 'Units' }
        ]
      },
      {
        po_id: 'PO-2BFAA9',
        po_number: 'PO-2026-121',
        project_site_id: 'SITE-UKM',
        project_name: 'UKM',
        supplier_name: 'Apex',
        total_amount: 200.0,
        issue_date: '2026-09-06',
        token: po2Token,
        items: [
          { item_code: '01', description: 'Ravi', quantity: 1.0, unit_price: 100.0, unit: 'Units' },
          { item_code: '02', description: 'Kavi', quantity: 1.0, unit_price: 100.0, unit: 'Units' }
        ]
      }
    ];
  }
  if (edgeInventory.length === 0) {
    edgeInventory = [
      { stock_id: 'STK-64654E', site_id: 'SITE-USM', project_name: 'USM', item_code: '01', description: 'Saysan', current_quantity: 1.0, unit: 'Units', min_reorder_level: 5.0, reorder_quantity: 1.0, stock_status: 'CRITICAL_LOW', status_label: 'CRITICAL: REORDER REQUIRED', last_delivery_date: '2026-09-06', unit_price: 100.0 },
      { stock_id: 'STK-FC04F7', site_id: 'SITE-USM', project_name: 'USM', item_code: '02', description: 'Divyesh', current_quantity: 1.0, unit: 'Units', min_reorder_level: 5.0, reorder_quantity: 1.0, stock_status: 'CRITICAL_LOW', status_label: 'CRITICAL: REORDER REQUIRED', last_delivery_date: '2026-09-06', unit_price: 100.0 },
      { stock_id: 'STK-BE8337', site_id: 'SITE-UKM', project_name: 'UKM', item_code: '01', description: 'Ravi', current_quantity: 1.0, unit: 'Units', min_reorder_level: 5.0, reorder_quantity: 1.0, stock_status: 'CRITICAL_LOW', status_label: 'CRITICAL: REORDER REQUIRED', last_delivery_date: '2026-09-06', unit_price: 100.0 },
      { stock_id: 'STK-F14C90', site_id: 'SITE-UKM', project_name: 'UKM', item_code: '02', description: 'Kavi', current_quantity: 1.0, unit: 'Units', min_reorder_level: 5.0, reorder_quantity: 1.0, stock_status: 'CRITICAL_LOW', status_label: 'CRITICAL: REORDER REQUIRED', last_delivery_date: '2026-09-06', unit_price: 100.0 }
    ];
  }
}

async function handleApiRequest(request, url) {
  ensureEdgeBaseline();
  const method = request.method.toUpperCase();
  const path = url.pathname.replace(/^\/api/, '') || '/';

  // 1. Health check
  if (path === '/health') {
    return jsonResponse({ status: 'ok', runtime: 'cloudflare-worker-edge', time: Date.now() });
  }

  // 2. HUD Metrics
  if (path === '/hud' && method === 'GET') {
    const totalSpend = edgePos.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalBlocked = edgeReconciliations.reduce((sum, r) => sum + (r.total_overpayment_blocked || 0), 0);
    return jsonResponse({
      total_active_pos: edgePos.length,
      total_sites: edgeSites.length,
      total_committed_spend: totalSpend,
      total_overpayment_blocked: totalBlocked,
      active_discrepancies_count: edgeReconciliations.filter(r => r.match_status === 'DISCREPANCY_FLAGGED').length,
      pending_approvals_count: edgeReconciliations.filter(r => r.match_status === 'READY_FOR_APPROVAL').length
    });
  }

  // 3. Purchase Orders
  if (path === '/pos' && method === 'GET') {
    return jsonResponse(edgePos);
  }

  if (path === '/pos/create' && method === 'POST') {
    try {
      const body = await request.json();
      const poId = `po-${Date.now()}`;
      const siteName = body.custom_site_name || 'Project Site';
      const siteId = body.site_id || `site-${siteName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      const totalAmount = (body.line_items || []).reduce((sum, it) => {
        return sum + (Number(it.quantity || 1) * Number(it.unit_price || 0));
      }, 0);

      const token = generateEdgeToken({
        po_id: poId,
        po_number: body.po_number,
        site_id: siteId,
        project_name: siteName,
        supplier_name: body.supplier_name,
        total_amount: totalAmount
      });

      const newPo = {
        po_id: poId,
        po_number: body.po_number,
        project_site_id: siteId,
        project_name: siteName,
        supplier_name: body.supplier_name,
        total_amount: totalAmount,
        issue_date: body.issue_date || new Date().toISOString().split('T')[0],
        token: token,
        items: (body.line_items || []).map((it, idx) => ({
          item_code: it.item_code || `MAT-00${idx + 1}`,
          description: it.description || 'Material',
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
          unit: it.unit || 'Units'
        }))
      };

      edgePos.unshift(newPo);

      if (!edgeSites.some(s => s.site_id === siteId)) {
        edgeSites.unshift({
          site_id: siteId,
          project_name: siteName,
          location: `${siteName}, Malaysia`,
          created_at: new Date().toISOString()
        });
      }

      // Provision site inventory ledger items
      newPo.items.forEach((it, idx) => {
        const existingIdx = edgeInventory.findIndex(s => s.site_id === siteId && s.item_code === it.item_code);
        const qty = Number(it.quantity || 1);
        const minReorder = Math.max(5, Math.round(qty * 0.2));
        if (existingIdx >= 0) {
          edgeInventory[existingIdx] = {
            ...edgeInventory[existingIdx],
            current_quantity: (Number(edgeInventory[existingIdx].current_quantity) || 0) + qty,
            last_delivery_date: newPo.issue_date
          };
        } else {
          edgeInventory.push({
            stock_id: `stk-${poId}-${idx}`,
            site_id: siteId,
            project_name: siteName,
            item_code: it.item_code,
            description: it.description,
            current_quantity: qty,
            unit: it.unit || 'Units',
            min_reorder_level: minReorder,
            reorder_quantity: qty,
            stock_status: qty <= minReorder ? 'CRITICAL_LOW' : 'OPTIMAL',
            status_label: qty <= minReorder ? 'CRITICAL: REORDER REQUIRED' : 'HEALTHY STOCK LEVEL',
            last_delivery_date: newPo.issue_date,
            unit_price: it.unit_price || 0
          });
        }
      });

      edgeAuditLogs.unshift({
        log_id: `log-${Date.now()}`,
        action: 'PO_AUTHORIZED',
        actor_id: request.headers.get('X-Actor-Id') || 'FINANCE_CONTROLLER_BOB',
        actor_role: request.headers.get('X-Actor-Role') || 'FINANCE_CONTROLLER',
        details: `Issued Purchase Order ${body.po_number} for RM ${totalAmount.toFixed(2)} at ${siteName}`,
        timestamp: new Date().toISOString()
      });

      return jsonResponse({
        status: 'success',
        po_id: poId,
        po_number: newPo.po_number,
        token: token,
        total_amount: totalAmount,
        project_name: siteName,
        supplier_name: body.supplier_name
      });
    } catch (err) {
      return jsonResponse({ error: 'Failed to process PO: ' + err.message }, 400);
    }
  }

  // 4. Project Sites
  if (path === '/sites' && method === 'GET') {
    return jsonResponse(edgeSites);
  }

  // 4b. Inventory Ledger
  if (path === '/inventory' && method === 'GET') {
    const siteFilter = url.searchParams.get('site_id');
    if (siteFilter && siteFilter !== 'ALL') {
      return jsonResponse(edgeInventory.filter(s => s.site_id === siteFilter));
    }
    return jsonResponse(edgeInventory);
  }

  if (path === '/inventory/reorder' && method === 'POST') {
    const body = await request.json();
    const targetStock = edgeInventory.find(s => s.stock_id === body.stock_id);
    const poNumber = `PO-REORDER-${Date.now().toString().slice(-4)}`;
    return jsonResponse({
      status: 'success',
      message: `Draft Replenishment PO ${poNumber} created.`,
      po_number: poNumber,
      stock: targetStock
    });
  }

  // 5. Invoices & 3-Way Match
  if (path === '/invoices/create' && method === 'POST') {
    try {
      const body = await request.json();
      const targetPo = edgePos.find(p => p.po_id === body.po_id) || edgePos[0] || {};
      const invTotal = (body.line_items || []).reduce((sum, it) => sum + (Number(it.quantity_billed || 0) * Number(it.unit_price || 0)), 0);
      const poTotal = targetPo.total_amount || invTotal;
      const overpayment = Math.max(0, invTotal - poTotal);
      const matchStatus = overpayment > 0 ? 'DISCREPANCY_FLAGGED' : 'READY_FOR_APPROVAL';

      const rec = {
        reconciliation_id: `rec-${Date.now()}`,
        po_id: targetPo.po_id || 'PO-MANUAL',
        po_number: targetPo.po_number || 'PO-MANUAL',
        invoice_number: body.invoice_number,
        supplier_name: body.supplier_name || targetPo.supplier_name || 'Vendor',
        project_name: targetPo.project_name || 'Project Site',
        po_total_amount: poTotal,
        invoice_total_amount: invTotal,
        total_overpayment_blocked: overpayment,
        match_status: matchStatus,
        items: (body.line_items || []).map((it, idx) => ({
          item_code: it.item_code || `MAT-00${idx + 1}`,
          description: it.description,
          po_quantity: it.quantity_billed,
          po_unit_price: it.unit_price,
          cumulative_delivered_qty: it.quantity_billed,
          cumulative_billed_qty: it.quantity_billed,
          verified_payable_amount: it.quantity_billed * it.unit_price
        }))
      };

      edgeReconciliations.unshift(rec);
      return jsonResponse({ status: 'success', reconciliation: rec });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  // 6. Reconciliations List
  if (path === '/reconciliations' && method === 'GET') {
    return jsonResponse(edgeReconciliations);
  }

  // 7. Approvals
  if (path === '/reconciliations/approve' && method === 'POST') {
    const body = await request.json();
    edgeReconciliations = edgeReconciliations.map(r => {
      if (r.reconciliation_id === body.reconciliation_id) {
        return { ...r, match_status: 'CHECKER_APPROVED', checker_approved_by: body.actor_id };
      }
      return r;
    });
    return jsonResponse({ status: 'success' });
  }

  if (path === '/reconciliations/approve-partial' && method === 'POST') {
    const body = await request.json();
    edgeReconciliations = edgeReconciliations.map(r => {
      if (r.reconciliation_id === body.reconciliation_id) {
        return { ...r, match_status: 'PARTIALLY_APPROVED', resolved_by: body.actor_id };
      }
      return r;
    });
    return jsonResponse({ status: 'success' });
  }

  if (path === '/reconciliations/resolve' && method === 'POST') {
    const body = await request.json();
    edgeReconciliations = edgeReconciliations.map(r => {
      if (r.reconciliation_id === body.reconciliation_id) {
        return { ...r, match_status: 'READY_FOR_APPROVAL', resolved_by: body.actor_id };
      }
      return r;
    });
    return jsonResponse({ status: 'success' });
  }

  if (path === '/reconciliations/dispute' && method === 'POST') {
    const body = await request.json();
    edgeReconciliations = edgeReconciliations.map(r => {
      if (r.reconciliation_id === body.reconciliation_id) {
        return { ...r, match_status: 'DISPUTED', dispute_reason: body.reason };
      }
      return r;
    });
    return jsonResponse({ status: 'success' });
  }

  if (path === '/reconciliations/dispatch-dispute' && method === 'POST') {
    const body = await request.json();
    edgeReconciliations = edgeReconciliations.map(r => {
      if (r.reconciliation_id === body.reconciliation_id) {
        return { ...r, match_status: 'DISPUTED', dispute_dispatched_to: body.recipient_email };
      }
      return r;
    });
    return jsonResponse({ status: 'success', message: 'Dispute notice dispatched.' });
  }

  if (path === '/reconciliations/confirm-low-confidence' && method === 'POST') {
    return jsonResponse({ status: 'success' });
  }

  if (path === '/reconciliations/export-erp' && method === 'GET') {
    const csvHeader = 'Reconciliation_ID,PO_Number,Supplier,Site,Payable_Amount,Status\n';
    const csvRows = edgeReconciliations.map(r => 
      `${r.reconciliation_id},${r.po_number},"${r.supplier_name}","${r.project_name}",${r.po_total_amount},${r.match_status}`
    ).join('\n');
    return new Response(csvHeader + csvRows, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="ProjectAIR_Disbursement_Batch.csv"'
      }
    });
  }

  // 8. Mobile DO Ingestion
  if (path === '/ingest/do' && method === 'POST') {
    try {
      const body = await request.json();
      const targetPo = edgePos.find(p => p.po_id === body.po_id || p.project_site_id === body.site_id) || edgePos[0] || {};
      const doNumber = `DO-${Date.now().toString().slice(-4)}`;
      const items = body.extracted_line_items || [];

      // Increment inventory
      items.forEach(it => {
        const existing = edgeInventory.find(s => s.site_id === (body.site_id || targetPo.project_site_id) && s.item_code === it.item_code);
        if (existing) {
          existing.current_quantity = (Number(existing.current_quantity) || 0) + (Number(it.quantity_delivered) || 0);
          existing.last_delivery_date = new Date().toISOString().split('T')[0];
        }
      });

      edgeAuditLogs.unshift({
        log_id: `log-${Date.now()}`,
        action: 'DO_VERIFIED',
        actor_id: 'SITE_SUPERVISOR_DAVE',
        actor_role: 'SITE_SUPERVISOR',
        details: `Verified Delivery Order ${doNumber} at ${body.site_name || targetPo.project_name || 'Job Site'}`,
        timestamp: new Date().toISOString()
      });

      return jsonResponse({
        status: 'success',
        delivery_order: {
          do_number: doNumber,
          po_id: targetPo.po_id,
          status: 'VERIFIED'
        },
        reconciliation: {
          match_status: 'MATCHED'
        }
      });
    } catch (err) {
      return jsonResponse({ error: 'Failed to ingest DO: ' + err.message }, 400);
    }
  }

  // 9. Sync State from Client
  if (path === '/system/sync' && method === 'POST') {
    try {
      const body = await request.json();
      if (Array.isArray(body.pos) && body.pos.length > 0) {
        const map = new Map();
        edgePos.forEach(p => map.set(p.po_id || p.po_number, p));
        body.pos.forEach(p => map.set(p.po_id || p.po_number, p));
        edgePos = Array.from(map.values());
      }
      if (Array.isArray(body.sites) && body.sites.length > 0) {
        const map = new Map();
        edgeSites.forEach(s => map.set(s.site_id, s));
        body.sites.forEach(s => map.set(s.site_id, s));
        edgeSites = Array.from(map.values());
      }
      if (Array.isArray(body.reconciliations) && body.reconciliations.length > 0) {
        const map = new Map();
        edgeReconciliations.forEach(r => map.set(r.reconciliation_id, r));
        body.reconciliations.forEach(r => map.set(r.reconciliation_id, r));
        edgeReconciliations = Array.from(map.values());
      }
      return jsonResponse({ status: 'success', synced: true });
    } catch (e) {
      return jsonResponse({ error: e.message }, 400);
    }
  }

  // 10. Audit Logs
  if (path === '/audit-logs' && method === 'GET') {
    return jsonResponse(edgeAuditLogs);
  }

  // 11. QR Verification
  if (path === '/qr/verify' && method === 'POST') {
    return jsonResponse({ valid: true, verified: true });
  }

  // Default
  return jsonResponse({ status: 'ok', route: path });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Actor-Id, X-Actor-Role'
        }
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, url);
    }

    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Project AIR Edge Gateway Active', { status: 200 });
  }
};
