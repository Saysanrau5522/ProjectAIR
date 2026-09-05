"""
Audit Service & Maker-Checker Governance for Project AIR.
Enforces segregation of duties, record locking, and append-only audit logging.
"""
import json
import sqlite3
from typing import Dict, Any, Optional
from execution.db_manager import get_connection

def log_audit_event(
    entity_type: str,
    entity_id: str,
    actor_id: str,
    actor_role: str,
    action: str,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    metadata: str = ""
):
    """
    Appends an immutable event to the audit_logs table.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, before_state, after_state, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        entity_type,
        entity_id,
        actor_id,
        actor_role,
        action,
        json.dumps(before_state) if before_state else None,
        json.dumps(after_state) if after_state else None,
        metadata
    ))
    conn.commit()
    conn.close()

def resolve_discrepancy(reconciliation_id: str, actor_id: str, actor_role: str, notes: str) -> Dict[str, Any]:
    """
    Step 1 (Maker / AP Specialist): Resolves a flagged discrepancy with justification notes.
    Marks record as resolved and ready for independent checker review.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
    rec = cursor.fetchone()
    if not rec:
        conn.close()
        raise ValueError(f"Reconciliation '{reconciliation_id}' not found.")
        
    if rec["is_locked"]:
        conn.close()
        raise PermissionError("Action prohibited: This record is LOCKED post-approval and cannot be modified.")
        
    before_state = dict(rec)
    
    cursor.execute("""
        UPDATE reconciliations 
        SET resolved_by = ?, resolved_at = datetime('now'), resolution_notes = ?, match_status = 'READY_FOR_APPROVAL'
        WHERE reconciliation_id = ?
    """, (actor_id, notes, reconciliation_id))
    
    conn.commit()
    
    cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
    after_state = dict(cursor.fetchone())
    conn.close()
    
    log_audit_event(
        entity_type="RECONCILIATION",
        entity_id=reconciliation_id,
        actor_id=actor_id,
        actor_role=actor_role,
        action="DISCREPANCY_RESOLVED",
        before_state=before_state,
        after_state=after_state,
        metadata=f"Resolution notes: {notes}"
    )
    
    return after_state

def approve_for_payment(reconciliation_id: str, approver_id: str, approver_role: str) -> Dict[str, Any]:
    """
    Step 2 (Checker / Finance Controller): Grants final payment approval.
    STRICT MAKER-CHECKER ENFORCEMENT: approver_id MUST NOT EQUAL resolved_by.
    Locks the record permanently once approved.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
    rec = cursor.fetchone()
    if not rec:
        conn.close()
        raise ValueError(f"Reconciliation '{reconciliation_id}' not found.")
        
    if rec["is_locked"]:
        conn.close()
        raise PermissionError("Action prohibited: Record is already permanently LOCKED.")
        
    # Enforce Maker-Checker segregation of duties!
    if rec["resolved_by"] and rec["resolved_by"] == approver_id:
        conn.close()
        error_msg = (
            f"Maker-Checker Segregation of Duties Violation: "
            f"User '{approver_id}' resolved the discrepancy on this invoice "
            f"and is strictly prohibited from granting final payment approval."
        )
        # Log the security violation in the audit log
        log_audit_event(
            entity_type="SECURITY_VIOLATION",
            entity_id=reconciliation_id,
            actor_id=approver_id,
            actor_role=approver_role,
            action="UNAUTHORIZED_APPROVAL_ATTEMPT",
            metadata=error_msg
        )
        raise PermissionError(error_msg)
        
    before_state = dict(rec)
    
    # Approve and LOCK
    cursor.execute("""
        UPDATE reconciliations 
        SET match_status = 'APPROVED', approved_by = ?, approved_at = datetime('now'), is_locked = 1
        WHERE reconciliation_id = ?
    """, (approver_id, reconciliation_id))
    
    # Also lock the linked invoice
    cursor.execute("UPDATE invoices SET status = 'APPROVED', is_locked = 1 WHERE invoice_id = ?", (rec["invoice_id"],))
    
    conn.commit()
    
    cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
    after_state = dict(cursor.fetchone())
    conn.close()
    
    log_audit_event(
        entity_type="RECONCILIATION",
        entity_id=reconciliation_id,
        actor_id=approver_id,
        actor_role=approver_role,
        action="PAYMENT_APPROVED_AND_LOCKED",
        before_state=before_state,
        after_state=after_state,
        metadata=f"Approved by {approver_id} ({approver_role}). Record permanently locked."
    )
    
    return after_state

def dispute_invoice(reconciliation_id: str, actor_id: str, actor_role: str, dispute_reason: str) -> Dict[str, Any]:
    """
    Files a formal dispute against the supplier's billing claim.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
    rec = cursor.fetchone()
    if not rec:
        conn.close()
        raise ValueError(f"Reconciliation '{reconciliation_id}' not found.")
        
    before_state = dict(rec)
    
    cursor.execute("""
        UPDATE reconciliations 
        SET match_status = 'DISPUTED'
        WHERE reconciliation_id = ?
    """, (reconciliation_id,))
    
    cursor.execute("UPDATE invoices SET status = 'DISPUTED' WHERE invoice_id = ?", (rec["invoice_id"],))
    
    conn.commit()
    cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
    after_state = dict(cursor.fetchone())
    conn.close()
    
    log_audit_event(
        entity_type="RECONCILIATION",
        entity_id=reconciliation_id,
        actor_id=actor_id,
        actor_role=actor_role,
        action="INVOICE_DISPUTED",
        before_state=before_state,
        after_state=after_state,
        metadata=dispute_reason
    )
    
    return after_state

def approve_partial_payment(reconciliation_id: str, approver_id: str, approver_role: str, notes: str = "") -> Dict[str, Any]:
    """
    Step 2B (Checker / Financial Controller): Authorizes a Short-Pay Partial Payment Voucher.
    Releases verified funds for physical deliveries received on site, while legally withholding
    disputed variances under a registered debit note. Prevents site supplier credit-stop!
    Strict Maker-Checker enforced.
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
        rec = cursor.fetchone()
        if not rec:
            raise ValueError(f"Reconciliation '{reconciliation_id}' not found.")

        if rec["is_locked"]:
            raise PermissionError("Action prohibited: Record is already locked.")

        if rec["resolved_by"] and rec["resolved_by"] == approver_id:
            error_msg = f"Maker-Checker Violation: User '{approver_id}' cannot approve a short-pay voucher they resolved."
            log_audit_event(
                entity_type="SECURITY_VIOLATION",
                entity_id=reconciliation_id,
                actor_id=approver_id,
                actor_role=approver_role,
                action="UNAUTHORIZED_PARTIAL_APPROVAL",
                metadata=error_msg
            )
            raise PermissionError(error_msg)

        before_state = dict(rec)

        # Fetch total verified amount
        cursor.execute("""
            SELECT SUM(cumulative_delivered_qty * po_unit_price) as verified_total
            FROM reconciliation_items
            WHERE reconciliation_id = ?
        """, (reconciliation_id,))
        verified_row = cursor.fetchone()
        verified_total = verified_row["verified_total"] if verified_row and verified_row["verified_total"] else 0.0

        cursor.execute("""
            UPDATE reconciliations
            SET match_status = 'PARTIALLY_APPROVED', approved_by = ?, approved_at = datetime('now'), is_locked = 1
            WHERE reconciliation_id = ?
        """, (approver_id, reconciliation_id))

        cursor.execute("UPDATE invoices SET status = 'PARTIALLY_APPROVED', is_locked = 1 WHERE invoice_id = ?", (rec["invoice_id"],))

        conn.commit()
        cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
        after_state = dict(cursor.fetchone())
    finally:
        conn.close()

    log_audit_event(
        entity_type="RECONCILIATION",
        entity_id=reconciliation_id,
        actor_id=approver_id,
        actor_role=approver_role,
        action="SHORT_PAY_VOUCHER_AUTHORIZED",
        before_state=before_state,
        after_state=after_state,
        metadata=f"Short-Pay Approved: ${verified_total:,.2f} authorized for release. Variance withheld. Notes: {notes}"
    )

    return after_state

def dispatch_dispute_notice(reconciliation_id: str, actor_id: str, actor_role: str, recipient_email: str) -> Dict[str, Any]:
    """
    Simulates sending the formal dispute letter and annotated DO proof directly
    to the vendor's Accounts Receivable department.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reconciliations WHERE reconciliation_id = ?", (reconciliation_id,))
    rec = cursor.fetchone()
    if not rec:
        conn.close()
        raise ValueError(f"Reconciliation '{reconciliation_id}' not found.")

    conn.close()

    log_audit_event(
        entity_type="DISPUTE_DISPATCH",
        entity_id=reconciliation_id,
        actor_id=actor_id,
        actor_role=actor_role,
        action="DISPUTE_DISPATCHED_TO_VENDOR",
        metadata=f"Formal notice dispatched via electronic mail to: {recipient_email}. Timestamp logged."
    )

    return {"success": True, "reconciliation_id": reconciliation_id, "dispatched_to": recipient_email}

