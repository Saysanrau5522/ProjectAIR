"""
Database Purge / Clean Reset Utility for Project AIR.
Purges all demonstration fixtures, mock purchase orders, delivery orders,
invoices, reconciliations, and inventory ledgers, leaving a pristine,
production-ready database for live company data.
"""
import os
import sys
from pathlib import Path

# Ensure root is in path
sys.path.insert(0, str(Path(__file__).parent.parent))

from execution.db_manager import get_connection, init_db

def purge_mock_data(keep_default_sites: bool = True):
    """
    Clears all mock transactions and resets tables to zero records.
    """
    print("[DB Clean] Initializing schema...")
    init_db()
    
    conn = get_connection()
    conn.execute("PRAGMA foreign_keys = OFF;")
    cursor = conn.cursor()
    
    tables_to_clear = [
        "reconciliation_items",
        "reconciliations",
        "invoice_line_items",
        "invoices",
        "do_line_items",
        "delivery_orders",
        "po_line_items",
        "purchase_orders",
        "inventory_stocks",
        "vendor_risk_metrics",
        "qr_tokens",
        "audit_logs"
    ]
    
    for table in tables_to_clear:
        cursor.execute(f"DELETE FROM {table};")
        
    # Reset SQLite autoincrement sequences
    try:
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('" + "','".join(tables_to_clear) + "');")
    except Exception:
        pass
        
    # Log the system clean initialization in audit trail
    cursor.execute("""
        INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_role, metadata)
        VALUES ('SYSTEM', 'PRODUCTION_RESET', 'DATABASE_PURGED_CLEAN', 'SYSTEM_ADMIN', 'ADMIN',
                'All demonstration fixtures purged. Database initialized clean for production.')
    """)
    
    conn.commit()
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.close()
    
    print("[DB Clean] Successfully purged all mock fixtures!")
    print("[DB Clean] Database is now 100% clean and ready for real production intake.")

if __name__ == "__main__":
    purge_mock_data(keep_default_sites=True)
