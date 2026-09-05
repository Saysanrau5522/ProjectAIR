# Directive: Ingest Delivery Order (DO)

## Purpose
Standard Operating Procedure (SOP) for capturing physical Delivery Orders signed at construction project sites, verifying site/PO authorization via signed QR tokens, processing handwritten or crumpled documents via AI Vision extraction, and routing low-confidence captures to human verification.

## Inputs
- **Signed QR Token**: HMAC-SHA256 token encoding `po_id`, `site_id`, `created_at`, `expires_at`.
- **DO Image**: JPEG/PNG file captured via mobile camera or uploaded via PWA.
- **Supervisor Metadata**: Supervisor phone number / identity tag, capture timestamp, optional offline sync flag.

## Operational Workflow

```
[Truck Arrives on Site] 
       │
       ▼
[Supervisor scans PO QR Code with smartphone]
       │
       ▼
[Mobile PWA validates signed token & scopes upload]
       │
       ▼
[Supervisor snaps photo of signed DO + enters phone]
       │
       ▼
[PWA stores locally in offline queue if no signal, else uploads]
       │
       ▼
[Server verifies token & writes raw image to secure storage]
       │
       ▼
[Gemini Vision model extracts line items + confidence scores]
       │
       ▼
[Deterministic validator checks schema & formula injection]
       │
      ┌┴─────────────────────────────┐
      ▼                             ▼
[Confidence >= 85%]           [Confidence < 85%]
      │                             │
[Auto-assign to PO DO Ledger] [Route to 'Needs Review' Queue]
      │                             │
      ▼                             ▼
[Trigger 3-Way Reconciliation] [Human Verifier confirms line items]
```

## Security & Anti-Fraud Measures
1. **Scoped Token Validation**: The mobile endpoint MUST reject any payload without a valid HMAC signature matching the server's secret or if `now() > expires_at`.
2. **Formula Injection Sanitization**: All extracted text (Supplier Name, Item Descriptions) MUST be sanitized to strip or escape leading formula operators (`=`, `+`, `-`, `@`) before persistence.
3. **Prompt Injection Mitigation**: The model extraction prompt MUST explicitly enforce that document text is treated purely as untrusted data and cannot issue system instructions or alter reconciliation states.
4. **Audit Immutability**: Store the SHA-256 hash and secure storage URL of the raw image alongside the extracted line items.

## Edge Cases & Error Handling
- **Dirty / Crumpled / Handwritten DO**: If the vision model returns an overall confidence score below 0.85, the DO status is marked `NEEDS_REVIEW`. It is highlighted on the HQ Dashboard with a side-by-side view of the original photo for human confirmation.
- **Offline Mode**: If network connectivity drops on site, the PWA buffers the capture in IndexedDB/localStorage with an `OFFLINE_SYNC_PENDING` status and automatically pushes once the browser re-establishes a connection.
- **Mismatched PO Number**: If the DO's extracted PO reference does not match the token's `po_id`, flag a `PO_MISMATCH_SUSPECTED` warning.
