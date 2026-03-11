import requests
import json
import sys
import uuid
from datetime import datetime

class ValidationAPITester:
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
        if data:
            print(f"   Data: {json.dumps(data, indent=2)[:300]}...")
        
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
                print(f"   Response: {response.text[:300]}")
                self.failures.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })
                return False, response

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failures.append({
                "test": name,
                "error": str(e)
            })
            return False, None

    def test_webhook_url_validation_invalid_url(self):
        """Test webhook step with invalid URL - should fail validation"""
        automation_data = {
            "name": f"Test Invalid URL {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "Invalid URL Test",
                        "url": "not-a-url",  # Invalid URL
                        "field_map": []
                    }
                }
            ]
        }
        
        # This should fail with 400 due to invalid URL
        success, response = self.run_test(
            "Create Automation with Invalid URL",
            "POST",
            "/automations",
            400,  # Expecting validation error
            data=automation_data
        )
        return success

    def test_webhook_url_validation_ftp_url(self):
        """Test webhook step with FTP URL - should fail validation"""
        automation_data = {
            "name": f"Test FTP URL {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "FTP URL Test",
                        "url": "ftp://example.com",  # FTP URL should be invalid
                        "field_map": []
                    }
                }
            ]
        }
        
        # This should fail with 400 due to non-HTTP URL
        success, response = self.run_test(
            "Create Automation with FTP URL",
            "POST",
            "/automations",
            400,  # Expecting validation error
            data=automation_data
        )
        return success

    def test_webhook_url_validation_valid_url(self):
        """Test webhook step with valid HTTPS URL - should succeed"""
        automation_data = {
            "name": f"Test Valid URL {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "Valid URL Test",
                        "url": "https://httpbin.org/post",  # Valid HTTPS URL
                        "field_map": []
                    }
                }
            ]
        }
        
        # This should succeed
        success, response = self.run_test(
            "Create Automation with Valid HTTPS URL",
            "POST",
            "/automations",
            201,  # Expecting success
            data=automation_data
        )
        if success:
            automation = response.json()
            self.created_automation_id = automation.get('id')
        return success

    def test_filter_value_validation_empty_value(self):
        """Test filter step with empty value for 'equals' operator - should fail validation"""
        automation_data = {
            "name": f"Test Empty Filter Value {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "filter",
                    "config": {
                        "filters": [
                            {
                                "id": str(uuid.uuid4()),
                                "field": "email",
                                "operator": "equals",
                                "value": ""  # Empty value for equals operator
                            }
                        ]
                    }
                }
            ]
        }
        
        # This should fail with 400 due to empty value
        success, response = self.run_test(
            "Create Automation with Empty Filter Value",
            "POST",
            "/automations",
            400,  # Expecting validation error
            data=automation_data
        )
        return success

    def test_filter_value_validation_missing_value(self):
        """Test filter step with missing value for 'equals' operator - should fail validation"""
        automation_data = {
            "name": f"Test Missing Filter Value {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "filter",
                    "config": {
                        "filters": [
                            {
                                "id": str(uuid.uuid4()),
                                "field": "email",
                                "operator": "equals"
                                # Missing value field
                            }
                        ]
                    }
                }
            ]
        }
        
        # This should fail with 400 due to missing value
        success, response = self.run_test(
            "Create Automation with Missing Filter Value",
            "POST",
            "/automations",
            400,  # Expecting validation error
            data=automation_data
        )
        return success

    def test_filter_value_validation_valid_value(self):
        """Test filter step with valid value - should succeed"""
        automation_data = {
            "name": f"Test Valid Filter Value {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "filter",
                    "config": {
                        "filters": [
                            {
                                "id": str(uuid.uuid4()),
                                "field": "email",
                                "operator": "equals",
                                "value": "test@example.com"  # Valid value
                            }
                        ]
                    }
                }
            ]
        }
        
        # This should succeed
        success, response = self.run_test(
            "Create Automation with Valid Filter Value",
            "POST",
            "/automations",
            201,  # Expecting success
            data=automation_data
        )
        return success

    def test_get_invalid_automation_id(self):
        """Test GET /api/automations/{fake-id} - should return 404"""
        fake_id = "fake-id-12345"
        success, response = self.run_test(
            "Get Invalid Automation ID",
            "GET",
            f"/automations/{fake_id}",
            404  # Expecting not found
        )
        return success

    def test_complete_automation_with_all_steps(self):
        """Test creating automation with all 4 step types"""
        automation_data = {
            "name": f"Complete Test Automation {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
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
                        "seconds": 60
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "Complete Test Webhook",
                        "url": "https://httpbin.org/post",
                        "field_map": [
                            {
                                "id": str(uuid.uuid4()),
                                "source": "email",
                                "target": "user_email"
                            }
                        ]
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Complete Automation with All Step Types",
            "POST",
            "/automations",
            201,
            data=automation_data
        )
        if success:
            automation = response.json()
            complete_automation_id = automation.get('id')
            print(f"   Created complete automation with ID: {complete_automation_id}")
            
            # Test updating the automation
            update_data = {
                "name": f"Updated Complete Automation {datetime.now().strftime('%H%M%S')}",
                "enabled": False
            }
            
            update_success, update_response = self.run_test(
                "Update Complete Automation",
                "PUT",
                f"/automations/{complete_automation_id}",
                200,
                data=update_data
            )
            
            if update_success:
                # Test deleting the automation
                delete_success, delete_response = self.run_test(
                    "Delete Complete Automation",
                    "DELETE",
                    f"/automations/{complete_automation_id}",
                    204
                )
                return delete_success
            
        return success

    def test_curl_command_from_request(self):
        """Test the exact curl command from the review request"""
        automation_data = {
            "name": "Final Test",
            "enabled": True,
            "steps": [
                {
                    "id": "s1",
                    "type": "webhook",
                    "config": {
                        "url": "https://httpbin.org/post"
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Curl Command Test from Review Request",
            "POST",
            "/automations",
            201,
            data=automation_data
        )
        return success

def main():
    print("🚀 Starting Validation-Focused API Tests")
    print("=" * 60)
    
    tester = ValidationAPITester()
    
    # Test 1: URL Validation Tests
    print("\n📋 URL VALIDATION TESTS")
    print("-" * 30)
    tester.test_webhook_url_validation_invalid_url()
    tester.test_webhook_url_validation_ftp_url()
    tester.test_webhook_url_validation_valid_url()
    
    # Test 2: Filter Value Validation Tests
    print("\n📋 FILTER VALUE VALIDATION TESTS")
    print("-" * 30)
    tester.test_filter_value_validation_empty_value()
    tester.test_filter_value_validation_missing_value()
    tester.test_filter_value_validation_valid_value()
    
    # Test 3: Error State Tests
    print("\n📋 ERROR STATE TESTS")
    print("-" * 30)
    tester.test_get_invalid_automation_id()
    
    # Test 4: End-to-End Flow Tests
    print("\n📋 END-TO-END FLOW TESTS")
    print("-" * 30)
    tester.test_complete_automation_with_all_steps()
    
    # Test 5: Curl Command Test
    print("\n📋 CURL COMMAND TEST")
    print("-" * 30)
    tester.test_curl_command_from_request()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failures:
        print(f"\n❌ FAILURES:")
        for failure in tester.failures:
            error_msg = failure.get('error', f"Expected {failure.get('expected')}, got {failure.get('actual')}")
            print(f"   • {failure['test']}: {error_msg}")
            if 'response' in failure:
                print(f"     Response: {failure['response']}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 70 else 1

if __name__ == "__main__":
    sys.exit(main())