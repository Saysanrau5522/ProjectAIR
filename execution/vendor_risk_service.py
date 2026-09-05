"""
Vendor Risk Scoring & Contract Analytics Service for Project AIR.
Analyzes historical delivery orders, invoice discrepancies, and delivery patterns
to compute supplier risk ratings (A, B, C) and generate actionable renegotiation strategies.
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from execution.db_manager import get_connection, execute_query

def calculate_vendor_risk_profile(supplier_name: str) -> Dict[str, Any]:
    """
    Computes real-time empirical risk metrics for a given supplier:
    - Total Purchase Orders & Total Invoices processed
    - Total Discrepancies flagged & Discrepancy Rate (%)
    - Under-delivery patterns by day-of-week (e.g., Friday under-deliveries)
    - Total overpayment blocked ($)
    - Risk Grade ('A', 'B', or 'C')
    - Strategic Contract Renegotiation Insights
    """
    conn = get_connection()
    c = conn.cursor()
    
    # 1. Total POs and aggregate spend
    c.execute("""
        SELECT COUNT(*) as po_count, COALESCE(SUM(total_amount), 0) as total_spend
        FROM purchase_orders
        WHERE supplier_name = ?
    """, (supplier_name,))
    po_stat = c.fetchone()
    total_pos = po_stat["po_count"]
    total_spend = float(po_stat["total_spend"])
    
    # 2. Total Invoices and Reconciliations
    c.execute("""
        SELECT COUNT(*) as inv_count,
               COALESCE(SUM(r.total_overpayment_blocked), 0) as blocked_amt,
               COALESCE(SUM(CASE WHEN r.has_discrepancy = 1 THEN 1 ELSE 0 END), 0) as discrepancy_count
        FROM invoices inv
        LEFT JOIN reconciliations r ON inv.invoice_id = r.invoice_id
        WHERE inv.supplier_name = ?
    """, (supplier_name,))
    inv_stat = c.fetchone()
    total_invoices = inv_stat["inv_count"]
    discrepancy_count = inv_stat["discrepancy_count"]
    blocked_amount = float(inv_stat["blocked_amt"])
    
    # 3. Analyze DO delivery days for under-delivery patterns
    # In SQLite, strftime('%w', date) gives day of week: 0=Sunday, 5=Friday, 6=Saturday
    c.execute("""
        SELECT do.delivery_date, strftime('%w', do.delivery_date) as dow,
               dli.quantity_received, poli.quantity as po_qty,
               (poli.quantity - dli.quantity_received) as shortfall
        FROM delivery_orders do
        JOIN do_line_items dli ON do.do_id = dli.do_id
        JOIN purchase_orders po ON do.po_id = po.po_id
        JOIN po_line_items poli ON po.po_id = poli.po_id
        WHERE do.supplier_name = ? AND dli.quantity_received < poli.quantity
    """, (supplier_name,))
    shortfalls = c.fetchall()
    
    total_shortfalls = len(shortfalls)
    friday_shortfalls = sum(1 for s in shortfalls if s["dow"] == "5" or "Fri" in str(s["delivery_date"]))
    friday_underdelivery_rate = (friday_shortfalls / max(total_shortfalls, 1)) * 100 if total_shortfalls > 0 else 0.0
    
    conn.close()
    
    # Discrepancy rate
    denom = max(total_invoices, 1)
    discrepancy_rate = (discrepancy_count / denom) * 100.0 if total_invoices > 0 else 0.0
    
    # Risk Grade calculation
    # A: Discrepancy rate < 5% and low variance
    # B: Discrepancy rate 5% - 20%
    # C: Discrepancy rate > 20% or high Friday under-deliveries
    if discrepancy_rate <= 5.0 and total_invoices > 0:
        risk_grade = "A"
        grade_label = "Grade A (Prime / Preferred Vendor)"
    elif discrepancy_rate <= 20.0:
        risk_grade = "B"
        grade_label = "Grade B (Moderate Risk / Monitored)"
    else:
        risk_grade = "C"
        grade_label = "Grade C (High Discrepancy Risk)"
        
    # Strategic Insights for contract renegotiation
    insights = []
    if friday_underdelivery_rate >= 20.0 or friday_shortfalls >= 1:
        insights.append(
            f"High Friday Under-Delivery Pattern: {friday_underdelivery_rate:.1f}% of short deliveries occur on Fridays before weekend shutdowns. "
            f"Tactical Action: Mandate Thursday morning deliveries or require digital scale tickets for Friday shipments."
        )
        
    if blocked_amount > 0:
        insights.append(
            f"Overbilling Exposure: Project AIR has blocked ${blocked_amount:,.2f} in unverified billings. "
            f"Contract Action: Enforce 2% contractual penalty on invoices with unverified quantity variance > 5%."
        )
        
    if discrepancy_rate > 15.0:
        insights.append(
            f"High Billing Friction: {discrepancy_rate:.1f}% discrepancy rate on submitted invoices. "
            f"Renegotiation Leverage: Demand Net 45-day payment terms instead of Net 14 to buffer reconciliation audits."
        )
    else:
        insights.append(
            f"Reliable Delivery Performance: {100.0 - discrepancy_rate:.1f}% fulfillment accuracy. "
            f"Action: Eligible for fast-track auto-settlement and volume discount renegotiations."
        )
        
    return {
        "supplier_name": supplier_name,
        "risk_grade": risk_grade,
        "grade_label": grade_label,
        "total_orders": total_pos,
        "total_invoices": total_invoices,
        "total_spend": round(total_spend, 2),
        "discrepancy_count": discrepancy_count,
        "discrepancy_rate": round(discrepancy_rate, 1),
        "friday_underdelivery_rate": round(friday_underdelivery_rate, 1),
        "total_overpayment_blocked": round(blocked_amount, 2),
        "contract_insights": insights
    }

def get_all_vendor_risk_profiles() -> List[Dict[str, Any]]:
    """Fetches risk scorecards for all unique suppliers across the system."""
    suppliers = execute_query("""
        SELECT DISTINCT supplier_name FROM purchase_orders
        UNION
        SELECT DISTINCT supplier_name FROM invoices
        ORDER BY supplier_name
    """)
    profiles = []
    for s in suppliers:
        name = s["supplier_name"]
        if name:
            profiles.append(calculate_vendor_risk_profile(name))
    return profiles
