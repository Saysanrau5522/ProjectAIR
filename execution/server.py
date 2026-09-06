"""
Project AIR REST API Backend Server.
Provides endpoints for HQ Dashboard & Mobile PWA Ingestion.
Built with Python standard library http.server for 100% dependency-free execution.
"""
import os
import sys
import json
import uuid
import time
import base64
import urllib.parse
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from execution.db_manager import get_connection, execute_query
from execution.token_manager import generate_scoped_token, verify_scoped_token
from execution.vision_extractor import process_document
from execution.matching_engine import run_reconciliation, auto_bind_delivery_order
from execution.audit_service import (
    resolve_discrepancy, approve_for_payment, dispute_invoice, log_audit_event,
    approve_partial_payment, dispatch_dispute_notice
)
from execution.inventory_service import (
    increment_stock_from_do, get_inventory_stocks, create_draft_replenishment_po
)
from execution.vendor_risk_service import (
    get_all_vendor_risk_profiles, calculate_vendor_risk_profile
)
from execution.gl_coding_service import predict_gl_code
from execution.multilingual_service import standardize_text
from execution.clean_db import purge_mock_data
from execution.seed_data import seed
from execution.storage_service import save_document, get_document_bytes

PORT = int(os.environ.get("PORT", 8000))
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", "./storage"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

class ProjectAIRRequestHandler(BaseHTTPRequestHandler):

    def _set_headers(self, status_code=200, content_type="application/json"):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Actor-Id, X-Actor-Role")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length)
        return json.loads(body.decode("utf-8"))

    def _send_json(self, data, status_code=200):
        self._set_headers(status_code, "application/json")
        self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))

    def _send_error(self, message, status_code=400):
        self._send_json({"error": str(message)}, status_code)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        try:
            if path == "/api/health":
                self._send_json({"status": "ok", "app": "Project AIR", "time": time.time()})

            elif path == "/api/hud":
                self._handle_hud_metrics()

            elif path == "/api/pos":
                self._handle_get_pos()

            elif path == "/api/reconciliations":
                self._handle_get_reconciliations()

            elif path == "/api/reconciliations/export-erp":
                self._handle_export_erp()

            elif path.startswith("/api/reconciliations/"):
                rec_id = path.split("/")[-1]
                self._handle_get_reconciliation_detail(rec_id)

            elif path == "/api/audit-logs":
                self._handle_get_audit_logs()

            elif path == "/api/sites":
                self._handle_get_sites()

            elif path == "/api/qr/tokens":
                self._handle_get_qr_tokens()

            elif path == "/api/inventory":
                site_filter = query.get("site_id", [None])[0]
                stocks = get_inventory_stocks(site_filter)
                self._send_json(stocks)

            elif path == "/api/vendors/risk":
                supp = query.get("supplier", [None])[0]
                if supp:
                    profile = calculate_vendor_risk_profile(supp)
                    self._send_json(profile)
                else:
                    profiles = get_all_vendor_risk_profiles()
                    self._send_json(profiles)

            elif path.startswith("/storage/"):
                filename = path.split("/")[-1]
                try:
                    content = get_document_bytes(filename)
                    self._set_headers(200, "image/jpeg")
                    self.wfile.write(content)
                except FileNotFoundError:
                    self._send_error("File not found", 404)
                except Exception as ex:
                    self._send_error(f"Error fetching file: {ex}", 500)

            else:
                self._send_error("Endpoint not found", 404)

        except Exception as e:
            self._send_error(e, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        actor_id = self.headers.get("X-Actor-Id", "FINANCE_USER")
        actor_role = self.headers.get("X-Actor-Role", "FINANCE_CONTROLLER")

        try:
            if path == "/api/qr/generate":
                po_id = body.get("po_id")
                site_id = body.get("site_id")
                expires_days = body.get("expires_days", 7)
                po_records = execute_query("SELECT * FROM purchase_orders WHERE po_id = ?", (po_id,))
                po_rec = po_records[0] if po_records else {}
                token = generate_scoped_token(
                    po_id, 
                    site_id, 
                    expires_in_seconds=86400 * expires_days, 
                    created_by=actor_id,
                    po_number=po_rec.get("po_number"),
                    project_name=po_rec.get("project_name"),
                    supplier_name=po_rec.get("supplier_name"),
                    total_amount=po_rec.get("total_amount")
                )
                
                conn = get_connection()
                conn.execute("""
                    INSERT INTO qr_tokens (token_id, token_string, po_id, site_id, expires_at, created_by)
                    VALUES (?, ?, ?, ?, datetime('now', ?), ?)
                """, (f"TKN-{uuid.uuid4().hex[:6].upper()}", token, po_id, site_id, f"+{expires_days} days", actor_id))
                conn.commit()
                conn.close()
                
                self._send_json({"token": token, "po_id": po_id, "site_id": site_id})

            elif path == "/api/qr/verify":
                token = body.get("token")
                payload = verify_scoped_token(token)
                
                # Fetch PO info
                pos = execute_query("SELECT * FROM purchase_orders WHERE po_id = ?", (payload["po_id"],))
                po_info = pos[0] if pos else None
                
                self._send_json({"valid": True, "payload": payload, "purchase_order": po_info})

            elif path == "/api/ingest/do":
                self._handle_ingest_do(body)

            elif path == "/api/reconciliations/resolve":
                rec_id = body.get("reconciliation_id")
                notes = body.get("notes", "Discrepancy reviewed and reconciled.")
                res_actor_id = body.get("actor_id", actor_id)
                res_actor_role = body.get("actor_role", "AP_SPECIALIST")
                result = resolve_discrepancy(rec_id, res_actor_id, res_actor_role, notes)
                self._send_json(result)

            elif path == "/api/reconciliations/approve":
                rec_id = body.get("reconciliation_id")
                app_actor_id = body.get("actor_id", actor_id)
                app_actor_role = body.get("actor_role", actor_role)
                result = approve_for_payment(rec_id, app_actor_id, app_actor_role)
                self._send_json(result)

            elif path == "/api/reconciliations/approve-partial":
                rec_id = body.get("reconciliation_id")
                notes = body.get("notes", "Authorized short-pay voucher for verified deliveries.")
                app_actor_id = body.get("actor_id", actor_id)
                app_actor_role = body.get("actor_role", actor_role)
                result = approve_partial_payment(rec_id, app_actor_id, app_actor_role, notes)
                self._send_json(result)

            elif path == "/api/reconciliations/dispatch-dispute":
                rec_id = body.get("reconciliation_id")
                recipient_email = body.get("recipient_email", "ar-disputes@vendor-corp.com")
                result = dispatch_dispute_notice(rec_id, actor_id, actor_role, recipient_email)
                self._send_json(result)

            elif path == "/api/reconciliations/dispute":
                rec_id = body.get("reconciliation_id")
                reason = body.get("reason", "Overbilling detected via 3-way match audit.")
                result = dispute_invoice(rec_id, actor_id, actor_role, reason)
                self._send_json(result)

            elif path == "/api/reconciliations/confirm-low-confidence":
                self._handle_confirm_low_confidence(body)

            elif path == "/api/pos/create":
                self._handle_create_po(body, actor_id)

            elif path == "/api/invoices/create":
                self._handle_create_invoice(body, actor_id)

            elif path == "/api/invoices/extract":
                self._handle_extract_invoice(body)

            elif path == "/api/inventory/reorder":
                stock_id = body.get("stock_id")
                result = create_draft_replenishment_po(stock_id, actor_id)
                self._send_json(result)

            elif path == "/api/system/reset-clean":
                keep_sites = body.get("keep_sites", True)
                purge_mock_data(keep_default_sites=keep_sites)
                self._send_json({
                    "status": "success",
                    "message": "All mock data purged successfully. Database is now a clean production slate."
                })

            elif path == "/api/system/seed-demo":
                seed()
                self._send_json({
                    "status": "success",
                    "message": "Demonstration fixtures loaded successfully."
                })

            else:
                self._send_error("Endpoint not found", 404)

        except PermissionError as pe:
            self._send_error(f"403 Forbidden: {pe}", 403)
        except ValueError as ve:
            self._send_error(f"400 Bad Request: {ve}", 400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._send_error(f"500 Internal Server Error: {e}", 500)

    # -------------------------------------------------------------
    # Handlers
    # -------------------------------------------------------------
    def _handle_hud_metrics(self):
        conn = get_connection()
        c = conn.cursor()
        
        c.execute("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total FROM purchase_orders")
        po_stat = c.fetchone()
        
        c.execute("SELECT COALESCE(SUM(total_overpayment_blocked), 0) as blocked FROM reconciliations")
        blocked = c.fetchone()["blocked"]
        
        c.execute("SELECT match_status, COUNT(*) as cnt FROM reconciliations GROUP BY match_status")
        status_counts = {row["match_status"]: row["cnt"] for row in c.fetchall()}
        
        c.execute("SELECT COUNT(*) as cnt FROM delivery_orders WHERE status = 'NEEDS_REVIEW'")
        low_conf_dos = c.fetchone()["cnt"]
        
        conn.close()
        
        self._send_json({
            "total_pos": po_stat["cnt"],
            "total_po_value": po_stat["total"],
            "total_overpayment_blocked": blocked,
            "ready_for_approval": status_counts.get("READY_FOR_APPROVAL", 0),
            "discrepancies_flagged": status_counts.get("DISCREPANCY_FLAGGED", 0),
            "approved": status_counts.get("APPROVED", 0),
            "disputed": status_counts.get("DISPUTED", 0),
            "needs_review": status_counts.get("NEEDS_REVIEW", 0) + low_conf_dos
        })

    def _handle_get_pos(self):
        pos = execute_query("SELECT * FROM purchase_orders ORDER BY created_at DESC")
        for po in pos:
            items = execute_query("SELECT * FROM po_line_items WHERE po_id = ?", (po["po_id"],))
            po["line_items"] = items
        self._send_json(pos)

    def _handle_get_reconciliations(self):
        query = """
            SELECT r.*, po.po_number, po.project_name, po.supplier_name, po.project_site_id,
                   inv.invoice_number, inv.invoice_date, inv.total_amount as invoice_amount
            FROM reconciliations r
            JOIN purchase_orders po ON r.po_id = po.po_id
            JOIN invoices inv ON r.invoice_id = inv.invoice_id
            ORDER BY r.created_at DESC
        """
        recs = execute_query(query)
        for rec in recs:
            items = execute_query("SELECT * FROM reconciliation_items WHERE reconciliation_id = ?", (rec["reconciliation_id"],))
            rec["items"] = items
        self._send_json(recs)

    def _handle_get_reconciliation_detail(self, rec_id: str):
        recs = execute_query("""
            SELECT r.*, po.po_number, po.project_name, po.supplier_name, po.project_site_id,
                   inv.invoice_number, inv.invoice_date, inv.total_amount as invoice_amount
            FROM reconciliations r
            JOIN purchase_orders po ON r.po_id = po.po_id
            JOIN invoices inv ON r.invoice_id = inv.invoice_id
            WHERE r.reconciliation_id = ?
        """, (rec_id,))
        if not recs:
            self._send_error("Reconciliation not found", 404)
            return
            
        rec = recs[0]
        rec["items"] = execute_query("SELECT * FROM reconciliation_items WHERE reconciliation_id = ?", (rec_id,))
        
        # Also include linked DOs for inspection
        rec["delivery_orders"] = execute_query("""
            SELECT do.*, (SELECT json_group_array(json_object('description', dli.description, 'quantity', dli.quantity_received, 'unit', dli.unit)) 
                          FROM do_line_items dli WHERE dli.do_id = do.do_id) as items_json
            FROM delivery_orders do
            WHERE do.po_id = ?
        """, (rec["po_id"],))
        
        for d in rec["delivery_orders"]:
            d["items"] = json.loads(d["items_json"]) if d.get("items_json") else []
            
        self._send_json(rec)

    def _handle_get_audit_logs(self):
        logs = execute_query("SELECT * FROM audit_logs ORDER BY log_id DESC LIMIT 100")
        self._send_json(logs)

    def _handle_get_qr_tokens(self):
        tokens = execute_query("""
            SELECT qt.*, po.po_number, po.project_name, po.supplier_name 
            FROM qr_tokens qt
            JOIN purchase_orders po ON qt.po_id = po.po_id
            ORDER BY qt.created_at DESC
        """)
        self._send_json(tokens)

    def _handle_get_sites(self):
        sites = execute_query("""
            SELECT DISTINCT project_site_id as site_id, project_name 
            FROM purchase_orders 
            WHERE project_site_id IS NOT NULL AND project_site_id != '' 
            ORDER BY project_name
        """)
        self._send_json(sites)

    def _handle_create_po(self, body, actor_id):
        po_number = (body.get("po_number") or "").strip()
        if not po_number:
            po_number = f"PO-2026-{uuid.uuid4().hex[:3].upper()}"
        
        custom_site_name = (body.get("custom_site_name") or "").strip()
        project_name = (body.get("project_name") or custom_site_name or "").strip()
        project_site_id = (body.get("site_id") or body.get("project_site_id") or "").strip()

        if not project_site_id:
            if project_name:
                clean_slug = re.sub(r'[^A-Z0-9]', '', project_name.upper())[:10]
                project_site_id = f"SITE-{clean_slug}" if clean_slug else f"SITE-{uuid.uuid4().hex[:6].upper()}"
            else:
                project_site_id = f"SITE-{uuid.uuid4().hex[:6].upper()}"
                project_name = "Main Construction Site"
        else:
            if not project_name:
                found = execute_query("SELECT project_name FROM purchase_orders WHERE project_site_id = ? LIMIT 1", (project_site_id,))
                project_name = found[0]["project_name"] if found else project_site_id

        supplier_name = (body.get("supplier_name") or "Standard Supplier Corp").strip()
        issue_date = (body.get("issue_date") or "").strip() or time.strftime("%Y-%m-%d")
        line_items = body.get("line_items", [])

        if not line_items:
            line_items = [{
                "item_code": "MAT-GEN-01",
                "description": "Standard Construction Materials",
                "unit": "Units",
                "quantity": 100.0,
                "unit_price": 50.0
            }]

        total_amount = sum(float(it.get("quantity", 0)) * float(it.get("unit_price", 0)) for it in line_items)
        po_id = f"PO-{uuid.uuid4().hex[:6].upper()}"

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO purchase_orders (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, total_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')
        """, (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, round(total_amount, 2)))

        for idx, it in enumerate(line_items):
            qty = float(it.get("quantity", 1))
            price = float(it.get("unit_price", 0))
            item_code = it.get("item_code") or f"MAT-ITEM-{idx+1}"
            desc = it.get("description", "Material Item")
            unit = it.get("unit", "Units")

            cursor.execute("""
                INSERT INTO po_line_items (id, po_id, item_code, description, unit, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"POLI-{uuid.uuid4().hex[:6].upper()}",
                po_id,
                item_code,
                desc,
                unit,
                qty,
                price,
                round(qty * price, 2)
            ))

            # Provision or update site inventory ledger tracking
            cursor.execute("""
                SELECT stock_id, current_quantity FROM inventory_stocks
                WHERE site_id = ? AND item_code = ?
            """, (project_site_id, item_code))
            existing_stock = cursor.fetchone()
            if not existing_stock:
                stock_id = f"STK-{uuid.uuid4().hex[:6].upper()}"
                min_reorder = max(5.0, round(qty * 0.2, 1))
                cursor.execute("""
                    INSERT INTO inventory_stocks (
                        stock_id, site_id, item_code, description, current_quantity,
                        unit, min_reorder_level, reorder_quantity, last_delivery_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (stock_id, project_site_id, item_code, desc, 0.0, unit, min_reorder, qty, issue_date))

        # Automatically generate a signed scoped QR token for this PO & Site!
        token = generate_scoped_token(
            po_id, 
            project_site_id, 
            expires_in_seconds=86400 * 14, 
            created_by=actor_id,
            po_number=po_number,
            project_name=project_name,
            supplier_name=supplier_name,
            total_amount=round(total_amount, 2)
        )
        cursor.execute("""
            INSERT INTO qr_tokens (token_id, token_string, po_id, site_id, expires_at, created_by)
            VALUES (?, ?, ?, ?, datetime('now', '+14 days'), ?)
        """, (f"TKN-{uuid.uuid4().hex[:6].upper()}", token, po_id, project_site_id, actor_id))

        cursor.execute("""
            INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, metadata)
            VALUES ('PO', ?, ?, 'PROCUREMENT', 'PO_CREATED', ?)
        """, (po_id, actor_id, f"Created PO #{po_number} for {supplier_name} at {project_name} (${total_amount:,.2f})"))

        conn.commit()
        conn.close()

        self._send_json({
            "success": True,
            "po_id": po_id,
            "po_number": po_number,
            "project_site_id": project_site_id,
            "project_name": project_name,
            "supplier_name": supplier_name,
            "total_amount": round(total_amount, 2),
            "token": token
        })

    def _handle_create_invoice(self, body, actor_id):
        po_id = (body.get("po_id") or "").strip()
        supplier_name = (body.get("supplier_name") or "Supplier Corp").strip()
        invoice_date = (body.get("invoice_date") or "").strip() or time.strftime("%Y-%m-%d")
        line_items = body.get("line_items", [])
        total_amount = sum(float(it.get("quantity_billed", 0)) * float(it.get("unit_price", 0)) for it in line_items)

        pos = []
        if po_id:
            pos = execute_query("SELECT * FROM purchase_orders WHERE po_id = ? OR po_number = ?", (po_id, po_id))
        if not pos:
            # Auto-create parent PO record to satisfy relational integrity and enable matching
            new_po_id = f"PO-{uuid.uuid4().hex[:6].upper()}"
            po_num = po_id if (po_id and po_id.startswith("PO-")) else f"PO-{uuid.uuid4().hex[:4].upper()}"
            first_site = execute_query("SELECT project_site_id as site_id, project_name FROM purchase_orders WHERE project_site_id IS NOT NULL AND project_site_id != '' LIMIT 1")
            site_id = first_site[0]["site_id"] if first_site else f"SITE-{uuid.uuid4().hex[:6].upper()}"
            site_name = first_site[0]["project_name"] if first_site else "General Project Site"
            execute_insert("""
                INSERT INTO purchase_orders (po_id, po_number, project_site_id, project_name, supplier_name, issue_date, total_amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')
            """, (new_po_id, po_num, site_id, site_name, supplier_name, invoice_date, round(total_amount, 2)))
            po_id = new_po_id
            po = {"po_id": new_po_id, "supplier_name": supplier_name}
        else:
            po = pos[0]
            po_id = po["po_id"]
            if not supplier_name or supplier_name == "Supplier Corp":
                supplier_name = po["supplier_name"]

        invoice_number = (body.get("invoice_number") or "").strip() or f"INV-{uuid.uuid4().hex[:4].upper()}"

        if not line_items:
            po_items = execute_query("SELECT * FROM po_line_items WHERE po_id = ?", (po_id,))
            line_items = [{
                "description": it["description"],
                "quantity_billed": it["quantity"],
                "unit_price": it["unit_price"]
            } for it in po_items]

        total_amount = sum(float(it.get("quantity_billed", 0)) * float(it.get("unit_price", 0)) for it in line_items)
        invoice_id = f"INV-{uuid.uuid4().hex[:6].upper()}"

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO invoices (invoice_id, invoice_number, po_id, supplier_name, invoice_date, subtotal, total_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_MATCH')
        """, (invoice_id, invoice_number, po_id, supplier_name, invoice_date, round(total_amount, 2), round(total_amount, 2)))

        for it in line_items:
            qty = float(it.get("quantity_billed", 0))
            price = float(it.get("unit_price", 0))
            desc = it.get("description", "Material")
            gl_pred = predict_gl_code(desc)
            gl_code = it.get("gl_code") or gl_pred["gl_code"]
            gl_cat = it.get("gl_category") or gl_pred["gl_category"]
            cursor.execute("""
                INSERT INTO invoice_line_items (id, invoice_id, description, quantity_billed, unit_price, total_price, confidence, gl_code, gl_category)
                VALUES (?, ?, ?, ?, ?, ?, 1.0, ?, ?)
            """, (f"INVI-{uuid.uuid4().hex[:6].upper()}", invoice_id, desc, qty, price, round(qty * price, 2), gl_code, gl_cat))

        cursor.execute("""
            INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, metadata)
            VALUES ('INVOICE', ?, ?, 'AP_SPECIALIST', 'INVOICE_LOGGED', ?)
        """, (invoice_id, actor_id, f"Logged Invoice #{invoice_number} from {supplier_name} (${total_amount:,.2f})"))

        conn.commit()
        conn.close()

        rec = run_reconciliation(po_id, invoice_id, actor_id=actor_id)

        self._send_json({
            "success": True,
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "reconciliation": rec
        })

    def _handle_ingest_do(self, body):
        token = body.get("token")
        supervisor_phone = body.get("supervisor_phone", "+1-555-SITE")
        image_base64 = body.get("image_base64", "")
        filename = body.get("filename", "do_upload.jpg")
        
        # Verify scoped token or fallback to site-level selection / 6-digit PIN
        po_id = None
        if token and len(token) > 20 and "." in token:
            try:
                payload = verify_scoped_token(token)
                po_id = payload.get("po_id")
            except Exception:
                pass
                
        if not po_id:
            # Site-level fallback when DO lacks HQ PO number
            site_id = body.get("site_id") or ""
            if not po_id and site_id:
                supp = body.get("supplier_name", "Supplier Corp")
                mat = body.get("material_description", "Materials")
                po_id = auto_bind_delivery_order(site_id, supp, mat)
            if not po_id:
                if site_id:
                    open_pos = execute_query("SELECT po_id FROM purchase_orders WHERE project_site_id = ? AND status != 'LOCKED' ORDER BY created_at ASC", (site_id,))
                    if open_pos:
                        po_id = open_pos[0]["po_id"]
                if not po_id:
                    first_po = execute_query("SELECT po_id FROM purchase_orders LIMIT 1")
                    po_id = first_po[0]["po_id"] if first_po else None
        
        # Decode image or use mock bytes
        if image_base64:
            img_bytes = base64.b64decode(image_base64.split(",")[-1])
        else:
            img_bytes = b"MOCK_DO_IMAGE_BYTES"
            
        file_hash = f"hash_{uuid.uuid4().hex[:12]}"
        storage_filename = f"do_{file_hash}_{filename}"
        _, image_url = save_document(img_bytes, storage_filename, content_type="image/jpeg")
        
        # Pass metadata for fallback mock parsing if key not present
        pos = execute_query("SELECT * FROM purchase_orders WHERE po_id = ?", (po_id,))
        po_data = pos[0] if pos else {}
        
        sim_low_conf = body.get("simulate_low_conf", False)
        
        # Process document through Vision & Schema validator
        extraction_result = process_document(
            image_bytes=img_bytes,
            filename=filename,
            fallback_meta={
                "po_reference": po_data.get("po_number", "PO-2026-001"),
                "supplier_name": po_data.get("supplier_name", "Supplier Corp"),
                "quantity": float(body.get("override_quantity", 800.0)),
                "simulate_low_conf": sim_low_conf
            }
        )
        
        do_id = f"DO-SITE-{uuid.uuid4().hex[:6].upper()}"
        do_number = f"DO-{uuid.uuid4().hex[:4].upper()}"
        status = extraction_result["status"]
        confidence = extraction_result["overall_confidence"]
        
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO delivery_orders (
                do_id, do_number, po_id, supplier_name, delivery_date,
                supervisor_phone, image_url, image_hash, extraction_confidence, status
            ) VALUES (?, ?, ?, ?, date('now'), ?, ?, ?, ?, ?)
        """, (
            do_id, do_number, po_id, extraction_result["extraction"]["supplier_name"],
            supervisor_phone, image_url, file_hash, confidence, status
        ))
        
        for it in extraction_result["extraction"].get("line_items", []):
            item_drop_site = it.get("drop_site_id") or body.get("drop_site_id")
            item_drop_loc = it.get("drop_location") or body.get("drop_location")
            cursor.execute("""
                INSERT INTO do_line_items (id, do_id, description, quantity_received, unit, confidence, drop_site_id, drop_location)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"DOLI-{uuid.uuid4().hex[:6].upper()}", do_id, it["description"],
                float(it["quantity"]), it.get("unit", "Units"), float(it.get("confidence", confidence)),
                item_drop_site, item_drop_loc
            ))
            
        cursor.execute("""
            INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, after_state, metadata)
            VALUES ('DO', ?, ?, 'SITE_SUPERVISOR', 'DO_INGESTED', ?, ?)
        """, (
            do_id, supervisor_phone,
            f"Status: {status}, Confidence: {confidence:.2f}",
            f"Image saved: {image_url}"
        ))
        
        conn.commit()
        conn.close()
        
        # Zero-Entry Automated Site Inventory Update if CONFIRMED
        if status == "CONFIRMED":
            try:
                increment_stock_from_do(do_id)
            except Exception as ex:
                print(f"[Inventory] Auto-increment error: {ex}")
        
        # Trigger reconciliation if an invoice exists for this PO
        invoices = execute_query("SELECT invoice_id FROM invoices WHERE po_id = ?", (po_id,))
        for inv in invoices:
            run_reconciliation(po_id, inv["invoice_id"], actor_id=supervisor_phone)
            
        self._send_json({
            "do_id": do_id,
            "do_number": do_number,
            "po_id": po_id,
            "status": status,
            "confidence": confidence,
            "extraction": extraction_result["extraction"]
        })

    def _handle_confirm_low_confidence(self, body):
        do_id = body.get("do_id")
        confirmed_by = body.get("actor_id", "FINANCE_REVIEWER")
        
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT po_id FROM delivery_orders WHERE do_id = ?", (do_id,))
        do = cursor.fetchone()
        if not do:
            conn.close()
            self._send_error("DO not found", 404)
            return
            
        po_id = do["po_id"]
        cursor.execute("UPDATE delivery_orders SET status = 'CONFIRMED' WHERE do_id = ?", (do_id,))
        
        cursor.execute("""
            INSERT INTO audit_logs (entity_type, entity_id, actor_id, actor_role, action, metadata)
            VALUES ('DO', ?, ?, 'FINANCE_REVIEWER', 'LOW_CONFIDENCE_CONFIRMED', 'Human verifier approved line items.')
        """, (do_id, confirmed_by))
        
        conn.commit()
        conn.close()
        
        # Trigger Zero-Entry Automated Inventory Update now that verification is complete
        try:
            increment_stock_from_do(do_id)
        except Exception as ex:
            print(f"[Inventory] Stock update error on confirmation: {ex}")
        
        # Re-run reconciliation
        invoices = execute_query("SELECT invoice_id FROM invoices WHERE po_id = ?", (po_id,))
        for inv in invoices:
            run_reconciliation(po_id, inv["invoice_id"], actor_id=confirmed_by)
            
        self._send_json({"success": True, "do_id": do_id, "status": "CONFIRMED"})

    def _handle_extract_invoice(self, body):
        filename = body.get("filename", "supplier_invoice.pdf")
        po_id = body.get("po_id")
        
        po_data = {}
        if po_id:
            pos = execute_query("SELECT * FROM purchase_orders WHERE po_id = ?", (po_id,))
            if pos:
                po_data = pos[0]
                po_items = execute_query("SELECT * FROM po_line_items WHERE po_id = ?", (po_id,))
                po_data["line_items"] = po_items
                
        invoice_number = f"INV-{uuid.uuid4().hex[:4].upper()}"
        supplier_name = po_data.get("supplier_name", "Supplier Corp")
        invoice_date = time.strftime("%Y-%m-%d")
        
        if po_data.get("line_items"):
            line_items = []
            for it in po_data["line_items"]:
                gl_pred = predict_gl_code(it["description"])
                line_items.append({
                    "description": it["description"],
                    "quantity_billed": it["quantity"],
                    "unit": it["unit"],
                    "unit_price": it["unit_price"],
                    "total_price": round(it["quantity"] * it["unit_price"], 2),
                    "gl_code": gl_pred["gl_code"],
                    "gl_category": gl_pred["gl_category"]
                })
        else:
            gl_pred = predict_gl_code("General Materials & Supplies")
            line_items = [
                {
                    "description": "General Materials & Supplies",
                    "quantity_billed": 1.0,
                    "unit": "Units",
                    "unit_price": 0.0,
                    "total_price": 0.0,
                    "gl_code": gl_pred["gl_code"],
                    "gl_category": gl_pred["gl_category"]
                }
            ]
            
        total_amount = sum(it["total_price"] for it in line_items)
        
        self._send_json({
            "success": True,
            "extraction": {
                "invoice_number": invoice_number,
                "supplier_name": supplier_name,
                "invoice_date": invoice_date,
                "line_items": line_items,
                "total_amount": round(total_amount, 2),
                "tax_amount": 0.0,
                "confidence": 0.98,
                "extracted_from": filename
            }
        })

    def _handle_export_erp(self):
        import io, csv
        query = """
            SELECT r.reconciliation_id, r.match_status, r.approved_by, r.approved_at,
                   po.po_number, po.project_name, po.project_site_id,
                   inv.invoice_number, inv.invoice_date, inv.supplier_name, inv.total_amount as billed_amount,
                   r.total_overpayment_blocked,
                   COALESCE((SELECT GROUP_CONCAT(DISTINCT ri.gl_code) FROM reconciliation_items ri WHERE ri.reconciliation_id = r.reconciliation_id), '5010-MAT') as gl_codes,
                   COALESCE((SELECT GROUP_CONCAT(DISTINCT ri.gl_category) FROM reconciliation_items ri WHERE ri.reconciliation_id = r.reconciliation_id), 'COGS - Direct Materials') as gl_categories
            FROM reconciliations r
            JOIN purchase_orders po ON r.po_id = po.po_id
            JOIN invoices inv ON r.invoice_id = inv.invoice_id
            WHERE r.match_status IN ('APPROVED', 'PARTIALLY_APPROVED')
            ORDER BY r.approved_at DESC
        """
        records = execute_query(query)
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "VoucherRef", "PostingDate", "VendorName", "ProjectSite", "PONumber",
            "InvoiceNumber", "InvoiceDate", "BilledAmount", "VarianceWithheld",
            "ApprovedPayoutAmount", "GLAccount", "GLCategory", "PaymentStatus", "AuthorizedBy"
        ])
        
        for row in records:
            billed = float(row["billed_amount"] or 0)
            withheld = float(row["total_overpayment_blocked"] or 0) if row["match_status"] == "PARTIALLY_APPROVED" else 0.0
            payout = billed - withheld
            writer.writerow([
                row["reconciliation_id"],
                row["approved_at"] or time.strftime("%Y-%m-%d"),
                row["supplier_name"],
                f"{row['project_name']} ({row['project_site_id']})",
                row["po_number"],
                row["invoice_number"],
                row["invoice_date"],
                f"{billed:.2f}",
                f"{withheld:.2f}",
                f"{payout:.2f}",
                row["gl_codes"] or "5010-MAT",
                row["gl_categories"] or "COGS - Direct Materials",
                row["match_status"],
                row["approved_by"] or "FINANCE_CONTROLLER"
            ])
            
        csv_data = output.getvalue()
        self.send_response(200)
        self.send_header("Content-Type", "text/csv")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Disposition", 'attachment; filename="AIR_Accounting_Disbursement_Batch.csv"')
        self.end_headers()
        self.wfile.write(csv_data.encode("utf-8"))

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, ProjectAIRRequestHandler)
    print(f"[Server] Project AIR REST Server running on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        print("[Server] Server stopped.")

if __name__ == "__main__":
    run_server()
