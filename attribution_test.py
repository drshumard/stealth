#!/usr/bin/env python3
"""
Attribution Refresh & Trigger Audience Testing
Tests the latest-click-wins attribution refresh and trigger_audience automation features.
"""
import requests
import json
import sys
import uuid
import time
from datetime import datetime

BACKEND_URL = "https://lead-tracker-312.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

class AttributionTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []
        self.test_contacts = []
        self.test_automations = []

    def log(self, msg, level="INFO"):
        prefix = {
            "INFO": "ℹ️ ",
            "SUCCESS": "✅",
            "FAIL": "❌",
            "WARN": "⚠️ "
        }.get(level, "  ")
        print(f"{prefix} {msg}")

    def test(self, name, condition, details=""):
        """Record a test result"""
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            self.log(f"PASS: {name}", "SUCCESS")
            if details:
                print(f"     {details}")
            return True
        else:
            self.failures.append({"test": name, "details": details})
            self.log(f"FAIL: {name}", "FAIL")
            if details:
                print(f"     {details}")
            return False

    def cleanup(self):
        """Clean up test data"""
        self.log("Cleaning up test data...", "INFO")
        for auto_id in self.test_automations:
            try:
                requests.delete(f"{API}/automations/{auto_id}", timeout=5)
                self.log(f"Deleted automation {auto_id[:8]}", "INFO")
            except:
                pass
        for contact_id in self.test_contacts:
            try:
                requests.delete(f"{API}/contacts/{contact_id}", timeout=5)
                self.log(f"Deleted contact {contact_id[:8]}", "INFO")
            except:
                pass

    # ═══════════════════════════════════════════════════════════════════
    # BACKEND 1: Returning contact with new ad click on SAME browser
    # ═══════════════════════════════════════════════════════════════════
    def test_backend_1_attribution_refresh_same_browser(self):
        self.log("\n" + "="*70, "INFO")
        self.log("BACKEND 1: Attribution refresh - same browser, new click", "INFO")
        self.log("="*70, "INFO")
        
        contact_id = str(uuid.uuid4())
        self.test_contacts.append(contact_id)
        email = f"test-backend1-{int(time.time())}@example.com"
        
        # Step 1: Initial pageview with OLD attribution
        self.log("Step 1: Send pageview with OLD fbclid", "INFO")
        r1 = requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_id,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "OLD1",
                "fbc": "fb.1.1700000000000.OLD1",
                "utm_campaign": "campA"
            }
        }, timeout=10)
        self.test("Pageview 1 returns 200", r1.status_code == 200, f"Got {r1.status_code}")
        
        # Step 2: Submit lead with email
        self.log("Step 2: Submit lead with email", "INFO")
        r2 = requests.post(f"{API}/track/lead", json={
            "contact_id": contact_id,
            "email": email
        }, timeout=10)
        self.test("Lead submission returns 200", r2.status_code == 200, f"Got {r2.status_code}")
        
        # Step 3: New pageview with NEW fbclid (returning visitor, new ad click)
        self.log("Step 3: Send pageview with NEW fbclid (returning visitor)", "INFO")
        time.sleep(1)  # Small delay to ensure timestamps differ
        r3 = requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_id,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "NEW1",
                "fbc": "fb.1.1800000000000.NEW1",
                "utm_campaign": "campB"
            }
        }, timeout=10)
        self.test("Pageview 2 returns 200", r3.status_code == 200, f"Got {r3.status_code}")
        
        # Step 4: Verify attribution was refreshed
        self.log("Step 4: Verify attribution refresh", "INFO")
        time.sleep(1)
        r4 = requests.get(f"{API}/contacts/{contact_id}", timeout=10)
        self.test("GET contact returns 200", r4.status_code == 200, f"Got {r4.status_code}")
        
        if r4.status_code == 200:
            contact = r4.json()
            attr = contact.get('attribution', {})
            history = contact.get('attribution_history') or []
            
            # Verify new attribution is active
            self.test(
                "Attribution fbclid is NEW1",
                attr.get('fbclid') == 'NEW1',
                f"Expected 'NEW1', got '{attr.get('fbclid')}'"
            )
            self.test(
                "Attribution fbc contains NEW1",
                'NEW1' in (attr.get('fbc') or ''),
                f"fbc = {attr.get('fbc')}"
            )
            self.test(
                "Attribution utm_campaign is campB",
                attr.get('utm_campaign') == 'campB',
                f"Expected 'campB', got '{attr.get('utm_campaign')}'"
            )
            
            # Verify old attribution is archived
            self.test(
                "Attribution history has 1 entry",
                len(history) == 1,
                f"Expected 1 entry, got {len(history)}"
            )
            if len(history) > 0:
                old_attr = history[0].get('attribution', {})
                self.test(
                    "History entry has OLD1 fbclid",
                    old_attr.get('fbclid') == 'OLD1',
                    f"Expected 'OLD1', got '{old_attr.get('fbclid')}'"
                )
            
            # Verify refresh timestamp
            self.test(
                "attribution_refreshed_at is set",
                'attribution_refreshed_at' in contact and contact['attribution_refreshed_at'] is not None,
                f"Field present: {'attribution_refreshed_at' in contact}"
            )

    # ═══════════════════════════════════════════════════════════════════
    # BACKEND 2: Cross-device return (email stitch)
    # ═══════════════════════════════════════════════════════════════════
    def test_backend_2_cross_device_email_stitch(self):
        self.log("\n" + "="*70, "INFO")
        self.log("BACKEND 2: Cross-device return with email stitch", "INFO")
        self.log("="*70, "INFO")
        
        contact_a = str(uuid.uuid4())
        contact_b = str(uuid.uuid4())
        self.test_contacts.extend([contact_a, contact_b])
        email = f"test-backend2-{int(time.time())}@example.com"
        
        # Step 1: Contact A - pageview + lead
        self.log("Step 1: Contact A - pageview with OLD fbclid + lead", "INFO")
        requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_a,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "OLD2",
                "fbc": "fb.1.1700000000000.OLD2"
            }
        }, timeout=10)
        r1 = requests.post(f"{API}/track/lead", json={
            "contact_id": contact_a,
            "email": email
        }, timeout=10)
        self.test("Contact A lead submission returns 200", r1.status_code == 200)
        
        # Step 2: Contact B - new device, new fbclid
        self.log("Step 2: Contact B - pageview with NEW fbclid", "INFO")
        time.sleep(1)
        requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_b,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "NEW2",
                "fbc": "fb.1.1800000000000.NEW2"
            }
        }, timeout=10)
        
        # Step 3: Contact B submits SAME email (should stitch to A)
        self.log("Step 3: Contact B submits same email (email stitch)", "INFO")
        r2 = requests.post(f"{API}/track/lead", json={
            "contact_id": contact_b,
            "email": email
        }, timeout=10)
        self.test("Contact B lead submission returns 200", r2.status_code == 200)
        
        if r2.status_code == 200:
            response = r2.json()
            final_contact_id = response.get('contact_id')
            self.test(
                "Response contact_id is A (email stitch)",
                final_contact_id == contact_a,
                f"Expected {contact_a[:8]}, got {final_contact_id[:8] if final_contact_id else 'None'}"
            )
        
        # Step 4: Verify contact A has NEW attribution
        self.log("Step 4: Verify contact A attribution refreshed", "INFO")
        time.sleep(1)
        r3 = requests.get(f"{API}/contacts/{contact_a}", timeout=10)
        if r3.status_code == 200:
            contact = r3.json()
            attr = contact.get('attribution', {})
            history = contact.get('attribution_history') or []
            
            self.test(
                "Contact A fbclid is NEW2",
                attr.get('fbclid') == 'NEW2',
                f"Expected 'NEW2', got '{attr.get('fbclid')}'"
            )
            self.test(
                "Attribution history grew (old click archived)",
                len(history) >= 1,
                f"History length: {len(history)}"
            )

    # ═══════════════════════════════════════════════════════════════════
    # BACKEND 3: No false refresh (same fbclid)
    # ═══════════════════════════════════════════════════════════════════
    def test_backend_3_no_false_refresh(self):
        self.log("\n" + "="*70, "INFO")
        self.log("BACKEND 3: No false refresh when fbclid unchanged", "INFO")
        self.log("="*70, "INFO")
        
        contact_id = str(uuid.uuid4())
        self.test_contacts.append(contact_id)
        
        # Step 1: Initial pageview
        self.log("Step 1: Initial pageview with fbclid SAME1", "INFO")
        requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_id,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "SAME1",
                "fbc": "fb.1.1700000000000.SAME1"
            }
        }, timeout=10)
        requests.post(f"{API}/track/lead", json={
            "contact_id": contact_id,
            "email": f"test-backend3-{int(time.time())}@example.com"
        }, timeout=10)
        
        # Get initial state
        time.sleep(1)
        r1 = requests.get(f"{API}/contacts/{contact_id}", timeout=10)
        initial_history_len = 0
        if r1.status_code == 200:
            history = r1.json().get('attribution_history')
            initial_history_len = len(history) if history else 0
        
        # Step 2: Re-send SAME fbclid
        self.log("Step 2: Re-send pageview with SAME fbclid", "INFO")
        time.sleep(1)
        requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_id,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "SAME1",
                "fbc": "fb.1.1700000000000.SAME1"
            }
        }, timeout=10)
        
        # Step 3: Verify no refresh occurred
        self.log("Step 3: Verify attribution unchanged", "INFO")
        time.sleep(1)
        r2 = requests.get(f"{API}/contacts/{contact_id}", timeout=10)
        if r2.status_code == 200:
            contact = r2.json()
            attr = contact.get('attribution', {})
            history = contact.get('attribution_history') or []
            
            self.test(
                "Attribution fbclid still SAME1",
                attr.get('fbclid') == 'SAME1',
                f"Got '{attr.get('fbclid')}'"
            )
            self.test(
                "Attribution history did NOT grow",
                len(history) == initial_history_len,
                f"Initial: {initial_history_len}, Current: {len(history)}"
            )

    # ═══════════════════════════════════════════════════════════════════
    # BACKEND 4: trigger_audience CRUD
    # ═══════════════════════════════════════════════════════════════════
    def test_backend_4_trigger_audience_crud(self):
        self.log("\n" + "="*70, "INFO")
        self.log("BACKEND 4: trigger_audience CRUD operations", "INFO")
        self.log("="*70, "INFO")
        
        # Step 1: Create automation with trigger_audience 'returning'
        self.log("Step 1: Create automation with trigger_audience='returning'", "INFO")
        r1 = requests.post(f"{API}/automations", json={
            "name": f"Test Returning Trigger {int(time.time())}",
            "enabled": True,
            "trigger_audience": "returning",
            "steps": [{
                "id": str(uuid.uuid4()),
                "type": "webhook",
                "config": {
                    "url": "https://httpbin.org/post"
                }
            }]
        }, timeout=10)
        self.test("Create automation returns 201", r1.status_code == 201, f"Got {r1.status_code}")
        
        auto_id = None
        if r1.status_code == 201:
            auto = r1.json()
            auto_id = auto.get('id')
            self.test_automations.append(auto_id)
            self.test(
                "Response echoes trigger_audience='returning'",
                auto.get('trigger_audience') == 'returning',
                f"Got '{auto.get('trigger_audience')}'"
            )
        
        if not auto_id:
            self.log("Skipping remaining CRUD tests (creation failed)", "WARN")
            return
        
        # Step 2: Update to 'new'
        self.log("Step 2: Update trigger_audience to 'new'", "INFO")
        r2 = requests.put(f"{API}/automations/{auto_id}", json={
            "trigger_audience": "new"
        }, timeout=10)
        self.test("Update returns 200", r2.status_code == 200, f"Got {r2.status_code}")
        if r2.status_code == 200:
            auto = r2.json()
            self.test(
                "Updated trigger_audience is 'new'",
                auto.get('trigger_audience') == 'new',
                f"Got '{auto.get('trigger_audience')}'"
            )
        
        # Step 3: Try invalid value
        self.log("Step 3: Try invalid trigger_audience value", "INFO")
        r3 = requests.put(f"{API}/automations/{auto_id}", json={
            "trigger_audience": "bogus"
        }, timeout=10)
        self.test(
            "Invalid value returns 400",
            r3.status_code == 400,
            f"Got {r3.status_code} (should reject invalid values)"
        )
        
        # Step 4: GET returns the field
        self.log("Step 4: GET automation returns trigger_audience", "INFO")
        r4 = requests.get(f"{API}/automations/{auto_id}", timeout=10)
        if r4.status_code == 200:
            auto = r4.json()
            self.test(
                "GET returns trigger_audience field",
                'trigger_audience' in auto,
                f"Field present: {'trigger_audience' in auto}"
            )
        
        # Step 5: Create without field (should default to 'both')
        self.log("Step 5: Create automation without trigger_audience (default 'both')", "INFO")
        r5 = requests.post(f"{API}/automations", json={
            "name": f"Test Default Trigger {int(time.time())}",
            "enabled": True,
            "steps": [{
                "id": str(uuid.uuid4()),
                "type": "webhook",
                "config": {
                    "url": "https://httpbin.org/post"
                }
            }]
        }, timeout=10)
        if r5.status_code == 201:
            auto = r5.json()
            self.test_automations.append(auto.get('id'))
            self.test(
                "Default trigger_audience is 'both'",
                auto.get('trigger_audience') == 'both',
                f"Got '{auto.get('trigger_audience')}'"
            )

    # ═══════════════════════════════════════════════════════════════════
    # BACKEND 5: Audience firing logic
    # ═══════════════════════════════════════════════════════════════════
    def test_backend_5_audience_firing(self):
        self.log("\n" + "="*70, "INFO")
        self.log("BACKEND 5: Automation firing based on trigger_audience", "INFO")
        self.log("="*70, "INFO")
        
        # Create 3 automations
        self.log("Creating 3 test automations...", "INFO")
        webhook_url = "https://httpbin.org/post"
        
        automations = {}
        for audience in ['new', 'returning', 'both']:
            r = requests.post(f"{API}/automations", json={
                "name": f"Test {audience.upper()} {int(time.time())}",
                "enabled": True,
                "trigger_audience": audience,
                "steps": [{
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "url": webhook_url
                    }
                }]
            }, timeout=10)
            if r.status_code == 201:
                auto = r.json()
                auto_id = auto.get('id')
                automations[audience] = auto_id
                self.test_automations.append(auto_id)
                self.log(f"Created {audience} automation: {auto_id[:8]}", "INFO")
        
        if len(automations) != 3:
            self.log("Failed to create all 3 automations, skipping firing tests", "WARN")
            return
        
        # Scenario A: New contact
        self.log("\n--- Scenario A: New Contact ---", "INFO")
        contact_new = str(uuid.uuid4())
        self.test_contacts.append(contact_new)
        email_new = f"test-new-{int(time.time())}@example.com"
        
        self.log("Step 1: Fresh contact with fbclid X1", "INFO")
        requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_new,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "X1",
                "fbc": "fb.1.1700000000000.X1"
            }
        }, timeout=10)
        
        self.log("Step 2: Submit lead with brand-new email", "INFO")
        requests.post(f"{API}/track/lead", json={
            "contact_id": contact_new,
            "email": email_new
        }, timeout=10)
        
        self.log("Step 3: Wait for automations to fire (~3s)", "INFO")
        time.sleep(3)
        
        # Check runs
        self.log("Step 4: Check automation runs", "INFO")
        for audience, auto_id in automations.items():
            r = requests.get(f"{API}/automations/{auto_id}/runs", timeout=10)
            if r.status_code == 200:
                runs = r.json()
                run_count = len(runs)
                
                if audience == 'new':
                    self.test(
                        f"AUTO_NEW has 1 run (new contact)",
                        run_count >= 1,
                        f"Expected ≥1, got {run_count}"
                    )
                elif audience == 'returning':
                    self.test(
                        f"AUTO_RET has 0 runs (new contact)",
                        run_count == 0,
                        f"Expected 0, got {run_count}"
                    )
                elif audience == 'both':
                    self.test(
                        f"AUTO_BOTH has 1 run (new contact)",
                        run_count >= 1,
                        f"Expected ≥1, got {run_count}"
                    )
        
        # Scenario B: Returning contact
        self.log("\n--- Scenario B: Returning Contact ---", "INFO")
        
        self.log("Step 1: Same contact, pageview with NEW fbclid X2", "INFO")
        time.sleep(1)
        requests.post(f"{API}/track/pageview", json={
            "contact_id": contact_new,
            "current_url": "https://example.com/landing",
            "attribution": {
                "fbclid": "X2",
                "fbc": "fb.1.1800000000000.X2"
            }
        }, timeout=10)
        
        self.log("Step 2: Re-submit lead with same email", "INFO")
        requests.post(f"{API}/track/lead", json={
            "contact_id": contact_new,
            "email": email_new
        }, timeout=10)
        
        self.log("Step 3: Wait for automations to fire (~3s)", "INFO")
        time.sleep(3)
        
        # Check runs again
        self.log("Step 4: Check automation runs (should have new runs)", "INFO")
        for audience, auto_id in automations.items():
            r = requests.get(f"{API}/automations/{auto_id}/runs", timeout=10)
            if r.status_code == 200:
                runs = r.json()
                run_count = len(runs)
                
                if audience == 'new':
                    self.test(
                        f"AUTO_NEW still has 1 run (no new run for returning)",
                        run_count == 1,
                        f"Expected 1, got {run_count}"
                    )
                elif audience == 'returning':
                    self.test(
                        f"AUTO_RET now has 1 run (returning contact)",
                        run_count >= 1,
                        f"Expected ≥1, got {run_count}"
                    )
                elif audience == 'both':
                    self.test(
                        f"AUTO_BOTH now has 2 runs (new + returning)",
                        run_count >= 2,
                        f"Expected ≥2, got {run_count}"
                    )

    # ═══════════════════════════════════════════════════════════════════
    # BACKEND 6: Stealth webhook regression
    # ═══════════════════════════════════════════════════════════════════
    def test_backend_6_stealth_webhook(self):
        self.log("\n" + "="*70, "INFO")
        self.log("BACKEND 6: Stealth webhook regression test", "INFO")
        self.log("="*70, "INFO")
        
        email = f"test-stealth-{int(time.time())}@example.com"
        
        # Step 1: POST with brand new email
        self.log("Step 1: POST /api/stealth/webhook with new email", "INFO")
        r1 = requests.post(f"{API}/stealth/webhook", json={
            "email": email,
            "name": "Test User"
        }, timeout=10)
        self.test("Stealth webhook returns 200", r1.status_code == 200, f"Got {r1.status_code}")
        
        contact_id = None
        if r1.status_code == 200:
            response = r1.json()
            contact_id = response.get('contact_id')
            self.test("Contact created", contact_id is not None, f"contact_id: {contact_id}")
            if contact_id:
                self.test_contacts.append(contact_id)
        
        # Step 2: POST again with same email (should not duplicate)
        self.log("Step 2: POST again with same email (no duplicate)", "INFO")
        time.sleep(1)
        r2 = requests.post(f"{API}/stealth/webhook", json={
            "email": email,
            "name": "Test User"
        }, timeout=10)
        self.test("Second stealth webhook returns 200", r2.status_code == 200, f"Got {r2.status_code}")
        
        if r2.status_code == 200:
            response2 = r2.json()
            contact_id2 = response2.get('contact_id')
            self.test(
                "Same contact_id returned (no duplicate)",
                contact_id2 == contact_id,
                f"First: {contact_id[:8] if contact_id else 'None'}, Second: {contact_id2[:8] if contact_id2 else 'None'}"
            )

    # ═══════════════════════════════════════════════════════════════════
    # BACKEND 7: Regression - existing endpoints
    # ═══════════════════════════════════════════════════════════════════
    def test_backend_7_regression(self):
        self.log("\n" + "="*70, "INFO")
        self.log("BACKEND 7: Regression test - existing endpoints", "INFO")
        self.log("="*70, "INFO")
        
        endpoints = [
            ("GET /api/automations", "GET", "/automations"),
            ("GET /api/contacts", "GET", "/contacts"),
            ("GET /api/stats", "GET", "/stats"),
        ]
        
        for name, method, endpoint in endpoints:
            r = requests.get(f"{API}{endpoint}", timeout=10)
            self.test(
                f"{name} returns 200",
                r.status_code == 200,
                f"Got {r.status_code}"
            )

    def run_all_tests(self):
        """Run all backend tests"""
        self.log("\n" + "="*70, "INFO")
        self.log("ATTRIBUTION REFRESH & TRIGGER AUDIENCE BACKEND TESTS", "INFO")
        self.log("="*70 + "\n", "INFO")
        
        try:
            self.test_backend_1_attribution_refresh_same_browser()
            self.test_backend_2_cross_device_email_stitch()
            self.test_backend_3_no_false_refresh()
            self.test_backend_4_trigger_audience_crud()
            self.test_backend_5_audience_firing()
            self.test_backend_6_stealth_webhook()
            self.test_backend_7_regression()
        finally:
            self.cleanup()
        
        # Summary
        self.log("\n" + "="*70, "INFO")
        self.log("TEST SUMMARY", "INFO")
        self.log("="*70, "INFO")
        self.log(f"Tests run: {self.tests_run}", "INFO")
        self.log(f"Tests passed: {self.tests_passed}", "SUCCESS")
        self.log(f"Tests failed: {len(self.failures)}", "FAIL" if self.failures else "INFO")
        
        if self.failures:
            self.log("\nFailed tests:", "FAIL")
            for f in self.failures:
                self.log(f"  - {f['test']}: {f.get('details', '')}", "FAIL")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"\nSuccess rate: {success_rate:.1f}%", "INFO")
        
        return 0 if len(self.failures) == 0 else 1

if __name__ == "__main__":
    tester = AttributionTester()
    sys.exit(tester.run_all_tests())
