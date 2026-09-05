"""
Real-Time Site Inventory Management Service for Project AIR.
Automates zero-entry material receipts, handles multi-site split drops,
monitors stock reorder thresholds, and generates 1-click draft replenishment POs.
"""
import uuid
import time
from typing import Dict, Any, List, Optional
from execution.db_manager import get_connection, execute_query
from execution.token_manager import generate_scoped_token

def increment_stock_from_do(do_id: str) -> List[Dict[str, Any]]:
    """
    Executes Zero-Entry Inventory Update upon DO verification.
    Iterates over all confirmed DO line items:
    - If drop_site_id is specified (Multi-Site Split Drop), increments that site's inventory.
    - Otherwise, increments the PO's parent project_site_id inventory.
    - Automatically provisions or updates `inventory_stocks` record.
    """
    conn = get_connection()
    c = conn.cursor()
    
    # Fetch DO and linked PO site info
    c.execute("""
        SELECT do.do_id, do.do_number, do.po_id, do.delivery_date,
               po.project_site_id as default_site_id, po.project_name
        FROM delivery_orders do
        JOIN purchase_orders po ON do.po_id = po.po_id
        WHERE do.do_id = ?
    """, (do_id,))
    do_info = c.fetchone()
    if not do_info:
        conn.close()
        return []
        
    default_site_id = do_info["default_site_id"]
    delivery_date = do_info["delivery_date"]
    
    # Fetch all line items for this DO
    c.execute("SELECT * FROM do_line_items WHERE do_id = ?", (do_id,))
    items = [dict(row) for row in c.fetchall()]
    
    updated_records = []
    
    for item in items:
        # Check if item has a specific drop_site_id (split drop) or uses parent site
        target_site_id = item.get("drop_site_id") or default_site_id
        raw_desc = item.get("description", "Material")
        qty = float(item.get("quantity_received", 0.0))
        unit = item.get("unit", "Units")
        
        # Determine or match item_code
        # First check if matching PO item code exists
        c.execute("""
            SELECT item_code FROM po_line_items
            WHERE po_id = ? AND (description LIKE ? OR ? LIKE '%' || description || '%')
            LIMIT 1
        """, (do_info["po_id"], f"%{raw_desc[:15]}%", raw_desc))
        po_match = c.fetchone()
        
        if po_match:
            item_code = po_match["item_code"]
        else:
            # Generate deterministic item code from description
            slug = "".join([w[:3].upper() for w in raw_desc.split()[:3]])
            item_code = f"MAT-{slug or 'GEN'}"
            
        # Check if record exists in inventory_stocks
        c.execute("""
            SELECT stock_id, current_quantity FROM inventory_stocks
            WHERE site_id = ? AND item_code = ?
        """, (target_site_id, item_code))
        existing_stock = c.fetchone()
        
        if existing_stock:
            new_qty = float(existing_stock["current_quantity"]) + qty
            c.execute("""
                UPDATE inventory_stocks
                SET current_quantity = ?, last_delivery_date = ?, updated_at = datetime('now')
                WHERE stock_id = ?
            """, (round(new_qty, 2), delivery_date, existing_stock["stock_id"]))
            stock_id = existing_stock["stock_id"]
        else:
            stock_id = f"STK-{uuid.uuid4().hex[:6].upper()}"
            new_qty = qty
            c.execute("""
                INSERT INTO inventory_stocks (
                    stock_id, site_id, item_code, description, current_quantity,
                    unit, min_reorder_level, reorder_quantity, last_delivery_date
                ) VALUES (?, ?, ?, ?, ?, ?, 100.0, 500.0, ?)
            """, (stock_id, target_site_id, item_code, raw_desc, round(new_qty, 2), unit, delivery_date))
            
        updated_records.append({
            "stock_id": stock_id,
            "site_id": target_site_id,
            "item_code": item_code,
            "description": raw_desc,
            "increment_qty": qty,
            "new_total": round(new_qty, 2),
            "unit": unit
        })
        
    # Log audit trail
    c.execute("""
        INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, metadata)
        VALUES ('INVENTORY', ?, 'SYSTEM_INVENTORY', 'AUTOMATION', 'STOCK_INCREMENTED', ?)
    """, (do_id, f"Auto-incremented {len(updated_records)} items from DO #{do_info['do_number']}"))
    
    conn.commit()
    conn.close()
    return updated_records

def get_inventory_stocks(site_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves site inventory stock records with real-time threshold calculations:
    - Status: 'CRITICAL_LOW' (<= min_reorder_level), 'LOW' (<= 1.5 * min), 'HEALTHY'
    - Includes project name from sites.
    """
    if site_id and site_id != "ALL":
        query = """
            SELECT s.*, 
                   COALESCE((SELECT project_name FROM purchase_orders WHERE project_site_id = s.site_id LIMIT 1), s.site_id) as project_name
            FROM inventory_stocks s
            WHERE s.site_id = ?
            ORDER BY s.current_quantity ASC, s.description ASC
        """
        stocks = execute_query(query, (site_id,))
    else:
        query = """
            SELECT s.*, 
                   COALESCE((SELECT project_name FROM purchase_orders WHERE project_site_id = s.site_id LIMIT 1), s.site_id) as project_name
            FROM inventory_stocks s
            ORDER BY s.site_id ASC, s.current_quantity ASC
        """
        stocks = execute_query(query)
        
    for item in stocks:
        curr = float(item["current_quantity"])
        min_lvl = float(item["min_reorder_level"])
        if curr <= min_lvl:
            item["stock_status"] = "CRITICAL_LOW"
            item["status_label"] = "CRITICAL: REORDER REQUIRED"
        elif curr <= (min_lvl * 1.5):
            item["stock_status"] = "LOW"
            item["status_label"] = "LOW STOCK WARNING"
        else:
            item["stock_status"] = "HEALTHY"
            item["status_label"] = "SUFFICIENT"
            
    return stocks

def create_draft_replenishment_po(stock_id: str, actor_id: str = "INVENTORY_MANAGER") -> Dict[str, Any]:
    """
    1-Click Draft Replenishment PO Generator.
    Reads the low stock item, retrieves historical supplier unit price,
    creates a new OPEN Purchase Order in the database, generates scoped QR token,
    and logs immutable audit event.
    """
    conn = get_connection()
    c = conn.cursor()
    
    c.execute("SELECT * FROM inventory_stocks WHERE stock_id = ?", (stock_id,))
    stock = c.fetchone()
    if not stock:
        conn.close()
        raise ValueError(f"Inventory stock ID '{stock_id}' not found.")
        
    site_id = stock["site_id"]
    item_code = stock["item_code"]
    desc = stock["description"]
    unit = stock["unit"]
    reorder_qty = float(stock["reorder_quantity"] or 500.0)
    
    # Lookup historical supplier and unit price from previous POs
    c.execute("""
        SELECT po.supplier_name, po.project_name, poli.unit_price
        FROM purchase_orders po
        JOIN po_line_items poli ON po.po_id = poli.po_id
        WHERE po.project_site_id = ? AND (poli.item_code = ? OR poli.description LIKE ?)
        ORDER BY po.created_at DESC
        LIMIT 1
    """, (site_id, item_code, f"%{desc[:10]}%"))
    hist = c.fetchone()
    
    supplier_name = hist["supplier_name"] if hist else "Apex Aggregate & Materials Corp"
    project_name = hist["project_name"] if hist else f"Site Project ({site_id})"
    unit_price = float(hist["unit_price"]) if hist else 25.00
    total_amount = round(reorder_qty * unit_price, 2)
    
    po_id = f"PO-AUTO-{uuid.uuid4().hex[:6].upper()}"
    po_number = f"PO-2026-REPL-{uuid.uuid4().hex[:4].upper()}"
    today = time.strftime("%Y-%m-%d")
    
    # Insert new replenishment PO
    c.execute("""
        INSERT INTO purchase_orders (
            po_id, po_number, project_site_id, project_name, supplier_name,
            issue_date, total_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')
    """, (po_id, po_number, site_id, project_name, supplier_name, today, total_amount))
    
    # Insert PO line item
    c.execute("""
        INSERT INTO po_line_items (
            id, po_id, item_code, description, unit, quantity, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (f"POLI-{uuid.uuid4().hex[:6].upper()}", po_id, item_code, desc, unit, reorder_qty, unit_price, total_amount))
    
    # Generate Scoped QR Token for site supervisor
    token = generate_scoped_token(po_id, site_id, expires_in_seconds=86400 * 14, created_by=actor_id)
    c.execute("""
        INSERT INTO qr_tokens (token_id, token_string, po_id, site_id, expires_at, created_by)
        VALUES (?, ?, ?, ?, datetime('now', '+14 days'), ?)
    """, (f"TKN-{uuid.uuid4().hex[:6].upper()}", token, po_id, site_id, actor_id))
    
    # Audit log
    c.execute("""
        INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, metadata)
        VALUES ('PO', ?, ?, 'INVENTORY_MANAGER', 'AUTO_REPLENISHMENT_PO_CREATED', ?)
    """, (po_id, actor_id, f"Auto-generated PO #{po_number} for {reorder_qty} {unit} of {desc} (${total_amount:,.2f})"))
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "po_id": po_id,
        "po_number": po_number,
        "site_id": site_id,
        "project_name": project_name,
        "supplier_name": supplier_name,
        "item_code": item_code,
        "description": desc,
        "reorder_quantity": reorder_qty,
        "unit": unit,
        "total_amount": total_amount,
        "token": token
    }
