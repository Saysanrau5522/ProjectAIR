-- ==========================================================
-- Project AIR: Relational Schema (Cloudflare D1 / SQLite)
-- ==========================================================

PRAGMA foreign_keys = ON;

-- 1. Purchase Orders (HQ Authorized Contracts)
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id TEXT PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    project_site_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    total_amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'PARTIALLY_DELIVERED', 'COMPLETED', 'LOCKED')),
    is_locked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS po_line_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    item_code TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE
);

-- 2. Delivery Orders (Site-Verified Physical Receipts)
CREATE TABLE IF NOT EXISTS delivery_orders (
    do_id TEXT PRIMARY KEY,
    do_number TEXT NOT NULL,
    po_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    delivery_date TEXT NOT NULL,
    supervisor_phone TEXT NOT NULL,
    supervisor_id TEXT DEFAULT 'SITE_SUP_01',
    image_url TEXT NOT NULL,
    image_hash TEXT NOT NULL,
    extraction_confidence REAL NOT NULL DEFAULT 1.0,
    status TEXT DEFAULT 'CONFIRMED' CHECK(status IN ('PENDING_EXTRACTION', 'NEEDS_REVIEW', 'CONFIRMED', 'REJECTED')),
    is_locked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id)
);

CREATE TABLE IF NOT EXISTS do_line_items (
    id TEXT PRIMARY KEY,
    do_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity_received REAL NOT NULL,
    unit TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    drop_site_id TEXT,
    drop_location TEXT,
    FOREIGN KEY (do_id) REFERENCES delivery_orders(do_id) ON DELETE CASCADE
);

-- 3. Supplier Invoices (Vendor Billing Claims)
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    po_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    invoice_date TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax_amount REAL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    image_url TEXT,
    is_duplicate INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING_MATCH' CHECK(status IN ('PENDING_MATCH', 'MATCHED', 'DISCREPANCY', 'APPROVED', 'DISPUTED', 'LOCKED', 'PARTIALLY_APPROVED')),
    is_locked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id),
    -- Anti-duplicate invoice constraint
    UNIQUE(supplier_name, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity_billed REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    gl_code TEXT DEFAULT '5010-MAT',
    gl_category TEXT DEFAULT 'COGS - Direct Materials',
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE
);

-- 4. 3-Way Reconciliations (Reconciliation Engine Results)
CREATE TABLE IF NOT EXISTS reconciliations (
    reconciliation_id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    match_status TEXT NOT NULL CHECK(match_status IN ('READY_FOR_APPROVAL', 'DISCREPANCY_FLAGGED', 'NEEDS_REVIEW', 'APPROVED', 'DISPUTED', 'PARTIALLY_APPROVED')),
    total_po_amount REAL NOT NULL,
    total_billed_amount REAL NOT NULL,
    total_overpayment_blocked REAL DEFAULT 0.0,
    has_discrepancy INTEGER DEFAULT 0,
    tolerance_used REAL DEFAULT 0.02,
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    approved_by TEXT,
    approved_at TEXT,
    dispute_notice TEXT,
    is_locked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
);

CREATE TABLE IF NOT EXISTS reconciliation_items (
    id TEXT PRIMARY KEY,
    reconciliation_id TEXT NOT NULL,
    description TEXT NOT NULL,
    ordered_qty REAL NOT NULL,
    cumulative_delivered_qty REAL NOT NULL,
    cumulative_billed_qty REAL NOT NULL,
    po_unit_price REAL NOT NULL,
    billed_unit_price REAL NOT NULL,
    variance_qty REAL NOT NULL,
    variance_price REAL NOT NULL,
    overpayment_amount REAL NOT NULL,
    discrepancy_type TEXT CHECK(discrepancy_type IN ('NONE', 'QUANTITY_OVERBILLING', 'PRICE_MARKUP', 'UNRECEIVED_MATERIAL', 'LOW_CONFIDENCE')),
    gl_code TEXT DEFAULT '5010-MAT',
    gl_category TEXT DEFAULT 'COGS - Direct Materials',
    FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(reconciliation_id) ON DELETE CASCADE
);

-- 5. Site Inventory Stock Ledger (Real-Time Zero-Entry Management)
CREATE TABLE IF NOT EXISTS inventory_stocks (
    stock_id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    item_code TEXT NOT NULL,
    description TEXT NOT NULL,
    current_quantity REAL NOT NULL DEFAULT 0.0,
    unit TEXT NOT NULL,
    min_reorder_level REAL NOT NULL DEFAULT 100.0,
    reorder_quantity REAL NOT NULL DEFAULT 500.0,
    last_delivery_date TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(site_id, item_code)
);

-- 6. Vendor Risk & Performance Benchmarks
CREATE TABLE IF NOT EXISTS vendor_risk_metrics (
    supplier_name TEXT PRIMARY KEY,
    risk_grade TEXT NOT NULL DEFAULT 'A', -- 'A', 'B', 'C'
    total_orders INTEGER DEFAULT 0,
    discrepancy_count INTEGER DEFAULT 0,
    discrepancy_rate REAL DEFAULT 0.0,
    avg_price_variance REAL DEFAULT 0.0,
    friday_underdelivery_rate REAL DEFAULT 0.0,
    total_overpayment_blocked REAL DEFAULT 0.0,
    contract_insights TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Append-Only Audit Trail (Immutable Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    before_state TEXT,
    after_state TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Signed Scoped QR Tokens (Mobile Ingestion Auth)
CREATE TABLE IF NOT EXISTS qr_tokens (
    token_id TEXT PRIMARY KEY,
    token_string TEXT UNIQUE NOT NULL,
    po_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    is_revoked INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id)
);

