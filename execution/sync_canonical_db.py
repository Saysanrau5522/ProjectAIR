"""
Syncs account_ai.db to the unified canonical state:
- 1 Active Project Site: MADINA (SITE-MADINA)
- 1 Active PO: PO-2026-369 (GARDENIA, Total RM 270.00)
- 1 Flagged Discrepancy Invoice: INV-2026-369 (Total Dispute RM 270.00)
- 1 Inventory Stock: General Materials
"""
import uuid
from execution.db_manager import get_connection, init_db
from execution.token_manager import generate_scoped_token

def sync_canonical_db():
    init_db()
    conn = get_connection()
    cursor = conn.cursor()

    # Clear old data
    cursor.execute("PRAGMA foreign_keys = OFF;")
    for table in ["inventory_stocks", "vendor_risk_metrics", "reconciliation_items", 
                  "reconciliations", "invoice_line_items", "invoices", "do_line_items", 
                  "delivery_orders", "po_line_items", "purchase_orders", "qr_tokens", "audit_logs"]:
        cursor.execute(f"DELETE FROM {table};")
    cursor.execute("PRAGMA foreign_keys = ON;")

    site_id = "SITE-MADINA"
    site_name = "MADINA"
    po_id = "PO-2026-369"
    po_number = "PO-2026-369"
    supplier_name = "GARDENIA"
    total_amount = 270.00

    # 1. Purchase Order
    cursor.execute("""
        INSERT INTO purchase_orders (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, total_amount, currency, status)
        VALUES (?, ?, ?, ?, ?, '2026-09-06', ?, 'MYR', 'OPEN')
    """, (po_id, po_number, site_id, site_name, supplier_name, total_amount))

    # Line Items
    cursor.execute("""
        INSERT INTO po_line_items (id, po_id, item_code, description, unit, quantity, unit_price, total_price)
        VALUES 
        ('POLI-369-01', ?, 'MAT-GARD-01', 'Gardenia Classic 400g', 'Loaf', 10.0, 15.00, 150.00),
        ('POLI-369-02', ?, 'MAT-GARD-02', 'Gardenia Wholemeal 400g', 'Loaf', 8.0, 15.00, 120.00)
    """, (po_id, po_id))

    # Token
    token = generate_scoped_token(
        po_id, site_id, expires_in_seconds=86400 * 14,
        po_number=po_number, project_name=site_name,
        supplier_name=supplier_name, total_amount=total_amount
    )
    cursor.execute("""
        INSERT INTO qr_tokens (token_id, token_string, po_id, site_id, expires_at, created_by)
        VALUES ('TKN-MADINA-369', ?, ?, ?, datetime('now', '+14 days'), 'FINANCE_CONTROLLER_BOB')
    """, (token, po_id, site_id))

    # 2. Inventory Stock
    cursor.execute("""
        INSERT INTO inventory_stocks (stock_id, site_id, item_code, description, current_quantity, unit, min_reorder_level, reorder_quantity, last_delivery_date)
        VALUES ('STK-MADINA-01', ?, 'MAT-GARD-01', 'Gardenia Classic 400g', 0.0, 'Loaf', 5.0, 10.0, NULL)
    """, (site_id,))
    cursor.execute("""
        INSERT INTO inventory_stocks (stock_id, site_id, item_code, description, current_quantity, unit, min_reorder_level, reorder_quantity, last_delivery_date)
        VALUES ('STK-MADINA-02', ?, 'MAT-GARD-02', 'Gardenia Wholemeal 400g', 0.0, 'Loaf', 5.0, 8.0, NULL)
    """, (site_id,))

    # 3. Invoice & Reconciliation (RM 270.00 Dispute)
    inv_id = "INV-2026-369"
    cursor.execute("""
        INSERT INTO invoices (invoice_id, invoice_number, po_id, supplier_name, invoice_date, subtotal, total_amount, currency, status)
        VALUES (?, 'INV-369', ?, ?, '2026-09-06', 270.00, 270.00, 'MYR', 'DISCREPANCY')
    """, (inv_id, po_id, supplier_name))

    cursor.execute("""
        INSERT INTO invoice_line_items (id, invoice_id, description, quantity_billed, unit_price, total_price, confidence, gl_code, gl_category)
        VALUES 
        ('INVI-369-01', ?, 'Gardenia Classic 400g', 10.0, 15.00, 150.00, 1.0, '5010-MAT', 'COGS - Direct Materials'),
        ('INVI-369-02', ?, 'Gardenia Wholemeal 400g', 8.0, 15.00, 120.00, 1.0, '5010-MAT', 'COGS - Direct Materials')
    """, (inv_id, inv_id))

    rec_id = "REC-MADINA-369"
    dispute_notice = f"FORMAL PAYMENT DISPUTE NOTICE\nReference: PO #PO-2026-369 | Invoice #INV-369\nSupplier: {supplier_name}\nProject AIR 3-Way Match audit detected unverified charges.\nTotal Overpayment Blocked: RM 270.00.\nDelivery Order site records do not substantiate billed quantities.\nPlease issue a revised invoice or credit note before payment can be scheduled."

    cursor.execute("""
        INSERT INTO reconciliations (
            reconciliation_id, po_id, invoice_id, match_status, 
            total_po_amount, total_billed_amount, total_overpayment_blocked, 
            has_discrepancy, tolerance_used, dispute_notice, is_locked
        ) VALUES (?, ?, ?, 'DISCREPANCY_FLAGGED', 270.00, 270.00, 270.00, 1, 0.02, ?, 0)
    """, (rec_id, po_id, inv_id, dispute_notice))

    cursor.execute("""
        INSERT INTO reconciliation_items (
            id, reconciliation_id, description,
            ordered_qty, cumulative_delivered_qty, cumulative_billed_qty,
            po_unit_price, billed_unit_price, variance_qty, variance_price,
            overpayment_amount, discrepancy_type, gl_code, gl_category
        ) VALUES 
        (
            'RECI-369-01', ?, 'Gardenia Classic 400g',
            10.0, 0.0, 10.0,
            15.00, 15.00, 10.0, 0.0,
            150.00, 'UNRECEIVED_MATERIAL', '5010-MAT', 'COGS - Direct Materials'
        ),
        (
            'RECI-369-02', ?, 'Gardenia Wholemeal 400g',
            8.0, 0.0, 8.0,
            15.00, 15.00, 8.0, 0.0,
            120.00, 'UNRECEIVED_MATERIAL', '5010-MAT', 'COGS - Direct Materials'
        )
    """, (rec_id, rec_id))

    # 4. Audit Log
    cursor.execute("""
        INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, after_state, metadata)
        VALUES ('RECONCILIATION', ?, 'SYSTEM', 'SYSTEM', 'RECONCILED', 'DISCREPANCY_FLAGGED', 'Dispute variance blocked: RM 270.00')
    """, (rec_id,))

    conn.commit()
    conn.close()
    print("[Sync] Canonical database synchronized: 1 Site (MADINA), 1 PO (RM 270.00), 1 Dispute (RM 270.00).")

if __name__ == "__main__":
    sync_canonical_db()
