# Directive: Manage Approvals & Audit Trail

## Purpose
Standard Operating Procedure (SOP) for enforcing Maker-Checker segregation of duties, post-approval record immutability, dispute communication, and append-only audit logging.

## Core Controls

### 1. Maker-Checker Segregation of Duties
To prevent internal fraud and rogue approvals:
- **Discrepancy Resolver (Maker / AP Specialist)**: Can review flagged mismatches, contact suppliers, upload credit notes, or propose quantity adjustments.
- **Approver (Checker / Finance Controller)**: Holds exclusive permission to finalize approval for payment release.
- **Strict Rule**: The user ID that resolves or edits a flagged line item CANNOT be the user who grants final payment approval for that invoice (`resolver_id != approver_id`).
- Any attempt by the same actor to execute both steps MUST be blocked by backend middleware and logged as an authorization violation.

### 2. Record Locking & Immutability
- Once an invoice achieves `APPROVED` status, all related database records (PO, DO link, Invoice, Reconciliation status) are permanently LOCKED (`is_locked = TRUE`).
- The backend rejects any `UPDATE` or `DELETE` queries on locked records.
- Post-approval adjustments require an explicit Reversal / Credit Note entry with a separate audit trail rather than mutating existing rows.

### 3. Append-Only Audit Logging
Every business-critical mutation must write an immutable audit log entry containing:
- `id`: Auto-incrementing UUID / sequence.
- `entity_type`: `PO`, `DO`, `INVOICE`, or `RECONCILIATION`.
- `entity_id`: Identifier of the impacted record.
- `actor_id`: User or system service identifier.
- `actor_role`: e.g. `SITE_SUPERVISOR`, `AP_SPECIALIST`, `FINANCE_CONTROLLER`, `SYSTEM`.
- `action`: e.g. `CREATED`, `EXTRACTED`, `DISCREPANCY_RESOLVED`, `APPROVED`, `DISPUTED`, `LOCKED`.
- `before_state`: JSON snapshot of prior state.
- `after_state`: JSON snapshot of updated state.
- `timestamp`: UTC ISO-8601 timestamp.

### 4. Supplier Dispute Workflow
When an invoice is disputed due to overbilling:
- Generate an official Dispute Notice referencing:
  - PO Reference, Supplier Invoice #, and Site DO numbers.
  - Line-by-line breakdown of ordered vs physically delivered vs overbilled quantities.
  - Net authorized payment amount (retaining undisputed amount, withholding disputed amount).
- Update reconciliation status to `DISPUTED` and notify AP team.
