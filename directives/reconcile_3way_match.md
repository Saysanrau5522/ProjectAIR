# Directive: Reconcile 3-Way Match

## Purpose
Standard Operating Procedure (SOP) for executing deterministic 3-way matching between Purchase Orders (HQ authorized orders), Delivery Orders (site-verified receipts), and Supplier Invoices (billing claims) to prevent overpayment and detect duplicate or fraudulent billings.

## Inputs
- **PO Record**: Line items, authorized quantities, agreed unit prices.
- **DO Records**: Line items, cumulative delivered quantities across multiple delivery runs.
- **Invoice Records**: Line items, billed quantities, billed unit prices, supplier invoice number.
- **Configuration**:
  - `QUANTITY_TOLERANCE_PCT`: default `0.02` (±2% to absorb acceptable measurement variance in bulk materials like gravel, sand, or ready-mix concrete).
  - `PRICE_TOLERANCE_PCT`: default `0.00` (zero tolerance on price markups above the agreed PO contract).

## Matching Logic & Rules

### 1. Duplicate Invoice Check
Before any matching is performed:
- Check for existing invoices matching `(supplier_name, invoice_number)`.
- If a match exists, immediately reject/flag with `DUPLICATE_INVOICE_REJECTED` and abort reconciliation.

### 2. Multi-Document (Many-to-One) Aggregation
Construction projects routinely involve split shipments. For each line item matching the PO:
- `Cumulative Ordered Qty` = Sum of authorized quantity in PO.
- `Cumulative Delivered Qty` = Sum of received quantities across all linked DOs for this PO.
- `Cumulative Billed Qty` = Sum of invoiced quantities across all linked Invoices for this PO.

### 3. Discrepancy Evaluation
For each line item:
1. **Quantity Overbilling Check**:
   $$\text{Variance Qty} = \text{Cumulative Billed Qty} - \text{Cumulative Delivered Qty}$$
   If $\text{Variance Qty} > (\text{Cumulative Delivered Qty} \times \text{QUANTITY\_TOLERANCE\_PCT})$, flag as:
   `DISCREPANCY_FLAGGED: QUANTITY_OVERBILLING`.
   Calculate blocked overpayment: $\text{Variance Qty} \times \text{Billed Unit Price}$.

2. **Price Markup Check**:
   $$\text{Price Variance} = \text{Billed Unit Price} - \text{PO Unit Price}$$
   If $\text{Price Variance} > (\text{PO Unit Price} \times \text{PRICE\_TOLERANCE\_PCT})$, flag as:
   `DISCREPANCY_FLAGGED: PRICE_MARKUP`.
   Calculate blocked overpayment: $\text{Price Variance} \times \text{Cumulative Billed Qty}$.

3. **Missing Receipt Check**:
   If $\text{Cumulative Billed Qty} > 0$ and $\text{Cumulative Delivered Qty} == 0$, flag as:
   `DISCREPANCY_FLAGGED: UNRECEIVED_MATERIAL_BILLED`.

### 4. Categorization Queues
- **Ready for Approval (100% Match)**: All line items satisfy tolerances; cumulative billed $\le$ cumulative delivered; billed price $\le$ PO price.
- **Discrepancies Queue**: Any line item fails tolerance tests. Must be highlighted aggressively in Pixel Sun Yellow with detailed variance metrics and 1-click dispute options.
- **Needs Review Queue**: Any underlying document has extraction confidence $< 85\%$.
