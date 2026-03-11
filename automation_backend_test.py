import requests
import json
import sys
import uuid
from datetime import datetime

class AutomationAPITester:
    def __init__(self, base_url="https://contact-tracker-49.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []
        self.created_automation_id = None

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
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            
            print(f"   Status: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                try:
                    if response.text:
                        response_data = response.json()
                        print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
                    else:
                        print("   Response: (empty)")
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

    def test_get_automations(self):
        """Test GET /api/automations"""
        success, response = self.run_test(
            "Get Automations List",
            "GET",
            "/automations",
            200
        )
        if success:
            automations = response.json()
            if not isinstance(automations, list):
                print("⚠️  Automations should return a list")
                return False
            print(f"   Found {len(automations)} automations")
            # Check if each automation has required fields
            if automations:
                automation = automations[0]
                required_fields = ['id', 'name', 'enabled', 'created_at']
                for field in required_fields:
                    if field not in automation:
                        print(f"⚠️  Missing field '{field}' in automation object")
                        return False
        return success

    def test_create_automation_new_format(self):
        """Test POST /api/automations with new steps format"""
        automation_data = {
            "name": f"Test Automation New Format {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "wait_for",
                    "config": {
                        "fields": ["email", "phone"]
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "filter",
                    "config": {
                        "filters": [
                            {
                                "id": str(uuid.uuid4()),
                                "field": "utm_source",
                                "operator": "equals",
                                "value": "facebook"
                            }
                        ]
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "delay",
                    "config": {
                        "seconds": 120
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "Send to Test Webhook",
                        "url": "https://httpbin.org/post",
                        "field_map": [
                            {
                                "id": str(uuid.uuid4()),
                                "source": "email",
                                "target": "user_email"
                            },
                            {
                                "id": str(uuid.uuid4()),
                                "source": "name",
                                "target": "full_name"
                            }
                        ]
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Automation (New Steps Format)",
            "POST",
            "/automations",
            201,
            data=automation_data
        )
        if success:
            automation = response.json()
            self.created_automation_id = automation.get('id')
            # Verify the automation has the expected structure
            if 'steps' not in automation:
                print("⚠️  Created automation missing 'steps' field")
                return False
            if len(automation['steps']) != 4:
                print(f"⚠️  Expected 4 steps, got {len(automation['steps'])}")
                return False
            # Check step types
            step_types = [step.get('type') for step in automation['steps']]
            expected_types = ['wait_for', 'filter', 'delay', 'webhook']
            if step_types != expected_types:
                print(f"⚠️  Expected step types {expected_types}, got {step_types}")
                return False
        return success

    def test_create_automation_legacy_format(self):
        """Test POST /api/automations with legacy format"""
        automation_data = {
            "name": f"Test Automation Legacy {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "required_fields": ["email"],
            "filters": [
                {
                    "field": "utm_campaign",
                    "operator": "contains",
                    "value": "test"
                }
            ],
            "webhook_url": "https://httpbin.org/post",
            "field_map": [
                {
                    "source": "email",
                    "target": "user_email"
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Automation (Legacy Format)",
            "POST",
            "/automations",
            201,
            data=automation_data
        )
        return success

    def test_get_automation_detail(self):
        """Test GET /api/automations/{id}"""
        if not self.created_automation_id:
            print("⚠️  No automation ID available for detail test")
            return False
            
        success, response = self.run_test(
            "Get Automation Detail",
            "GET",
            f"/automations/{self.created_automation_id}",
            200
        )
        if success:
            automation = response.json()
            required_fields = ['id', 'name', 'enabled', 'steps', 'created_at']
            for field in required_fields:
                if field not in automation:
                    print(f"⚠️  Missing field '{field}' in automation detail")
                    return False
            print(f"   Automation has {len(automation.get('steps', []))} steps")
        return success

    def test_update_automation(self):
        """Test PUT /api/automations/{id}"""
        if not self.created_automation_id:
            print("⚠️  No automation ID available for update test")
            return False

        update_data = {
            "name": f"Updated Test Automation {datetime.now().strftime('%H%M%S')}",
            "enabled": False,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "wait_for",
                    "config": {
                        "fields": ["email"]
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "Updated Webhook",
                        "url": "https://httpbin.org/put",
                        "field_map": []
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Update Automation",
            "PUT",
            f"/automations/{self.created_automation_id}",
            200,
            data=update_data
        )
        if success:
            automation = response.json()
            if automation.get('enabled') != False:
                print("⚠️  Automation enabled status not updated correctly")
                return False
            if len(automation.get('steps', [])) != 2:
                print(f"⚠️  Expected 2 steps after update, got {len(automation.get('steps', []))}")
                return False
        return success

    def test_automation_test_endpoint(self):
        """Test POST /api/automations/{id}/test"""
        if not self.created_automation_id:
            print("⚠️  No automation ID available for test endpoint")
            return False

        test_data = {
            "contact": {
                "email": "test@example.com",
                "name": "Test User",
                "utm_source": "facebook",
                "utm_campaign": "test_campaign"
            }
        }
        
        success, response = self.run_test(
            "Test Automation Endpoint",
            "POST",
            f"/automations/{self.created_automation_id}/test",
            200,
            data=test_data
        )
        return success

    def test_get_automation_runs(self):
        """Test GET /api/automations/{id}/runs"""
        if not self.created_automation_id:
            print("⚠️  No automation ID available for runs test")
            return False
            
        success, response = self.run_test(
            "Get Automation Runs",
            "GET",
            f"/automations/{self.created_automation_id}/runs",
            200
        )
        if success:
            runs = response.json()
            if not isinstance(runs, list):
                print("⚠️  Automation runs should return a list")
                return False
            print(f"   Found {len(runs)} automation runs")
        return success

    def test_delete_automation(self):
        """Test DELETE /api/automations/{id}"""
        if not self.created_automation_id:
            print("⚠️  No automation ID available for delete test")
            return False
            
        success, response = self.run_test(
            "Delete Automation",
            "DELETE",
            f"/automations/{self.created_automation_id}",
            204
        )
        if success:
            # Verify automation was actually deleted
            verify_success, verify_response = self.run_test(
                "Verify Automation Deleted",
                "GET", 
                f"/automations/{self.created_automation_id}",
                404
            )
            if not verify_success:
                print("⚠️  Automation was not properly deleted - still exists")
                return False
        return success

    def test_delete_invalid_automation(self):
        """Test DELETE /api/automations/{invalid_id} returns 404"""
        invalid_id = "invalid-automation-id-123"
        success, response = self.run_test(
            "Delete Invalid Automation",
            "DELETE", 
            f"/automations/{invalid_id}",
            404
        )
        return success

def main():
    print("🚀 Starting Automation API Tests")
    print("=" * 50)
    
    tester = AutomationAPITester()
    
    # Test 1: Get automations list
    tester.test_get_automations()
    
    # Test 2: Create automation with new steps format
    tester.test_create_automation_new_format()
    
    # Test 3: Create automation with legacy format
    tester.test_create_automation_legacy_format()
    
    # Test 4: Get automation detail
    tester.test_get_automation_detail()
    
    # Test 5: Update automation
    tester.test_update_automation()
    
    # Test 6: Test automation endpoint
    tester.test_automation_test_endpoint()
    
    # Test 7: Get automation runs
    tester.test_get_automation_runs()
    
    # Test 8: Delete automation
    tester.test_delete_automation()
    
    # Test 9: Delete invalid automation should return 404
    tester.test_delete_invalid_automation()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failures:
        print(f"\n❌ FAILURES:")
        for failure in tester.failures:
            error_msg = failure.get('error', f"Expected {failure.get('expected')}, got {failure.get('actual')}")
            print(f"   • {failure['test']}: {error_msg}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())