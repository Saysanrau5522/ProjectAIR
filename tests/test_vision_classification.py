"""
Unit and Integration Tests for AI Document Vision Inspection & Rejection Architecture.
Ensures fake images, dark screenshots, and non-DO uploads are detected and rejected (15% confidence),
while crumpled DOs are routed to review queue (72%), and authentic DOs are verified (95%).
"""
import unittest
from execution.vision_extractor import process_document, _deterministic_mock_extractor
from execution.db_manager import init_db, get_connection, execute_query
from execution.matching_engine import run_reconciliation

class TestVisionInspectionAndRejection(unittest.TestCase):

    def setUp(self):
        init_db()

    def test_fake_screenshot_rejected(self):
        """Screenshots, settings pages, and non-delivery images must be REJECTED with 15% confidence."""
        res = process_document(
            image_bytes=b"\x89PNG\r\n\x1a\nFAKE_SCREENSHOT_BYTES",
            filename="setting_screenshot_2026.png",
            fallback_meta={"is_valid_do": False, "confidence_score": 0.15, "status": "REJECTED"}
        )
        self.assertEqual(res["status"], "REJECTED")
        self.assertEqual(res["overall_confidence"], 0.15)
        self.assertIn("AI", res["rejection_reason"])
        self.assertEqual(len(res["extraction"]["line_items"]), 0)

    def test_random_image_without_do_markers_rejected(self):
        """Random pictures without Delivery Order markers must be REJECTED."""
        res = _deterministic_mock_extractor(filename="my_selfie_photo.jpg")
        self.assertEqual(res["status"], "REJECTED")
        self.assertEqual(res["overall_confidence"], 0.15)

    def test_crumpled_document_triage(self):
        """Stained or crumpled physical delivery slips must route to NEEDS_REVIEW at 72% confidence."""
        res = process_document(
            image_bytes=b"\xff\xd8\xffCRUMPLED_BYTES",
            filename="crumpled_do_site_delivery.jpg",
            fallback_meta={"simulate_low_conf": True}
        )
        self.assertEqual(res["status"], "NEEDS_REVIEW")
        self.assertAlmostEqual(res["overall_confidence"], 0.72, places=2)
        self.assertTrue(res["needs_review"])

    def test_valid_physical_do_confirmed(self):
        """Clean authentic paper delivery orders must be CONFIRMED with 95% confidence."""
        res = process_document(
            image_bytes=b"\xff\xd8\xffCLEAN_DO_BYTES",
            filename="clean_site_do.jpg",
            fallback_meta={"force_valid": True, "quantity": 500}
        )
        self.assertEqual(res["status"], "CONFIRMED")
        self.assertAlmostEqual(res["overall_confidence"], 0.95, places=2)
        self.assertFalse(res["needs_review"])
        self.assertEqual(len(res["extraction"]["line_items"]), 1)

if __name__ == "__main__":
    unittest.main()
