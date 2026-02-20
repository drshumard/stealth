import requests
import json
import sys
import uuid
from datetime import datetime

class StealthTrackAPITester:
    def __init__(self, base_url="https://conversion-pulse-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            
            print(f"   Status: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
                return True, response
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failures.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, response

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failures.append({
                "test": name,
                "error": str(e)
            })
            return False, None

    def test_health_endpoint(self):
        """Test GET /api/ health check"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/",
            200
        )
        if success:
            data = response.json()
            expected_fields = ['message', 'status']
            for field in expected_fields:
                if field not in data:
                    print(f"⚠️  Missing field '{field}' in health response")
                    return False
            if data['message'] != 'StealthTrack API' or data['status'] != 'running':
                print(f"⚠️  Unexpected health response: {data}")
                return False
        return success

    def test_tracker_js(self):
        """Test GET /api/tracker.js returns valid JavaScript"""
        success, response = self.run_test(
            "Tracker JS Script",
            "GET",
            "/tracker.js",
            200,
            headers={'Accept': 'application/javascript, text/plain, */*'}
        )
        if success:
            js_content = response.text
            # Check that BACKEND_URL is properly set (no double braces)
            if '{{' in js_content or '}}' in js_content:
                print("⚠️  Found double braces in tracker.js - templating issue")
                return False
            if 'BACKEND_URL' not in js_content:
                print("⚠️  BACKEND_URL not found in tracker.js")
                return False
            if self.base_url in js_content:
                print(f"✅ BACKEND_URL correctly set to {self.base_url}")
            else:
                print(f"⚠️  BACKEND_URL not properly set in tracker.js")
                return False
        return success

    def test_track_pageview(self):
        """Test POST /api/track/pageview"""
        test_contact_id = str(uuid.uuid4())
        data = {
            "contact_id": test_contact_id,
            "current_url": "https://example.com/webinar?source=test",
            "referrer_url": "https://google.com",
            "page_title": "Test Webinar Page"
        }
        
        success, response = self.run_test(
            "Track Pageview",
            "POST",
            "/track/pageview",
            200,
            data=data
        )
        if success:
            resp_data = response.json()
            if 'status' not in resp_data or resp_data['status'] != 'ok':
                print("⚠️  Invalid pageview response format")
                return False
            if 'visit_id' not in resp_data:
                print("⚠️  Missing visit_id in pageview response")
                return False
        return success, test_contact_id if success else None

    def test_track_registration(self):
        """Test POST /api/track/registration"""
        test_contact_id = str(uuid.uuid4())
        data = {
            "contact_id": test_contact_id,
            "name": "John Test",
            "email": "john.test@example.com",
            "phone": "+1-555-0123",
            "current_url": "https://example.com/register?utm_source=test",
            "referrer_url": "https://google.com",
            "page_title": "Registration Page"
        }
        
        success, response = self.run_test(
            "Track Registration",
            "POST",
            "/track/registration",
            200,
            data=data
        )
        if success:
            resp_data = response.json()
            if 'status' not in resp_data or resp_data['status'] != 'ok':
                print("⚠️  Invalid registration response format")
                return False
            if resp_data.get('contact_id') != test_contact_id:
                print("⚠️  Contact ID mismatch in registration response")
                return False
        return success, test_contact_id if success else None

    def test_get_contacts(self):
        """Test GET /api/contacts"""
        success, response = self.run_test(
            "Get Contacts",
            "GET",
            "/contacts",
            200
        )
        if success:
            contacts = response.json()
            if not isinstance(contacts, list):
                print("⚠️  Contacts should return a list")
                return False
            print(f"   Found {len(contacts)} contacts")
            # Check if each contact has required fields
            if contacts:
                contact = contacts[0]
                required_fields = ['id', 'contact_id', 'created_at', 'visit_count']
                for field in required_fields:
                    if field not in contact:
                        print(f"⚠️  Missing field '{field}' in contact object")
                        return False
        return success

    def test_get_contact_detail(self, contact_id):
        """Test GET /api/contacts/{contact_id}"""
        if not contact_id:
            print("⚠️  No contact_id provided for detail test")
            return False
            
        success, response = self.run_test(
            "Get Contact Detail",
            "GET",
            f"/contacts/{contact_id}",
            200
        )
        if success:
            contact = response.json()
            required_fields = ['id', 'contact_id', 'created_at', 'visits']
            for field in required_fields:
                if field not in contact:
                    print(f"⚠️  Missing field '{field}' in contact detail")
                    return False
            if not isinstance(contact['visits'], list):
                print("⚠️  Visits should be a list")
                return False
            print(f"   Contact has {len(contact['visits'])} visits")
        return success

    def test_get_stats(self):
        """Test GET /api/stats"""
        success, response = self.run_test(
            "Get Stats",
            "GET",
            "/stats",
            200
        )
        if success:
            stats = response.json()
            required_fields = ['total_contacts', 'total_visits', 'today_visits']
            for field in required_fields:
                if field not in stats:
                    print(f"⚠️  Missing field '{field}' in stats")
                    return False
            print(f"   Stats: {stats['total_contacts']} contacts, {stats['total_visits']} visits, {stats['today_visits']} today")
        return success

    def test_get_contacts_with_search(self):
        """Test GET /api/contacts with search parameter"""
        success, response = self.run_test(
            "Get Contacts with Search",
            "GET",
            "/contacts?search=test",
            200
        )
        return success

def main():
    print("🚀 Starting StealthTrack API Tests")
    print("=" * 50)
    
    tester = StealthTrackAPITester()
    
    # Test 1: Health check
    tester.test_health_endpoint()
    
    # Test 2: Tracker.js script
    tester.test_tracker_js()
    
    # Test 3: Page view tracking
    pageview_success, pageview_contact_id = tester.test_track_pageview()
    
    # Test 4: Registration tracking
    registration_success, registration_contact_id = tester.test_track_registration()
    
    # Test 5: Get contacts
    tester.test_get_contacts()
    
    # Test 6: Get contact detail (use registration contact ID if available)
    test_contact_id = registration_contact_id or pageview_contact_id
    if test_contact_id:
        tester.test_get_contact_detail(test_contact_id)
    
    # Test 7: Get stats
    tester.test_get_stats()
    
    # Test 8: Search functionality
    tester.test_get_contacts_with_search()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failures:
        print(f"\n❌ FAILURES:")
        for failure in tester.failures:
            print(f"   • {failure['test']}: {failure.get('error', f'Expected {failure.get(\"expected\")}, got {failure.get(\"actual\")}')}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())