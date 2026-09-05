# Project AIR: Production Backend & API Connection Guide
**Autonomous AI 3-Way Document Reconciliation Engine**  
*Target Architecture: Production Cloud & Edge Deployment*

---

## 1. Status: Mock Data Purged Successfully

All demonstration and mock fixtures have been **completely purged** from the live database (`account_ai.db`):
- `purchase_orders`: **0 records**
- `delivery_orders`: **0 records**
- `invoices`: **0 records**
- `reconciliations`: **0 records**
- `inventory_stocks`: **0 records**
- `vendor_risk_metrics`: **0 records**
- `qr_tokens`: **0 records**

> [!TIP]
> **1-Click Database Reset Utility:**  
> If you ever need to purge test intake data again during client onboarding, simply run:
> ```bash
> python execution/clean_db.py
> ```
> Or call the backend API endpoint:
> `POST http://localhost:8000/api/system/reset-clean`

---

## 2. Step-by-Step API Connection Blueprint

To transition from local development to production with real suppliers and live construction documents, follow these 5 steps:

```mermaid
flowchart LR
    subgraph JobSite [Job Site Mobile PWA]
        Worker[Site Supervisor Phone] -->|Uploads DO Photo| Storage[Cloudflare R2 / AWS S3]
    end

    subgraph BackendAIR [Project AIR Backend]
        Storage -->|Passes Image Buffer| Vision[AI Vision: Gemini 2.0 / GPT-4o]
        Vision -->|Structured JSON| Engine[Deterministic 3-Way Match Engine]
        Engine -->|Zero-Leakage Ledger| DB[(PostgreSQL / Supabase)]
    end

    subgraph Integrations [External Business APIs]
        Engine -->|Approved Payment Batch| ERP[QuickBooks / Xero API]
        Engine -->|Automated Variance Notice| Mailer[Postmark / SendGrid / WhatsApp]
    end
```

---

### Step 1: Connect AI Document Vision (Google Gemini or OpenAI)

The AI Vision extractor parses crumpled, handwritten delivery orders (DOs) and PDF/scanned supplier invoices, standardizing them into structured line items.

#### Option A: Google Gemini 2.0 Flash (Recommended — Fastest & Cost-Effective)
1. Navigate to [Google AI Studio](https://aistudio.google.com/) and sign in with your Google account.
2. Click **Get API Key** &rarr; **Create API Key in new project**.
3. Copy the generated API key (`AIzaSy...`).
4. Open the `.env` file in the root project folder:
   ```env
   GEMINI_API_KEY=AIzaSyYourRealKeyHere
   GEMINI_MODEL=gemini-2.0-flash
   ```
5. Restart the backend service:
   ```powershell
   python execution/server.py
   ```
6. **Test Extraction:** In the dashboard under **Live Ingestion**, upload any real photo or PDF invoice. The system will send the image directly to Gemini Vision, validate against the strict JSON schema, and score field-level confidence.

#### Option B: OpenAI GPT-4o Vision
If your organization standardizes on OpenAI:
1. Sign up at [platform.openai.com](https://platform.openai.com/api-keys) and generate an API key (`sk-proj-...`).
2. Set in `.env`:
   ```env
   OPENAI_API_KEY=sk-proj-YourOpenAiKeyHere
   ```
3. In `execution/vision_extractor.py`, set the default extractor to `extract_with_openai(image_bytes)`.

---

### Step 2: Connect Production Cloud Storage (AWS S3 or Cloudflare R2)

In development, photos are stored in `./storage`. In production, mobile uploads from job sites should stream directly into an S3-compatible bucket.

1. **Create Bucket:**
   - **Cloudflare R2** (recommended for zero egress fees) or **AWS S3**.
   - Bucket Name: `air-construction-documents-prod`
2. **Obtain S3 Credentials:**
   - Access Key ID
   - Secret Access Key
   - Bucket Endpoint URL (e.g., `https://<account_id>.r2.cloudflarestorage.com`)
3. **Configure in `.env`:**
   ```env
   STORAGE_PROVIDER=s3
   S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
   S3_BUCKET_NAME=air-construction-documents-prod
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   ```
4. **Pre-signed Direct Uploads:**  
   The Mobile PWA requests a pre-signed URL from `/api/upload/presign`, uploading photos straight from the phone to S3/R2 with low mobile latency.

---

### Step 3: Connect Accounting & ERP Systems (QuickBooks / Xero)

Once the Financial Controller clicks **Authorize Release** or **Short-Pay Approved**, the disbursement must sync to the accounting ledger.

#### 1. Instant Automated CSV Sync (Ready Now Out of the Box)
- Click **Export ERP Batch** in the **Match Matrix** or **Approval Queue**.
- Generates `AIR_Accounting_Disbursement_Batch.csv` pre-formatted with:
  - `VoucherRef`, `PostingDate`, `VendorName`, `ProjectSite`, `PONumber`, `InvoiceNumber`, `BilledAmount`, `VarianceWithheld`, `ApprovedPayoutAmount`, `GLAccount` (e.g., `5010-MAT`, `5020-CONC`), `GLCategory`, and `AuthorizedBy`.
- Import directly into QuickBooks Online (**Gear &rarr; Import Data &rarr; Bills**) or Xero (**Accounting &rarr; Bills &rarr; Import**).

#### 2. Real-Time REST Webhook Integration (Direct API)
To post bills automatically via API upon approval:
1. Register a developer app at [Intuit Developer](https://developer.intuit.com/) (QuickBooks) or [Xero Developer](https://developer.xero.com/).
2. Add the OAuth credentials to `.env`:
   ```env
   QUICKBOOKS_CLIENT_ID=your_client_id
   QUICKBOOKS_CLIENT_SECRET=your_client_secret
   QUICKBOOKS_REALM_ID=your_company_realm_id
   QUICKBOOKS_ACCESS_TOKEN=your_oauth_token
   ```
3. In `execution/audit_service.py`, `approve_for_payment()` triggers `POST https://quickbooks.api.intuit.com/v3/company/{realm}/bill` with the verified line items and mapped GL codes.

---

### Step 4: Connect Automated Vendor Dispute Dispatch (Postmark / SendGrid / WhatsApp)

When a supplier attempts to bill for more materials than signed for on site, Project AIR automatically generates an audit report and dispute letter.

1. **Email Gateway (SendGrid / Postmark):**
   - Create an API key at [Postmark](https://postmarkapp.com/) or [SendGrid](https://sendgrid.com/).
   - Add to `.env`:
     ```env
     MAIL_PROVIDER=postmark
     POSTMARK_SERVER_TOKEN=your_postmark_token_here
     DISPUTE_FROM_EMAIL=finance@yourcompany.com
     ```
   - When the user clicks **Dispatch Dispute Notice**, the backend sends an itemized email with the signed delivery slip attached and withheld variance breakdown.

2. **WhatsApp Business Cloud API (For Subcontractors):**
   - In regions where construction suppliers communicate via WhatsApp:
   - Configure Meta WhatsApp Cloud API credentials:
     ```env
     WHATSAPP_TOKEN=your_meta_token
     WHATSAPP_PHONE_ID=your_business_phone_id
     ```
   - The system dispatches a PDF dispute summary directly to the supplier's AR contact.

---

### Step 5: Migrate Database to Cloud PostgreSQL (Supabase / RDS)

For production multi-user concurrency across HQ and job sites:

1. Create a free managed PostgreSQL instance on [Supabase](https://supabase.com/) or AWS RDS.
2. Retrieve the PostgreSQL Connection String:
   ```
   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
3. Run the schema initialization:
   ```bash
   psql "postgresql://..." -f execution/schema.sql
   ```
4. Set in `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
   The backend automatically switches from SQLite to PostgreSQL connection pooling.

---

## 3. How to Ingest Real Data Now (Operational Flow)

Now that mock data is removed, here is how you and your client start using the platform with live projects:

### Step 1: Register Your Real Project Sites
1. Open the Dashboard &rarr; **Project Sites** tab.
2. Verify or add your real job sites (e.g., `Site Alpha - Tower B`, `Highway Interchange #4`).

### Step 2: Register Real Purchase Orders
1. Click **+ New Purchase Order** in the top navigation or sidebar.
2. Enter the real PO Number, Supplier Name, and line items (Quantity, Unit Price, Description).
3. Click **Authorize & Commit PO**.

### Step 3: Issue QR Access for Site Supervisors
1. Go to **QR Access Tokens** tab.
2. Select the Job Site and PO, click **Generate Signed Scoped QR Token**.
3. The site supervisor scans this QR with their phone camera to instantly open the Mobile Ingestion PWA without passwords or manual logins.

### Step 4: Ingest Delivery Orders from the Field
1. The supervisor snaps a photo of the physical paper Delivery Order signed by the driver.
2. The AI Vision service extracts line items, quantities, and site drop locations in real time.
3. Quantities are instantly posted to the **Site Inventory Stock Ledger**.

### Step 5: Ingest Supplier Invoice & Reconcile
1. When the vendor sends their bill, click **+ Ingest Invoice** in the HQ Dashboard.
2. Enter the invoice or upload the PDF.
3. The system executes the **3-Way Reconciliation Engine** in milliseconds:
   - If quantities and prices match &rarr; marked `READY_FOR_APPROVAL`.
   - If overbilling or unreceived items exist &rarr; marked `DISCREPANCY_FLAGGED` and payment is halted.
   - The Controller can execute a **Short-Pay Approval** to disburse only the verified amount while withholding the unverified claim.

---

## 4. Production Checklist

- [x] All mock and demonstration data purged from database.
- [x] Clean zero-state fallbacks implemented on all UI screens.
- [x] Strict formula injection protection active on text ingestion.
- [x] Immutable append-only audit trail active for financial compliance.
- [ ] Add real `GEMINI_API_KEY` into `.env`.
- [ ] Connect S3/R2 storage bucket for document image archiving.
- [ ] Configure ERP accounting export or direct webhook.
- [ ] Set up SendGrid/Postmark token for automated vendor dispute dispatch.
