"""
Seed Data Script for Project AIR.
Seeds realistic construction procurement scenarios demonstrating:
1. Classic Cement Discrepancy (1,000 ordered, 800 delivered, 1,000 billed - $1,700 blocked!)
2. Multi-Document Aggregation (50t Rebar split across 2 DOs, matched against 1 Invoice)
3. Low-Confidence Crumpled DO (Dirty site DO triggering Human-in-the-loop review queue)
4. Anti-Duplicate Invoice Prevention
5. Signed Scoped QR Tokens for site testing
"""
import os
import uuid
from execution.db_manager import init_db, get_connection
from execution.token_manager import generate_scoped_token
from execution.matching_engine import run_reconciliation

def seed():
    print("[Seed] Initializing database...")
    conn = get_connection()
    cursor = conn.cursor()
    
    # Drop existing tables to refresh constraints
    cursor.execute("PRAGMA foreign_keys = OFF;")
    tables = [
        "inventory_stocks", "vendor_risk_metrics",
        "reconciliation_items", "reconciliations", "invoice_line_items", 
        "invoices", "do_line_items", "delivery_orders", "po_line_items", 
        "purchase_orders", "qr_tokens", "audit_logs"
    ]
    for tbl in tables:
        cursor.execute(f"DROP TABLE IF EXISTS {tbl};")
    cursor.execute("PRAGMA foreign_keys = ON;")
    conn.commit()
    conn.close()

    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    # -------------------------------------------------------------
    # SCENARIO 1: Classic Discrepancy (1,000 Cement Bags Ordered, 800 Delivered, 1,000 Billed)
    # -------------------------------------------------------------
    po1_id = "PO-2026-001"
    cursor.execute("""
        INSERT INTO purchase_orders (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, total_amount, status)
        VALUES (?, 'PO-2026-001', 'SITE-ALPHA-WEST', 'West Coast Logistics Hub', 'MegaMix Cement & Concrete Corp', '2026-09-01', 8500.00, 'OPEN')
    """, (po1_id,))
    
    cursor.execute("""
        INSERT INTO po_line_items (id, po_id, item_code, description, unit, quantity, unit_price, total_price)
        VALUES ('POLI-001', ?, 'MAT-CEM-425', 'Portland Cement Grade 42.5 (50kg Bag)', 'Bags', 1000.0, 8.50, 8500.00)
    """, (po1_id,))
    
    # DO 1: Only 800 bags received at site!
    do1_id = "DO-SITE-8801"
    cursor.execute("""
        INSERT INTO delivery_orders (do_id, do_number, po_id, supplier_name, delivery_date, supervisor_phone, image_url, image_hash, extraction_confidence, status)
        VALUES (?, 'DO-8801', ?, 'MegaMix Cement & Concrete Corp', '2026-09-03', '+1-555-019-2834', '/storage/do_cement_800bags.png', 'hash_cement_8801', 0.98, 'CONFIRMED')
    """, (do1_id, po1_id))
    
    cursor.execute("""
        INSERT INTO do_line_items (id, do_id, description, quantity_received, unit, confidence)
        VALUES ('DOLI-001', ?, 'Portland Cement Grade 42.5 (50kg Bag)', 800.0, 'Bags', 0.98)
    """, (do1_id,))
    
    # Invoice 1: MegaMix bills for the full 1,000 bags!
    inv1_id = "INV-2026-9041"
    cursor.execute("""
        INSERT INTO invoices (invoice_id, invoice_number, po_id, supplier_name, invoice_date, subtotal, total_amount, status)
        VALUES (?, 'INV-9041', ?, 'MegaMix Cement & Concrete Corp', '2026-09-04', 8500.00, 8500.00, 'PENDING_MATCH')
    """, (inv1_id, po1_id))
    
    cursor.execute("""
        INSERT INTO invoice_line_items (id, invoice_id, description, quantity_billed, unit_price, total_price, confidence)
        VALUES ('INVI-001', ?, 'Portland Cement Grade 42.5 (50kg Bag)', 1000.0, 8.50, 8500.00, 1.0)
    """, (inv1_id,))
    
    # -------------------------------------------------------------
    # SCENARIO 2: Multi-Document Aggregation (50t Rebar split across 2 partial DOs)
    # -------------------------------------------------------------
    po2_id = "PO-2026-002"
    cursor.execute("""
        INSERT INTO purchase_orders (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, total_amount, status)
        VALUES (?, 'PO-2026-002', 'SITE-BETA-TOWER', 'Skyline Horizon Tower B', 'Titan Steel Rebar Ltd', '2026-08-28', 36000.00, 'OPEN')
    """, (po2_id,))
    
    cursor.execute("""
        INSERT INTO po_line_items (id, po_id, item_code, description, unit, quantity, unit_price, total_price)
        VALUES ('POLI-002', ?, 'MAT-STL-RB16', 'High-Tensile Deformed Rebar 16mm (Tons)', 'Tons', 50.0, 720.00, 36000.00)
    """, (po2_id,))
    
    # DO 2A: First truck delivers 25 tons
    do2a_id = "DO-SITE-8802"
    cursor.execute("""
        INSERT INTO delivery_orders (do_id, do_number, po_id, supplier_name, delivery_date, supervisor_phone, image_url, image_hash, extraction_confidence, status)
        VALUES (?, 'DO-8802', ?, 'Titan Steel Rebar Ltd', '2026-08-30', '+1-555-014-9921', '/storage/do_rebar_truck1.png', 'hash_rebar_8802', 0.99, 'CONFIRMED')
    """, (do2a_id, po2_id))
    cursor.execute("""
        INSERT INTO do_line_items (id, do_id, description, quantity_received, unit, confidence)
        VALUES ('DOLI-002A', ?, 'High-Tensile Deformed Rebar 16mm (Tons)', 25.0, 'Tons', 0.99)
    """, (do2a_id,))
    
    # DO 2B: Second truck delivers 25 tons
    do2b_id = "DO-SITE-8803"
    cursor.execute("""
        INSERT INTO delivery_orders (do_id, do_number, po_id, supplier_name, delivery_date, supervisor_phone, image_url, image_hash, extraction_confidence, status)
        VALUES (?, 'DO-8803', ?, 'Titan Steel Rebar Ltd', '2026-09-02', '+1-555-014-9921', '/storage/do_rebar_truck2.png', 'hash_rebar_8803', 0.97, 'CONFIRMED')
    """, (do2b_id, po2_id))
    cursor.execute("""
        INSERT INTO do_line_items (id, do_id, description, quantity_received, unit, confidence)
        VALUES ('DOLI-002B', ?, 'High-Tensile Deformed Rebar 16mm (Tons)', 25.0, 'Tons', 0.97)
    """, (do2b_id,))
    
    # Invoice 2: Bills for 50 tons
    inv2_id = "INV-2026-9042"
    cursor.execute("""
        INSERT INTO invoices (invoice_id, invoice_number, po_id, supplier_name, invoice_date, subtotal, total_amount, status)
        VALUES (?, 'INV-9042', ?, 'Titan Steel Rebar Ltd', '2026-09-03', 36000.00, 36000.00, 'PENDING_MATCH')
    """, (inv2_id, po2_id))
    cursor.execute("""
        INSERT INTO invoice_line_items (id, invoice_id, description, quantity_billed, unit_price, total_price, confidence)
        VALUES ('INVI-002', ?, 'High-Tensile Deformed Rebar 16mm (Tons)', 50.0, 720.00, 36000.00, 1.0)
    """, (inv2_id,))
    
    # -------------------------------------------------------------
    # SCENARIO 3: Crumpled Low-Confidence DO (Human-in-the-Loop)
    # -------------------------------------------------------------
    po3_id = "PO-2026-003"
    cursor.execute("""
        INSERT INTO purchase_orders (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, total_amount, status)
        VALUES (?, 'PO-2026-003', 'SITE-GAMMA-BRIDGE', 'Harbor Rail Crossing Bridge', 'Apex Aggregate & Gravel Quarries', '2026-09-02', 5400.00, 'OPEN')
    """, (po3_id,))
    cursor.execute("""
        INSERT INTO po_line_items (id, po_id, item_code, description, unit, quantity, unit_price, total_price)
        VALUES ('POLI-003', ?, 'MAT-AGG-W34', 'Washed Crushed Aggregate 3/4" (Cu Yds)', 'Cu Yds', 120.0, 45.00, 5400.00)
    """, (po3_id,))
    
    # DO 3: Crumpled, low-light dirty DO! Extraction confidence is only 72% (< 85%)
    do3_id = "DO-SITE-8804"
    cursor.execute("""
        INSERT INTO delivery_orders (do_id, do_number, po_id, supplier_name, delivery_date, supervisor_phone, image_url, image_hash, extraction_confidence, status)
        VALUES (?, 'DO-8804', ?, 'Apex Aggregate & Gravel Quarries', '2026-09-04', '+1-555-018-7712', '/storage/crumpled_dirty_do.png', 'hash_gravel_8804', 0.72, 'NEEDS_REVIEW')
    """, (do3_id, po3_id))
    cursor.execute("""
        INSERT INTO do_line_items (id, do_id, description, quantity_received, unit, confidence)
        VALUES ('DOLI-003', ?, 'Washed Crushed Aggregate 3/4" (Cu Yds)', 120.0, 'Cu Yds', 0.72)
    """, (do3_id,))
    
    inv3_id = "INV-2026-9043"
    cursor.execute("""
        INSERT INTO invoices (invoice_id, invoice_number, po_id, supplier_name, invoice_date, subtotal, total_amount, status)
        VALUES (?, 'INV-9043', ?, 'Apex Aggregate & Gravel Quarries', '2026-09-04', 5400.00, 5400.00, 'PENDING_MATCH')
    """, (inv3_id, po3_id))
    cursor.execute("""
        INSERT INTO invoice_line_items (id, invoice_id, description, quantity_billed, unit_price, total_price, confidence)
        VALUES ('INVI-003', ?, 'Washed Crushed Aggregate 3/4" (Cu Yds)', 120.0, 45.00, 5400.00, 1.0)
    """, (inv3_id,))
    
    # -------------------------------------------------------------
    # SCENARIO 4: Multi-Site Split Drop Delivery Order
    # -------------------------------------------------------------
    po4_id = "PO-2026-004"
    cursor.execute("""
        INSERT INTO purchase_orders (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, total_amount, status)
        VALUES (?, 'PO-2026-004', 'SITE-ALPHA-WEST', 'Regional Highway Transit Corridor', 'Southern Aggregate & Ready-Mix Corp', '2026-09-03', 9600.00, 'OPEN')
    """, (po4_id,))
    cursor.execute("""
        INSERT INTO po_line_items (id, po_id, item_code, description, unit, quantity, unit_price, total_price)
        VALUES ('POLI-004', ?, 'MAT-CONC-G30', 'Ready-Mix Concrete Grade 30', 'Cu M', 80.0, 120.00, 9600.00)
    """, (po4_id,))
    
    # DO 4: Single delivery docket splits 80 Cu M between two project sites!
    do4_id = "DO-SITE-8805"
    cursor.execute("""
        INSERT INTO delivery_orders (do_id, do_number, po_id, supplier_name, delivery_date, supervisor_phone, image_url, image_hash, extraction_confidence, status)
        VALUES (?, 'DO-8805', ?, 'Southern Aggregate & Ready-Mix Corp', '2026-09-04', '+1-555-019-2834', '/storage/do_split_drop.png', 'hash_split_8805', 0.99, 'CONFIRMED')
    """, (do4_id, po4_id))
    cursor.execute("""
        INSERT INTO do_line_items (id, do_id, description, quantity_received, unit, confidence, drop_site_id, drop_location)
        VALUES ('DOLI-004A', ?, 'Ready-Mix Concrete Grade 30', 30.0, 'Cu M', 0.99, 'SITE-ALPHA-WEST', 'West Slipway Ramp P-04')
    """, (do4_id,))
    cursor.execute("""
        INSERT INTO do_line_items (id, do_id, description, quantity_received, unit, confidence, drop_site_id, drop_location)
        VALUES ('DOLI-004B', ?, 'Ready-Mix Concrete Grade 30', 50.0, 'Cu M', 0.99, 'SITE-BETA-TOWER', 'Tower B Basement Pour')
    """, (do4_id,))
    
    inv4_id = "INV-2026-9044"
    cursor.execute("""
        INSERT INTO invoices (invoice_id, invoice_number, po_id, supplier_name, invoice_date, subtotal, total_amount, status)
        VALUES (?, 'INV-9044', ?, 'Southern Aggregate & Ready-Mix Corp', '2026-09-05', 9600.00, 9600.00, 'PENDING_MATCH')
    """, (inv4_id, po4_id))
    cursor.execute("""
        INSERT INTO invoice_line_items (id, invoice_id, description, quantity_billed, unit_price, total_price, confidence, gl_code, gl_category)
        VALUES ('INVI-004', ?, 'Ready-Mix Concrete Grade 30', 80.0, 120.00, 9600.00, 1.0, '5020-CONC', 'COGS - Concrete & Structural Mixes')
    """, (inv4_id,))

    # -------------------------------------------------------------
    # Initial Site Inventory Stock Records
    # -------------------------------------------------------------
    stocks = [
        ("STK-001", "SITE-ALPHA-WEST", "MAT-CEM-425", "Portland Cement Grade 42.5 (50kg Bag)", 800.0, "Bags", 200.0, 500.0, "2026-09-03"),
        ("STK-002", "SITE-ALPHA-WEST", "PPE-HARDHAT", "Safety Hardhat Helmet (White)", 12.0, "Units", 30.0, 50.0, "2026-08-20"),
        ("STK-003", "SITE-BETA-TOWER", "MAT-STL-RB16", "High-Tensile Deformed Rebar 16mm (Tons)", 50.0, "Tons", 15.0, 30.0, "2026-09-02"),
        ("STK-004", "SITE-GAMMA-BRIDGE", "MAT-AGG-W34", "Washed Crushed Aggregate 3/4\" (Cu Yds)", 45.0, "Cu Yds", 100.0, 250.0, "2026-09-01"),
        ("STK-005", "SITE-ALPHA-WEST", "MAT-CONC-G30", "Ready-Mix Concrete Grade 30", 30.0, "Cu M", 20.0, 50.0, "2026-09-04"),
        ("STK-006", "SITE-BETA-TOWER", "MAT-CONC-G30", "Ready-Mix Concrete Grade 30", 50.0, "Cu M", 25.0, 60.0, "2026-09-04"),
    ]
    for stk in stocks:
        cursor.execute("""
            INSERT INTO inventory_stocks (stock_id, site_id, item_code, description, current_quantity, unit, min_reorder_level, reorder_quantity, last_delivery_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, stk)

    # -------------------------------------------------------------
    # Pre-generate Scoped QR Tokens for each site
    # -------------------------------------------------------------
    for p_id, s_id in [
        (po1_id, "SITE-ALPHA-WEST"), 
        (po2_id, "SITE-BETA-TOWER"), 
        (po3_id, "SITE-GAMMA-BRIDGE"),
        (po4_id, "SITE-ALPHA-WEST")
    ]:
        token_str = generate_scoped_token(p_id, s_id)
        cursor.execute("""
            INSERT INTO qr_tokens (token_id, token_string, po_id, site_id, expires_at, created_by)
            VALUES (?, ?, ?, ?, datetime('now', '+7 days'), 'HQ_PROCUREMENT')
        """, (f"TKN-{p_id}", token_str, p_id, s_id))
        
    # Audit log entries
    cursor.execute("""
        INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, metadata)
        VALUES ('SYSTEM', 'SEED', 'SYSTEM_ADMIN', 'ADMIN', 'SEED_COMPLETED', 'Initial construction test fixtures loaded with multi-site drops and inventory.')
    """)
    
    conn.commit()
    conn.close()
    
    print("[Seed] Running initial 3-way match reconciliations...")
    # Reconcile Scenario 1 (Will trigger DISCREPANCY_FLAGGED with $1,700 overpayment caught)
    rec1 = run_reconciliation(po1_id, inv1_id, actor_id="SYSTEM")
    print(f"  -> Scenario 1 (Cement): {rec1['match_status']}, Blocked: ${rec1['total_overpayment_blocked']}")
    
    # Reconcile Scenario 2 (Will trigger READY_FOR_APPROVAL - 50t matched)
    rec2 = run_reconciliation(po2_id, inv2_id, actor_id="SYSTEM")
    print(f"  -> Scenario 2 (Rebar): {rec2['match_status']}, Blocked: ${rec2['total_overpayment_blocked']}")
    
    # Reconcile Scenario 3 (Will trigger NEEDS_REVIEW because DO is low confidence)
    rec3 = run_reconciliation(po3_id, inv3_id, actor_id="SYSTEM")
    print(f"  -> Scenario 3 (Gravel Low-Conf): {rec3['match_status']}")
    
    # Reconcile Scenario 4 (Will trigger READY_FOR_APPROVAL - 80 Cu M matched across multi-site split drop)
    rec4 = run_reconciliation(po4_id, inv4_id, actor_id="SYSTEM")
    print(f"  -> Scenario 4 (Multi-Site Split Drop): {rec4['match_status']}")
    
    print("[Seed] Successfully seeded all fixtures!")

if __name__ == "__main__":
    seed()

