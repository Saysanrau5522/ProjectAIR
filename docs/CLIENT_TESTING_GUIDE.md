# Client Demonstration & Testing Guide: Project AIR (v2.2 Enterprise)
## AI Document Reconciliation Engine for Construction SMEs

This guide is designed for **non-technical professionals, founders, and consultants** presenting to construction company executives, financial controllers, and procurement directors.

---

## 1. What Problem Does This Solve? (The 60-Second Client Pitch)

In construction, materials (cement, rebar, gravel, concrete) are ordered by Headquarters, delivered to active job sites by dump trucks and flatbeds, and billed weeks later by suppliers.

This creates the **"3-Way Match" Challenge**:
1. **Purchase Order (PO)**: What HQ ordered (e.g., 1,000 bags of cement @ $8.50/bag).
2. **Delivery Order (DO)**: What the truck actually brought to the job site. The site supervisor signs a paper DO on a clipboard (e.g., only 800 bags arrived; 200 bags were backordered).
3. **Supplier Invoice**: What the supplier bills HQ for (they often mistakenly bill for the full 1,000 bags!).

### Why Construction SMEs Lose Millions:
- Paper DOs get crumpled, stained with grease/coffee, or lost in the supervisor's pickup truck.
- By the time Finance at HQ gets the invoice, they don't have the signed DO, assume all 1,000 bags arrived, and pay the bill.
- **The company pays for materials they never physically received!**
- **The Credit-Stop Dilemma**: If Finance holds back 100% of payment when 200 bags are missing, the supplier halts deliveries tomorrow, stopping an entire high-rise crane operation.

### Project AIR's Solution:
- **Zero-Friction Mobile Intake**: The site supervisor uses their phone camera to scan a wall QR poster or enters a 6-digit Site PIN. No raw tokens, no passwords, no apps to install.
- **AI Vision Engine**: Automatically reads handwritten, stained, and crumpled DOs, extracting quantities and line items with specificity checks (e.g. 10mm vs 16mm rebar strictly separated).
- **Dynamic UOM Conversion**: Converts Pallets to Bags (1 pallet = 40 bags) and Tons to kg automatically.
- **Short-Pay Approval Workflow**: Authorizes payment for verified deliveries ($6,800) immediately to keep job sites supplied, while legally withholding disputed variances ($1,700) under an automated debit note.
- **1-Click ERP Export**: Generates accounting batches for QuickBooks, Xero, and Sage 300 CRE.

---

## 2. Accessing the Live Dashboard

Ensure both local servers are running:
- **Frontend Dashboard & Mobile PWA URL**: [http://localhost:5173/](http://localhost:5173/)
- **Backend API Health**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

Open [http://localhost:5173/](http://localhost:5173/) in Google Chrome, Edge, or Safari.

---

## 3. Step-by-Step Client Demo Script (Follow This in Order)

### Step 1: The Modern Executive Dashboard & Real-Time Leakage Prevention
- **What to show**: Point to the **Modern Executive Dashboard** at the center of the screen:
  - **4 Top KPI Cards**:
    - **Total Disbursed Budget**: Shows active procurement spend with trend indicators.
    - **Blocked Over-Billing**: Highlighted metric showing exact dollars saved from contractor overbilling.
    - **Auto-Reconciliation Rate**: 94.2% verified straight-through matching.
    - **Active Discrepancies**: Variance counter with direct jump link.
  - **Visual Analytics Charts**:
    - **Disbursement Performance Area Chart**: Smooth trend curve showing monthly spend vs deliveries.
    - **Spend by GL Category Donut Chart**: Breakdown across Materials (5010-MAT), Concrete (5020-CONC), Equipment (5040-EQP), and Safety (6030-SAFE).
  - **Recent Transactions & Top Materials Widgets**: Live audit stream and critical inventory monitors.
- **What to say**: *"At a single glance, the CFO sees exactly how much money the AI engine has protected from leakage today, with complete visibility over cash disbursements and GL expense allocation."*

---

### Step 2: The Core Scenario — 200 Missing Cement Bags & The Short-Pay Solution
- **Where to click**: In the left sidebar, click **`Match Matrix`**.
- **What to show**:
  - Select `[DISCREPANCY_FLAGGED] PO-2026-001 // MegaMix Cement & Concrete Corp`.
  - Point out the numbers in the table:
    - **PO Ordered**: `1,000 Bags` @ `$8.50` ($8,500 contract value)
    - **Site Delivered (DOs)**: `800 Bags` (yellow highlighted)
    - **Billed (Inv)**: `1,000 Bags` @ `$8.50`
    - **Variance**: `+200 Bags`
    - **Overpayment Blocked**: `$1,700.00`
- **The Wow Moment (Solving Credit Stop)**:
  - Point to the green button: **`APPROVE VERIFIED ($6,800.00) & DISPUTE VARIANCE`**.
  - Click it to open the **Short-Pay Partial Payment Voucher**.
  - Show the side-by-side breakdown:
    - **Authorized for Immediate Release**: `$6,800.00` (800 verified bags)
    - **Withheld Under Debit Note**: `$1,700.00` (200 missing bags)
  - **What to say**: *"Here is our biggest operational breakthrough: In construction, if you withhold 100% of payment, the concrete supplier freezes your account and halts deliveries tomorrow. With Project AIR Short-Pay, the Financial Controller authorizes the $6,800 for the cement that actually arrived, keeping the cranes turning, while legally locking the $1,700 variance under an automated debit note."*
  - Click **`CONFIRM SHORT-PAY AUTHORIZATION`** to lock the record!

---

### Step 3: Direct Vendor Dispute Dispatch
- **What to click**: Click **`VIEW DISPUTE NOTICE / DISPATCH`**.
- **What to show**:
  - The formal legal dispute notice citing PO #, Invoice #, and physical DO discrepancy.
  - The direct email dispatch field: enter `ar-disputes@megamix-cement.com` and click **`SEND EMAIL NOTICE`**.
  - Notice the immutable audit confirmation logged.

---

### Step 4: 1-Click Accounting & ERP Sync (Export Engine)
- **Where to click**: In the top right of the 3-Way Match Matrix, click **`EXPORT TO ERP (CSV)`**.
- **What happens**: The browser instantly downloads `AIR_Accounting_Disbursement_Batch.csv`.
- **What to say**: *"With 1 click, the accounts payable team exports the clean, approved payment voucher batch directly into QuickBooks Online, Xero, or Sage 300 CRE for automated bank wire transfer. Zero double-entry."*

---

### Step 5: Zero-Friction Mobile Intake (For the Site Foreman)
- **Where to click**: In the left sidebar under **OPERATIONS**, click **`Mobile DO Scanner`**.
- **What to show**:
  - **No Raw JWT Strings**: Foremen never see raw code or cryptographic strings.
  - **Active Site Selector / 6-Digit PIN**: Switch between site selector and 6-digit PIN.
  - **Live Camera Viewfinder**: Click `SCAN SITE WALL QR` (or `AUTO-DETECT QR` for instant desktop demo).
  - **Physical Ticket Capture**: Click `TAKE PHOTO / UPLOAD TICKET` or adjust the delivery quantity slider.
  - **Offline Resilience**: Works without internet on remote job sites; photos queue locally and auto-sync when 4G returns.

---

### Step 6: Automated Supplier Invoice Ingestion & Smart GL Coding
- **Where to click**: In the top navigation bar, click the solid white **`+ Log Invoice`** button.
- **What to show**:
  - Point to the **AI Invoice Vision Extractor dropzone**.
  - Click **`DEMO: MEGAMIX CEMENT`** (or drag in any invoice file).
  - Watch the invoice number, billing date, and line items auto-populate in under 1 second!
  - **Smart General Ledger (GL) Coding**: Notice that the system automatically assigns standard Chart of Accounts (COA) codes:
    - Rebar / Cement $\to$ `5010-MAT: COGS - Direct Materials`
    - Ready-Mix Concrete $\to$ `5020-CONC: COGS - Concrete & Structural Mixes`
    - Hardhats & PPE $\to$ `6030-SAFE: Operating Expenses - Safety & PPE`
    - Diesel Fuel $\to$ `5050-FUEL: Job Cost - Fuel & Utilities`
  - Click **`SUBMIT INVOICE & RUN 3-WAY MATCH`**.

---

### Step 7: Real-Time Site Inventory Ledger (Zero-Entry Stock Management)
- **Where to click**: In the left sidebar under **OPERATIONS**, click **`Site Inventory`**.
- **What to show**:
  - **Zero Manual Data Entry**: Explain that whenever a site supervisor scans a Delivery Order, the physical stock balance automatically increments in the database in real-time.
  - **Safety Threshold Badges**:
    - `CRITICAL LOW`: Point out items below minimum reorder level (e.g. Washed Aggregate at Harbor Bridge or Safety Hardhats at West Coast Hub).
    - `HEALTHY`: Green balance bars for adequately stocked materials.
  - **1-Click Draft Replenishment PO**:
    - Click **`⚡ DRAFT PO`** on any critical item.
    - An instant modal appears: **`Purchase Order #PO-2026-REPL-XXXX Created`**!
    - The system automatically looked up the historical supplier and unit price, generated the order with the batch replenishment quantity, registered it in HQ's procurement ledger, and issued a digital Scoped QR Pass for the site foreman.
- **What to say**: *"Finance and procurement no longer need to call foremen to find out if they are running low on rebar or gravel. The system continuously tallies verified site deliveries, flags low stock, and lets HQ draft a replenishment PO with a single click."*

---

### Step 8: Vendor Risk Scorecards & Contract Renegotiation Analytics
- **Where to click**: In the left sidebar under **STRATEGIC ANALYTICS**, click **`Vendor Risk`**.
- **What to show**:
  - **Supplier Risk Grades**:
    - `Grade A`: Preferred suppliers with 0% discrepancy rate (e.g. Titan Steel Rebar Ltd).
    - `Grade C (High Risk)`: Flagged suppliers with repeat overbillings (e.g. MegaMix Cement).
  - **Empirical Discrepancy & Overpayment Metrics**: Shows total dollar leakage prevented per supplier.
  - **The "Friday Under-Delivery" Pattern Detector**:
    - Points out contractors who under-ship deliveries on Friday afternoons before weekend shutdowns.
  - **Actionable Contract Renegotiation Bullet Points**:
    - Point out hard recommendations generated for the procurement director:
      - *"Overbilling Exposure: Enforce 2% contractual penalty on invoices with unverified quantity variance > 5%."*
      - *"High Billing Friction: Demand Net 45-day payment terms instead of Net 14."*
      - *"Friday Delivery Pattern: Mandate Thursday morning delivery schedules or digital scale tickets."*
- **What to say**: *"Procurement directors usually go into contract renewal meetings blind. Project AIR gives your client hard empirical data to renegotiate better terms, demand longer credit windows, and enforce strict delivery penalties."*

---

### Step 9: Multilingual Standardization & Multi-Site Delivery Orders (Split Drops)
- **What to explain & demonstrate**:
  - **Multilingual Normalization**: In Southeast Asian / multicultural construction, tickets mix English, Bahasa Melayu (*simen*, *besi tetulang*, *surat hantaran*), and Chinese (*水泥/洋灰*, *钢筋*, *送货单*). The AI natively translates and standardizes these into uniform English JSON before database storage.
  - **Fuzzy Item Matching with Dimension Isolation**: Semantic similarity links `Cem-P 50kg bag` $\leftrightarrow$ `Portland Cement Grade 42.5` while strictly isolating engineering dimensions (e.g., 10mm vs 16mm rebar returns 0.0 similarity, preventing catastrophic structural mismatch).
  - **Multi-Site Split Drops (Scenario 4)**: In the 3-Way Match Matrix, select `PO-2026-004 // Southern Aggregate & Ready-Mix Corp`. One 80 Cu M delivery was split across West Coast Ramp (30 Cu M) and Tower B (50 Cu M), and the system aggregated and credited both site inventories correctly.

---

### Step 10: The Unbreakable Audit Trail (Maker-Checker Fraud Prevention)
- **Where to click**: In the left sidebar under **STRATEGIC ANALYTICS**, click **`Audit Log`**.
- **What to show**:
  - Every single action—DO capture, OCR confidence score, Maker resolution, Checker approval, Short-Pay voucher, stock auto-increment, and ERP export—is permanently recorded in an append-only ledger.
  - Point out that the actor who resolves a discrepancy cannot approve the invoice (Maker-Checker separation of duties).

---

## 4. Executive Talking Points & Objection Handling

| Question / Objection | Your Confident Answer |
| :--- | :--- |
| **"Our site supervisors won't download an app or enter passwords."** | *"They don't have to. It is a zero-onboarding PWA. They point their camera at a poster on the site shed wall or enter a 6-digit PIN, take a photo, and they're done."* |
| **"Our paper tickets are dirty, grease-stained, and crumpled."** | *"Project AIR is trained on real construction job-site tickets. If a ticket is too degraded to read with 85% confidence, it is automatically routed to the human verification queue rather than making an unverified guess."* |
| **"What if suppliers use different names or languages on their tickets?"** | *"The engine has native multilingual normalization (translating Bahasa Melayu and Chinese to standard English) and uses semantic matching with strict engineering dimension isolation (e.g. 10mm vs 16mm rebar are strictly separated)."* |
| **"Withholding payment will make suppliers stop delivering."** | *"That is why we built Short-Pay Partial Payment Vouchers. You pay for what arrived immediately to keep the job site operating, while automatically generating a debit note for the missing balance."* |
| **"How does this help our site inventory management?"** | *"Every verified DO automatically updates on-hand site inventory without anyone keying in data. When stocks drop below safety levels, procurement can generate a draft replenishment PO with 1 click."* |
| **"How do we hold bad suppliers accountable?"** | *"The Vendor Risk Scorecard tracks every supplier's historical discrepancy rate, Friday shortfalls, and blocked leakage, giving you hard empirical ammunition to renegotiate contracts and payment terms."* |

