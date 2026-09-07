import urllib.request
import json
import sys

def test_sync():
    endpoints = [
        ("http://127.0.0.1:8000", "Desktop Direct Backend"),
        ("http://127.0.0.1:5173", "Mobile UI via Network Proxy")
    ]
    
    results = {}
    
    for base_url, name in endpoints:
        print(f"\n--- Checking {name} ({base_url}) ---")
        
        # HUD
        hud_res = json.loads(urllib.request.urlopen(f"{base_url}/api/hud").read().decode('utf-8'))
        print(f"HUD: total_po_value = {hud_res.get('total_po_value')}, total_overpayment_blocked = {hud_res.get('total_overpayment_blocked')}, discrepancies_flagged = {hud_res.get('discrepancies_flagged')}")
        
        # SITES
        sites_res = json.loads(urllib.request.urlopen(f"{base_url}/api/sites").read().decode('utf-8'))
        site_names = [s.get('project_name') for s in sites_res]
        print(f"SITES ({len(sites_res)}): {site_names}")
        
        # POS
        pos_res = json.loads(urllib.request.urlopen(f"{base_url}/api/pos").read().decode('utf-8'))
        po_nums = [p.get('po_number') for p in pos_res]
        print(f"POS ({len(pos_res)}): {po_nums}")
        
        # RECONCILIATIONS
        recs_res = json.loads(urllib.request.urlopen(f"{base_url}/api/reconciliations").read().decode('utf-8'))
        print(f"RECONCILIATIONS ({len(recs_res)}):")
        for r in recs_res:
            print(f"  - PO: {r.get('po_number')}, Status: {r.get('match_status')}, Overpayment Blocked: RM {r.get('total_overpayment_blocked')}")
            
        results[name] = {
            "sites_count": len(sites_res),
            "site_names": site_names,
            "blocked": hud_res.get('total_overpayment_blocked'),
            "po_value": hud_res.get('total_po_value'),
            "recs_count": len(recs_res)
        }
        
    # Assertions
    for name, data in results.items():
        assert data["sites_count"] == 1, f"Expected 1 site, got {data['sites_count']} for {name}"
        assert data["site_names"] == ["MADINA"], f"Expected ['MADINA'], got {data['site_names']} for {name}"
        assert float(data["blocked"]) == 270.0, f"Expected 270.0 blocked, got {data['blocked']} for {name}"
        assert float(data["po_value"]) == 270.0, f"Expected 270.0 PO value, got {data['po_value']} for {name}"
        assert data["recs_count"] == 1, f"Expected 1 reconciliation, got {data['recs_count']} for {name}"
        
    print("\n[SUCCESS] Both Desktop and Mobile API endpoints return identical canonical data:")
    print("  - Sites: 1 (MADINA)")
    print("  - Overpayment Blocked / Total Dispute: RM 270.00")
    print("  - Total PO Value: RM 270.00")
    print("  - Reconciliations: 1")

if __name__ == "__main__":
    test_sync()
