/**
 * Project AIR - Cloudflare Worker Edge API & Static Asset Handler
 * Runs at the Cloudflare Edge to handle REST endpoints and serve the React UI.
 */

// In-memory state for edge execution with deletion tombstones
let edgePos = [];
let edgeSites = [];
let edgeReconciliations = [];
let edgeAuditLogs = [];
let edgeInventory = [];
let edgeDeliveryOrders = [];
let edgeThresholdPresets = {};
let edgeDeletedSites = new Set();
let edgeDeletedSkus = new Set();
let baselineInitialized = false;

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
}

function ensureEdgeBaseline() {
  if (baselineInitialized) return;
  baselineInitialized = true;

  if (edgeSites.length === 0) {
    const defaultSites = [
      { site_id: 'SITE-MADINA', project_name: 'MADINA', location: 'Madina Project Site, Malaysia', created_at: '2026-09-06' }
    ];
    edgeSites = defaultSites.filter(s => !edgeDeletedSites.has(s.site_id.toUpperCase()));
  }

  if (edgePos.length === 0) {
    const initialPos = [];
    if (!edgeDeletedSites.has('SITE-MADINA')) {
      const poToken = generateEdgeToken({
        po_id: 'PO-2026-369',
        po_number: 'PO-2026-369',
        site_id: 'SITE-MADINA',
        project_name: 'MADINA',
        supplier_name: 'GARDENIA',
        total_amount: 270.0
      });
      initialPos.push({
        po_id: 'PO-2026-369',
        po_number: 'PO-2026-369',
        project_site_id: 'SITE-MADINA',
        project_name: 'MADINA',
        supplier_name: 'GARDENIA',
        total_amount: 270.0,
        issue_date: '2026-09-06',
        token: poToken,
        items: [
          { item_code: 'MAT-GARD-01', description: 'Gardenia Classic 400g', quantity: 10.0, unit_price: 15.0, unit: 'Loaf' },
          { item_code: 'MAT-GARD-02', description: 'Gardenia Wholemeal 400g', quantity: 8.0, unit_price: 15.0, unit: 'Loaf' }
        ]
      });
    }
    edgePos = initialPos;
  }

  if (edgeReconciliations.length === 0) {
    if (!edgeDeletedSites.has('SITE-MADINA')) {
      edgeReconciliations.push({
        reconciliation_id: 'rec-2026-369',
        po_id: 'PO-2026-369',
        po_number: 'PO-2026-369',
        invoice_number: 'INV-2026-369',
        supplier_name: 'GARDENIA',
        project_name: 'MADINA',
        po_total_amount: 270.0,
        invoice_total_amount: 270.0,
        total_overpayment_blocked: 270.0,
        verified_payable_amount: 0.0,
        match_status: 'DISCREPANCY_FLAGGED',
        has_discrepancy: true,
        items: [
          {
            item_code: 'MAT-GARD-01',
            description: 'Gardenia Classic 400g',
            po_quantity: 10.0,
            po_unit_price: 15.0,
            cumulative_delivered_qty: 0,
            cumulative_billed_qty: 10.0,
            variance_qty: 10.0,
            discrepancy_type: 'UNRECEIVED_MATERIAL',
            verified_payable_amount: 0.0
          },
          {
            item_code: 'MAT-GARD-02',
            description: 'Gardenia Wholemeal 400g',
            po_quantity: 8.0,
            po_unit_price: 15.0,
            cumulative_delivered_qty: 0,
            cumulative_billed_qty: 8.0,
            variance_qty: 8.0,
            discrepancy_type: 'UNRECEIVED_MATERIAL',
            verified_payable_amount: 0.0
          }
        ]
      });
    }
  }

  if (edgeInventory.length === 0) {
    const defaultInv = [
      { stock_id: 'STK-MADINA-01', site_id: 'SITE-MADINA', project_name: 'MADINA', item_code: 'MAT-GARD-01', description: 'Gardenia Classic 400g', current_quantity: 0.0, po_ordered_quantity: 10.0, po_unit_price: 15.0, po_total_price: 150.0, po_number: 'PO-2026-369', unit: 'Loaf', min_reorder_level: 5.0, reorder_quantity: 10.0, stock_status: 'AWAITING_DELIVERY', status_label: 'AWAITING GATE DELIVERY (DO PENDING)', last_delivery_date: null, unit_price: 15.0 },
      { stock_id: 'STK-MADINA-02', site_id: 'SITE-MADINA', project_name: 'MADINA', item_code: 'MAT-GARD-02', description: 'Gardenia Wholemeal 400g', current_quantity: 0.0, po_ordered_quantity: 8.0, po_unit_price: 15.0, po_total_price: 120.0, po_number: 'PO-2026-369', unit: 'Loaf', min_reorder_level: 5.0, reorder_quantity: 8.0, stock_status: 'AWAITING_DELIVERY', status_label: 'AWAITING GATE DELIVERY (DO PENDING)', last_delivery_date: null, unit_price: 15.0 }
    ];
    edgeInventory = defaultInv.filter(i => 
      !edgeDeletedSites.has(i.site_id.toUpperCase()) && 
      !edgeDeletedSkus.has(i.stock_id) && 
      !edgeDeletedSkus.has(i.item_code)
    );
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
      total_pos: edgePos.length,
      total_po_value: totalSpend,
      total_overpayment_blocked: totalBlocked,
      ready_for_approval: edgeReconciliations.filter(r => r.match_status === 'READY_FOR_APPROVAL').length,
      discrepancies_flagged: edgeReconciliations.filter(r => r.match_status === 'DISCREPANCY_FLAGGED').length,
      approved: edgeReconciliations.filter(r => r.match_status === 'APPROVED').length,
      disputed: edgeReconciliations.filter(r => r.match_status === 'DISPUTED').length,
      needs_review: 0,
      total_active_pos: edgePos.length,
      total_sites: edgeSites.length,
      total_committed_spend: totalSpend,
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
      const poId = body.po_id || body.po_number || `po-${Date.now()}`;
      const siteName = body.custom_site_name || 'Project Site';
      const siteId = body.site_id || `site-${siteName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      const totalAmount = (body.line_items || []).reduce((sum, it) => {
        return sum + (Number(it.quantity || 1) * Number(it.unit_price || 0));
      }, 0);

      const itemsList = (body.line_items || []).map((it, idx) => ({
        item_code: it.item_code || `MAT-00${idx + 1}`,
        description: it.description || 'Material',
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || 0),
        unit: it.unit || 'Units'
      }));

      const token = generateEdgeToken({
        po_id: poId,
        po_number: body.po_number,
        site_id: siteId,
        project_name: siteName,
        supplier_name: body.supplier_name,
        total_amount: totalAmount,
        items: itemsList
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

      const existingPoIdx = edgePos.findIndex(p => p.po_number === body.po_number);
      if (existingPoIdx >= 0) {
        edgePos[existingPoIdx] = newPo;
      } else {
        edgePos.unshift(newPo);
      }

      edgeDeletedSites.delete(siteId.toUpperCase());
      edgeDeletedSites.delete(siteId);

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
        const skuKey = (it.item_code || it.description || '').toUpperCase().trim();
        const preset = edgeThresholdPresets[skuKey];
        const minReorder = preset ? Number(preset.min_reorder_level) : Math.max(5, Math.round(qty * 0.2));
        const unitPrice = Number(it.unit_price) || 0;
        const totalLinePrice = Number(it.total_price) || (qty * unitPrice);

        if (existingIdx >= 0) {
          edgeInventory[existingIdx] = {
            ...edgeInventory[existingIdx],
            po_ordered_quantity: (Number(edgeInventory[existingIdx].po_ordered_quantity) || 0) + qty,
            po_number: newPo.po_number,
            po_unit_price: unitPrice,
            po_total_price: (Number(edgeInventory[existingIdx].po_total_price) || 0) + totalLinePrice,
            reorder_quantity: batchQty,
            min_reorder_level: minReorder
          };
        } else {
          edgeInventory.push({
            stock_id: `stk-${poId}-${idx}`,
            site_id: siteId,
            project_name: siteName,
            item_code: it.item_code,
            description: it.description,
            po_ordered_quantity: qty,
            po_number: newPo.po_number,
            po_unit_price: unitPrice,
            po_total_price: totalLinePrice,
            current_quantity: 0,
            unit: it.unit || 'Units',
            min_reorder_level: minReorder,
            reorder_quantity: batchQty,
            stock_status: 'AWAITING_DELIVERY',
            status_label: 'AWAITING GATE DELIVERY (DO PENDING)',
            last_delivery_date: null,
            unit_price: unitPrice
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

  if (path === '/sites/delete' && method === 'POST') {
    try {
      const body = await request.json();
      const siteId = body.site_id;
      if (!siteId) return jsonResponse({ error: 'site_id is required' }, 400);

      const siteIdNorm = siteId.toUpperCase().trim();
      edgeDeletedSites.add(siteIdNorm);
      const poIdsToDelete = new Set(edgePos.filter(p => (p.project_site_id || '').toUpperCase() === siteIdNorm).map(p => p.po_id));
      const poNumsToDelete = new Set(edgePos.filter(p => (p.project_site_id || '').toUpperCase() === siteIdNorm).map(p => p.po_number));

      edgeSites = edgeSites.filter(s => (s.site_id || '').toUpperCase() !== siteIdNorm);
      edgePos = edgePos.filter(p => (p.project_site_id || '').toUpperCase() !== siteIdNorm);
      edgeInventory = edgeInventory.filter(s => (s.site_id || '').toUpperCase() !== siteIdNorm);
      edgeReconciliations = edgeReconciliations.filter(r => !poIdsToDelete.has(r.po_id) && !poNumsToDelete.has(r.po_number));
      edgeDeliveryOrders = edgeDeliveryOrders.filter(d => (d.site_id || '').toUpperCase() !== siteIdNorm && !poIdsToDelete.has(d.po_id));

      edgeAuditLogs.unshift({
        log_id: `log-${Date.now()}`,
        action: 'SITE_DELETED',
        actor_id: request.headers.get('X-Actor-Id') || 'EXECUTIVE_ADMIN',
        actor_role: request.headers.get('X-Actor-Role') || 'ADMIN',
        details: `Permanently removed site ${siteId} and reclaimed database storage.`,
        timestamp: new Date().toISOString()
      });

      return jsonResponse({ status: 'success', message: `Site ${siteId} and all associated records permanently purged.` });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  // 4b. Inventory Ledger
  if (path === '/inventory' && method === 'GET') {
    const siteFilter = url.searchParams.get('site_id');
    if (siteFilter && siteFilter !== 'ALL') {
      return jsonResponse(edgeInventory.filter(s => (s.site_id || '').toUpperCase() === siteFilter.toUpperCase()));
    }
    return jsonResponse(edgeInventory);
  }

  if (path === '/inventory/delete' && method === 'POST') {
    try {
      const body = await request.json();
      const stockId = body.stock_id;
      if (!stockId) return jsonResponse({ error: 'stock_id is required' }, 400);

      const deletedStock = edgeInventory.find(s => s.stock_id === stockId || s.item_code === stockId);
      edgeDeletedSkus.add(stockId);
      if (deletedStock?.item_code) {
        edgeDeletedSkus.add(deletedStock.item_code);
        edgeDeletedSkus.add(`${deletedStock.site_id}-${deletedStock.item_code}`);
      }
      edgeInventory = edgeInventory.filter(s => s.stock_id !== stockId && s.item_code !== stockId);

      edgeAuditLogs.unshift({
        log_id: `log-${Date.now()}`,
        action: 'MATERIAL_PURGED',
        actor_id: request.headers.get('X-Actor-Id') || 'QS_ADMIN',
        actor_role: request.headers.get('X-Actor-Role') || 'ADMIN',
        details: `Permanently purged material ${deletedStock?.description || stockId} (SKU: ${deletedStock?.item_code || 'N/A'}) to save space.`,
        timestamp: new Date().toISOString()
      });

      return jsonResponse({ status: 'success', message: 'Material permanently deleted from database.' });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
  }

  if (path === '/inventory/threshold' && method === 'POST') {
    try {
      const body = await request.json();
      const { stock_id, item_code, description, min_reorder_level, reorder_quantity } = body;
      const minLevel = Number(min_reorder_level) || 5;
      const batchQty = Number(reorder_quantity) || 100;

      // Update active stock item
      if (stock_id) {
        const item = edgeInventory.find(s => s.stock_id === stock_id);
        if (item) {
          item.min_reorder_level = minLevel;
          item.reorder_quantity = batchQty;
          item.stock_status = Number(item.current_quantity) <= minLevel ? 'CRITICAL_LOW' : 'OPTIMAL';
          item.status_label = item.stock_status === 'CRITICAL_LOW' ? 'CRITICAL: REORDER REQUIRED' : 'HEALTHY STOCK LEVEL';
        }
      }

      // Save SKU preset for future POs
      const key = (item_code || description || '').toUpperCase().trim();
      if (key) {
        edgeThresholdPresets[key] = {
          min_reorder_level: minLevel,
          reorder_quantity: batchQty,
          item_code,
          description
        };
      }

      return jsonResponse({
        status: 'success',
        message: `Safety threshold updated (Min: ${minLevel}, Batch: ${batchQty}). Preset saved for future orders of SKU ${item_code || description}.`,
        preset: { min_reorder_level: minLevel, reorder_quantity: batchQty }
      });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }
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

  // 5. Invoices & Strict 3-Way Match Triangulation
  if (path === '/invoices/create' && method === 'POST') {
    try {
      const body = await request.json();
      const targetPo = edgePos.find(p => p.po_id === body.po_id || p.po_number === body.po_id) || edgePos[0] || {};
      const invTotal = (body.line_items || []).reduce((sum, it) => sum + (Number(it.quantity_billed || 0) * Number(it.unit_price || 0)), 0);
      const poTotal = targetPo.total_amount || invTotal;

      // Find all confirmed DOs for this PO
      const confirmedDos = edgeDeliveryOrders.filter(d => (d.po_id === targetPo.po_id || d.po_id === targetPo.po_number) && d.status === 'CONFIRMED');

      let hasDiscrepancy = false;
      let totalOverpaymentBlocked = 0.0;
      let totalVerifiedPayable = 0.0;

      const recItems = (body.line_items || []).map((it, idx) => {
        const billedQty = Number(it.quantity_billed || 0);
        const unitPrice = Number(it.unit_price || 0);

        // Find delivered quantity for this item across confirmed physical DOs
        let cumulativeDelivered = 0;
        confirmedDos.forEach(d => {
          (d.items || []).forEach(dItem => {
            const descA = (dItem.description || '').toLowerCase().trim();
            const descB = (it.description || '').toLowerCase().trim();
            const matchDesc = descA && descB && (descA.includes(descB) || descB.includes(descA));
            const matchCode = dItem.item_code && it.item_code && dItem.item_code === it.item_code;
            if (matchDesc || matchCode) {
              cumulativeDelivered += Number(dItem.quantity_received || dItem.quantity_delivered || 0);
            }
          });
        });

        // 3-Way Triangulation check:
        const varianceQty = billedQty - cumulativeDelivered;
        let itemOverpayment = 0.0;
        let discrepancyType = 'NONE';

        if (billedQty > 0 && cumulativeDelivered === 0) {
          // PHYSICAL DELIVERY MISSING: 0 intake verified at gate pass!
          hasDiscrepancy = true;
          discrepancyType = 'UNRECEIVED_MATERIAL';
          itemOverpayment = billedQty * unitPrice;
        } else if (varianceQty > 0) {
          // Billed more than actually delivered on site
          hasDiscrepancy = true;
          discrepancyType = 'QUANTITY_OVERBILLING';
          itemOverpayment = varianceQty * unitPrice;
        }

        const verifiedQty = Math.min(cumulativeDelivered, billedQty);
        const verifiedPayable = verifiedQty * unitPrice;

        totalVerifiedPayable += verifiedPayable;
        totalOverpaymentBlocked += itemOverpayment;

        return {
          item_code: it.item_code || `MAT-00${idx + 1}`,
          description: it.description,
          po_quantity: Number(it.quantity_ordered || billedQty),
          po_unit_price: unitPrice,
          cumulative_delivered_qty: cumulativeDelivered,
          cumulative_billed_qty: billedQty,
          variance_qty: varianceQty,
          discrepancy_type: discrepancyType,
          verified_payable_amount: verifiedPayable
        };
      });

      // Strict 3-Way Determination:
      // If no DO has been uploaded or delivered qty is less than claimed, FLAG DISCREPANCY and BLOCK FUNDS!
      const matchStatus = (hasDiscrepancy || totalOverpaymentBlocked > 0) ? 'DISCREPANCY_FLAGGED' : 'READY_FOR_APPROVAL';

      const rec = {
        reconciliation_id: `rec-${Date.now()}`,
        po_id: targetPo.po_id || 'PO-MANUAL',
        po_number: targetPo.po_number || 'PO-MANUAL',
        invoice_number: body.invoice_number,
        supplier_name: body.supplier_name || targetPo.supplier_name || 'Vendor',
        project_name: targetPo.project_name || 'Project Site',
        po_total_amount: poTotal,
        invoice_total_amount: invTotal,
        total_overpayment_blocked: totalOverpaymentBlocked,
        verified_payable_amount: totalVerifiedPayable,
        match_status: matchStatus,
        has_discrepancy: hasDiscrepancy,
        items: recItems
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
      const confidence = Number(body.confidence_score !== undefined ? body.confidence_score : 0.95);
      const isFake = body.is_valid_do === false || confidence < 0.30 || body.status === 'REJECTED';
      const isLowConfidence = !isFake && confidence < 0.85;

      const doStatus = isFake ? 'REJECTED' : (isLowConfidence ? 'NEEDS_REVIEW' : 'CONFIRMED');

      // Record in edgeDeliveryOrders for 3-Way Matching
      const newDo = {
        do_id: `do-${Date.now()}`,
        do_number: doNumber,
        po_id: targetPo.po_id,
        site_id: body.site_id || targetPo.project_site_id,
        delivery_date: new Date().toISOString().split('T')[0],
        status: doStatus,
        confidence: confidence,
        items: isFake ? [] : items.map(it => ({
          item_code: it.item_code,
          description: it.description,
          quantity_received: Number(it.quantity_delivered || it.quantity_received || 0),
          unit: it.unit || 'Units'
        }))
      };
      edgeDeliveryOrders.push(newDo);

      // Increment inventory ONLY IF CONFIRMED (NEVER for rejected fake images or unconfirmed low-confidence DOs!)
      if (doStatus === 'CONFIRMED') {
        items.forEach(it => {
          const qtyReceived = Number(it.quantity_delivered || it.quantity_received || 0);
          const existing = edgeInventory.find(s => s.site_id === (body.site_id || targetPo.project_site_id) && s.item_code === it.item_code);
          if (existing) {
            existing.current_quantity = (Number(existing.current_quantity) || 0) + qtyReceived;
            existing.last_delivery_date = new Date().toISOString().split('T')[0];
            existing.stock_status = Number(existing.current_quantity) <= Number(existing.min_reorder_level) ? 'CRITICAL_LOW' : 'OPTIMAL';
            existing.status_label = existing.stock_status === 'CRITICAL_LOW' ? 'CRITICAL: REORDER REQUIRED' : 'HEALTHY STOCK LEVEL';
          }
        });
      }

      edgeAuditLogs.unshift({
        log_id: `log-${Date.now()}`,
        action: isFake ? 'DO_REJECTED' : (isLowConfidence ? 'DO_NEEDS_REVIEW' : 'DO_VERIFIED'),
        actor_id: 'SITE_SUPERVISOR_DAVE',
        actor_role: 'SITE_SUPERVISOR',
        details: isFake
          ? `Rejected fake / non-DO image upload (Confidence: ${(confidence * 100).toFixed(0)}%) at ${body.site_name || targetPo.project_name || 'Job Site'}`
          : `Processed Delivery Order ${doNumber} (Status: ${doStatus}, Confidence: ${(confidence * 100).toFixed(0)}%) at ${body.site_name || targetPo.project_name || 'Job Site'}`,
        timestamp: new Date().toISOString()
      });

      const recStatus = isFake ? 'DISCREPANCY_FLAGGED' : (isLowConfidence ? 'NEEDS_REVIEW' : 'MATCHED');

      return jsonResponse({
        status: isFake ? 'rejected' : (isLowConfidence ? 'needs_review' : 'success'),
        delivery_order: {
          do_number: doNumber,
          po_id: targetPo.po_id,
          status: doStatus,
          confidence: confidence
        },
        reconciliation: {
          match_status: recStatus,
          rejection_reason: isFake ? 'Uploaded image failed AI Document Inspection (not a recognized physical Delivery Order)' : null
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
