"""
Comprehensive Automated Test Suite for Project AIR.
Tests:
- Deterministic 3-way matching logic
- Tolerance threshold application
- Maker-Checker segregation of duties enforcement
- Post-approval record locking
- Anti-duplicate invoice prevention
- HMAC-SHA256 scoped token verification & tamper rejection
- Anti-spreadsheet formula injection sanitization
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import unittest
import sqlite3
import time
from execution.db_manager import get_connection, init_db
from execution.seed_data import seed
from execution.matching_engine import run_reconciliation
from execution.audit_service import resolve_discrepancy, approve_for_payment, dispute_invoice
from execution.token_manager import generate_scoped_token, verify_scoped_token
from execution.vision_extractor import sanitize_text, validate_extraction_schema

class TestProjectAIR(unittest.TestCase):

    def setUp(self):
        seed()

    def test_scenario1_cement_overbilling_flagged(self):
        """Verify that billing 1000 bags when only 800 were delivered flags discrepancy and blocks $1700."""
        rec = run_reconciliation("PO-2026-001", "INV-2026-9041")
        self.assertEqual(rec["match_status"], "DISCREPANCY_FLAGGED")
        self.assertTrue(rec["has_discrepancy"])
        self.assertEqual(rec["total_overpayment_blocked"], 1700.00)
        self.assertIn("QUANTITY_OVERBILLING", [it["discrepancy_type"] for it in rec["items"]])

    def test_scenario2_multi_document_split_rebar_matched(self):
        """Verify that 2 separate DOs (25t + 25t) aggregate to 50t to match 1 Invoice (50t)."""
        rec = run_reconciliation("PO-2026-002", "INV-2026-9042")
        self.assertEqual(rec["match_status"], "READY_FOR_APPROVAL")
        self.assertFalse(rec["has_discrepancy"])
        self.assertEqual(rec["total_overpayment_blocked"], 0.0)

    def test_scenario3_low_confidence_routes_to_needs_review(self):
        """Verify that extraction confidence < 85% routes status to NEEDS_REVIEW."""
        rec = run_reconciliation("PO-2026-003", "INV-2026-9043")
        self.assertEqual(rec["match_status"], "NEEDS_REVIEW")

    def test_maker_checker_segregation_of_duties_enforced(self):
        """
        Verify that the user who resolves a discrepancy CANNOT approve that same invoice.
        Segregation of duties must raise PermissionError and record security violation in audit log.
        """
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT reconciliation_id FROM reconciliations WHERE po_id = 'PO-2026-001'")
        rec_id = cursor.fetchone()["reconciliation_id"]
        conn.close()

        # Step 1: User 'AP_SPECIALIST_ALICE' resolves the discrepancy with supplier credit note
        resolve_discrepancy(
            reconciliation_id=rec_id,
            actor_id="AP_SPECIALIST_ALICE",
            actor_role="AP_SPECIALIST",
            notes="Supplier agreed to issue Credit Note CN-991 for the 200 missing bags."
        )

        # Step 2: 'AP_SPECIALIST_ALICE' attempts to approve the payment -> MUST FAIL!
        with self.assertRaises(PermissionError) as ctx:
            approve_for_payment(
                reconciliation_id=rec_id,
                approver_id="AP_SPECIALIST_ALICE",
                approver_role="FINANCE_CONTROLLER"
            )
        self.assertIn("Maker-Checker Segregation of Duties Violation", str(ctx.exception))

        # Step 3: Independent Finance Controller 'FINANCE_CONTROLLER_BOB' approves -> MUST SUCCEED!
        approved = approve_for_payment(
            reconciliation_id=rec_id,
            approver_id="FINANCE_CONTROLLER_BOB",
            approver_role="FINANCE_CONTROLLER"
        )
        self.assertEqual(approved["match_status"], "APPROVED")
        self.assertEqual(approved["is_locked"], 1)

        # Step 4: Verify post-approval record is permanently locked
        with self.assertRaises(PermissionError):
            resolve_discrepancy(
                reconciliation_id=rec_id,
                actor_id="AP_SPECIALIST_ALICE",
                actor_role="AP_SPECIALIST",
                notes="Attempt to tamper after approval"
            )

    def test_duplicate_invoice_prevention(self):
        """Verify that submitting an invoice with duplicate (supplier_name, invoice_number) is blocked by DB."""
        conn = get_connection()
        cursor = conn.cursor()
        with self.assertRaises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO invoices (invoice_id, invoice_number, po_id, supplier_name, invoice_date, subtotal, total_amount)
                VALUES ('INV-DUP-TEST', 'INV-9041', 'PO-2026-001', 'MegaMix Cement & Concrete Corp', '2026-09-05', 8500.0, 8500.0)
            """)
        conn.close()

    def test_scoped_qr_token_validation_and_tampering(self):
        """Verify HMAC token generation, validation, and tamper detection."""
        token = generate_scoped_token(po_id="PO-2026-001", site_id="SITE-ALPHA-WEST", expires_in_seconds=3600)
        payload = verify_scoped_token(token)
        self.assertEqual(payload["po_id"], "PO-2026-001")
        self.assertEqual(payload["site_id"], "SITE-ALPHA-WEST")

        # Tampered token
        tampered_token = token[:-5] + "XXXXX"
        with self.assertRaises(ValueError) as ctx:
            verify_scoped_token(tampered_token)
        self.assertIn("Invalid token signature", str(ctx.exception))

    def test_formula_injection_sanitization(self):
        """Verify that strings beginning with =, +, -, @ are escaped."""
        self.assertEqual(sanitize_text("=IMPORTXML('http://evil.com')"), "'=IMPORTXML('http://evil.com')")
        self.assertEqual(sanitize_text("+12345"), "'+12345")
        self.assertEqual(sanitize_text("@SUM(A1:A10)"), "'@SUM(A1:A10)")
        self.assertEqual(sanitize_text("-cmd|' /C calc'!A0"), "'-cmd|' /C calc'!A0")
        self.assertEqual(sanitize_text("Portland Cement"), "Portland Cement")

    def test_specificity_line_matching_prevents_collision(self):
        """Verify that dimension specs (10mm vs 16mm) are strictly isolated and never collide."""
        from execution.matching_engine import calculate_material_similarity
        # Conflicting diameters MUST NOT match
        sim_conflict = calculate_material_similarity("High-Tensile Deformed Steel Rebar 10mm", "High-Tensile Deformed Steel Rebar 16mm")
        self.assertEqual(sim_conflict, 0.0)

        # Aliases without conflict MUST match with high score
        sim_alias = calculate_material_similarity("R-Mix C30 (Cu M)", "Ready-Mix Concrete Grade 30")
        self.assertGreaterEqual(sim_alias, 0.70)

    def test_uom_conversion(self):
        """Verify that dynamic UOM conversions (Pallets to Bags, Tons to kg) calculate accurately."""
        from execution.matching_engine import convert_quantity
        # 20 pallets of cement = 800 bags
        bags = convert_quantity(20, "Pallet", "Bags")
        self.assertEqual(bags, 800.0)

        # 25,000 kg = 25 Metric Tons
        tons = convert_quantity(25000, "kg", "Ton")
        self.assertEqual(tons, 25.0)

    def test_short_pay_partial_payment_voucher(self):
        """Verify that short-pay vouchers correctly authorize verified physical deliveries while withholding variances."""
        from execution.audit_service import approve_partial_payment
        rec = run_reconciliation("PO-2026-001", "INV-2026-9041")
        self.assertEqual(rec["total_verified_payable"], 6800.0)
        self.assertEqual(rec["total_overpayment_blocked"], 1700.0)
        self.assertIsNotNone(rec["short_pay_voucher"])

        # Approve verified amount under short-pay
        partially_approved = approve_partial_payment(
            reconciliation_id=rec["reconciliation_id"],
            approver_id="FINANCE_CONTROLLER_BOB",
            approver_role="FINANCE_CONTROLLER",
            notes="Release $6,800 for 800 confirmed cement bags. Hold $1,700."
        )
        self.assertEqual(partially_approved["match_status"], "PARTIALLY_APPROVED")
        self.assertEqual(partially_approved["is_locked"], 1)

    def test_site_level_auto_bind_delivery_order(self):
        """Verify that a delivery docket lacking an HQ PO number auto-binds to the open PO for that site and material."""
        from execution.matching_engine import auto_bind_delivery_order
        po_id = auto_bind_delivery_order(
            site_id="SITE-ALPHA-WEST",
            supplier_name="MegaMix Cement & Concrete Corp",
            material_desc="Portland Cement Grade 42.5"
        )
        self.assertEqual(po_id, "PO-2026-001")

    def test_smart_gl_coding(self):
        """Verify that line items are automatically assigned standard COA account codes."""
        from execution.gl_coding_service import predict_gl_code
        # Materials
        res_mat = predict_gl_code("High-Tensile Deformed Steel Rebar 16mm")
        self.assertEqual(res_mat["gl_code"], "5010-MAT")
        self.assertEqual(res_mat["gl_category"], "COGS - Direct Materials")

        # Concrete
        res_conc = predict_gl_code("Ready-Mix Concrete Grade 30 (Cu M)")
        self.assertEqual(res_conc["gl_code"], "5020-CONC")
        self.assertEqual(res_conc["gl_category"], "COGS - Concrete & Structural Mixes")

        # Safety PPE
        res_safe = predict_gl_code("Standard Safety Hardhat Helmet White")
        self.assertEqual(res_safe["gl_code"], "6030-SAFE")
        self.assertEqual(res_safe["gl_category"], "Operating Expenses - Safety & PPE")

        # Fuel
        res_fuel = predict_gl_code("Industrial Diesel Fuel 500 Liters")
        self.assertEqual(res_fuel["gl_code"], "5050-FUEL")

    def test_multilingual_standardization(self):
        """Verify translation and normalization of mixed Malay, Chinese, and English terms."""
        from execution.multilingual_service import standardize_text
        # Bahasa Melayu
        res_bm = standardize_text("Surat Hantaran: 100 guni simen portland")
        self.assertIn("cement", res_bm["standardized"].lower())
        self.assertIn("delivery order", res_bm["standardized"].lower())
        self.assertIn("MS", res_bm["detected_languages"])

        # Chinese
        res_zh = standardize_text("送货单: 20吨 螺纹钢 16mm 和 施工安全帽")
        self.assertIn("reinforcing steel rebar", res_zh["standardized"].lower())
        self.assertIn("safety hardhat", res_zh["standardized"].lower())
        self.assertIn("ZH", res_zh["detected_languages"])

    def test_multilingual_fuzzy_matching_with_dimension_isolation(self):
        """Verify that multilingual terms match PO descriptions while strictly enforcing dimension isolation."""
        from execution.matching_engine import calculate_material_similarity
        # Malay to English match
        sim_bm = calculate_material_similarity("Simen Portland Grade 42.5", "Portland Cement Grade 42.5 (50kg Bag)")
        self.assertGreaterEqual(sim_bm, 0.65)

        # Chinese to English match
        sim_zh = calculate_material_similarity("16mm 螺纹钢", "High-Tensile Deformed Rebar 16mm (Tons)")
        self.assertGreaterEqual(sim_zh, 0.65)

        # Dimension conflict across languages MUST FAIL (10mm vs 16mm)
        sim_conflict = calculate_material_similarity("10mm 螺纹钢", "High-Tensile Deformed Rebar 16mm (Tons)")
        self.assertEqual(sim_conflict, 0.0)

    def test_vendor_risk_scoring_and_insights(self):
        """Verify supplier discrepancy metrics, risk ratings (A/B/C), and contract insights."""
        from execution.vendor_risk_service import calculate_vendor_risk_profile
        # MegaMix has 100% discrepancy on seeded data ($1,700 blocked) -> Grade C
        megamix = calculate_vendor_risk_profile("MegaMix Cement & Concrete Corp")
        self.assertEqual(megamix["risk_grade"], "C")
        self.assertEqual(megamix["total_overpayment_blocked"], 1700.0)
        self.assertTrue(len(megamix["contract_insights"]) > 0)

        # Titan Steel has 100% matched orders -> Grade A
        titan = calculate_vendor_risk_profile("Titan Steel Rebar Ltd")
        self.assertEqual(titan["risk_grade"], "A")
        self.assertEqual(titan["discrepancy_count"], 0)

    def test_multi_site_split_drop_delivery_orders(self):
        """Verify Scenario 4 where 1 DO splits 80 Cu M concrete between two separate project sites."""
        rec = run_reconciliation("PO-2026-004", "INV-2026-9044")
        self.assertEqual(rec["match_status"], "READY_FOR_APPROVAL")
        self.assertFalse(rec["has_discrepancy"])
        self.assertEqual(rec["total_overpayment_blocked"], 0.0)

    def test_zero_entry_inventory_and_replenishment_po(self):
        """Verify stock balance queries and 1-click draft replenishment PO creation."""
        from execution.inventory_service import get_inventory_stocks, create_draft_replenishment_po
        stocks = get_inventory_stocks()
        self.assertGreaterEqual(len(stocks), 4)

        # Find critical low item (STK-004)
        crit_stock = next((s for s in stocks if s["stock_id"] == "STK-004"), None)
        self.assertIsNotNone(crit_stock)
        self.assertEqual(crit_stock["stock_status"], "CRITICAL_LOW")

        # Trigger 1-click replenishment PO
        po_res = create_draft_replenishment_po("STK-004", actor_id="FINANCE_TESTER")
        self.assertTrue(po_res["success"])
        self.assertTrue(po_res["po_number"].startswith("PO-2026-REPL"))
        self.assertIsNotNone(po_res["token"])
        self.assertEqual(po_res["reorder_quantity"], 250.0)

if __name__ == "__main__":
    unittest.main()

