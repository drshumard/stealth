import requests
import json
import sys
import uuid
from datetime import datetime

class AutomationFeaturesAPITester:
    def __init__(self, base_url="https://tether-workflows.preview.emergentagent.com"):
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
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=15)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=15)
            
            print(f"   Status: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
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
        return success

    def test_create_automation_with_steps(self):
        """Test POST /api/automations with new step-based structure"""
        automation_data = {
            "name": f"Test Automation {datetime.now().strftime('%H%M%S')}",
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
                        "name": "Test Webhook",
                        "url": "https://httpbin.org/post",
                        "field_map": [
                            {
                                "id": str(uuid.uuid4()),
                                "source": "email",
                                "target": "user_email"
                            }
                        ],
                        "exclude_nulls": True
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Automation with Steps",
            "POST",
            "/automations",
            201,
            data=automation_data
        )
        
        if success:
            created_automation = response.json()
            self.created_automation_id = created_automation.get('id')
            
            # Verify the automation has the correct structure
            required_fields = ['id', 'name', 'enabled', 'steps', 'created_at']
            for field in required_fields:
                if field not in created_automation:
                    print(f"⚠️  Missing field '{field}' in created automation")
                    return False
            
            # Verify steps structure
            steps = created_automation.get('steps', [])
            if len(steps) != 4:
                print(f"⚠️  Expected 4 steps, got {len(steps)}")
                return False
            
            # Check step types
            expected_types = ['wait_for', 'filter', 'delay', 'webhook']
            actual_types = [step.get('type') for step in steps]
            if actual_types != expected_types:
                print(f"⚠️  Step types mismatch. Expected {expected_types}, got {actual_types}")
                return False
            
            # Check webhook step has exclude_nulls field
            webhook_step = steps[3]
            if webhook_step.get('config', {}).get('exclude_nulls') is not True:
                print(f"⚠️  Webhook step should have exclude_nulls=True by default")
                return False
            
            print(f"✅ Created automation with ID: {self.created_automation_id}")
        
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
            required_fields = ['id', 'name', 'enabled', 'steps', 'created_at', 'updated_at']
            for field in required_fields:
                if field not in automation:
                    print(f"⚠️  Missing field '{field}' in automation detail")
                    return False
            
            # Verify steps are preserved
            steps = automation.get('steps', [])
            if len(steps) != 4:
                print(f"⚠️  Expected 4 steps in detail, got {len(steps)}")
                return False
        
        return success

    def test_update_automation_steps(self):
        """Test PUT /api/automations/{id} with step modifications"""
        if not self.created_automation_id:
            print("⚠️  No automation ID available for update test")
            return False
        
        # Add a duplicated step (simulating step duplication feature)
        updated_data = {
            "name": f"Updated Test Automation {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "wait_for",
                    "config": {
                        "fields": ["email", "phone"]  # Modified to require both
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "wait_for",  # Duplicated step
                    "config": {
                        "fields": ["email", "phone"]
                    }
                },
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "Updated Webhook",
                        "url": "https://httpbin.org/post",
                        "field_map": [],
                        "exclude_nulls": False  # Test changing exclude_nulls
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Update Automation with Duplicated Steps",
            "PUT",
            f"/automations/{self.created_automation_id}",
            200,
            data=updated_data
        )
        
        if success:
            updated_automation = response.json()
            steps = updated_automation.get('steps', [])
            
            # Verify we have 3 steps now (including duplicated wait_for)
            if len(steps) != 3:
                print(f"⚠️  Expected 3 steps after update, got {len(steps)}")
                return False
            
            # Verify first two steps are both wait_for (duplication test)
            if steps[0].get('type') != 'wait_for' or steps[1].get('type') != 'wait_for':
                print(f"⚠️  First two steps should be wait_for after duplication")
                return False
            
            # Verify exclude_nulls was updated to False
            webhook_step = steps[2]
            if webhook_step.get('config', {}).get('exclude_nulls') is not False:
                print(f"⚠️  Webhook exclude_nulls should be False after update")
                return False
            
            print(f"✅ Successfully updated automation with duplicated steps")
        
        return success

    def test_webhook_exclude_nulls_functionality(self):
        """Test that webhook steps properly handle exclude_nulls option"""
        # Create a simple automation with webhook step
        webhook_test_data = {
            "name": f"Webhook Test {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "webhook",
                    "config": {
                        "name": "Exclude Nulls Test",
                        "url": "https://httpbin.org/post",
                        "field_map": [
                            {
                                "id": str(uuid.uuid4()),
                                "source": "email",
                                "target": "user_email"
                            },
                            {
                                "id": str(uuid.uuid4()),
                                "source": "phone",
                                "target": "user_phone"
                            }
                        ],
                        "exclude_nulls": True
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Webhook with Exclude Nulls",
            "POST",
            "/automations",
            201,
            data=webhook_test_data
        )
        
        if success:
            webhook_automation = response.json()
            webhook_step = webhook_automation.get('steps', [{}])[0]
            config = webhook_step.get('config', {})
            
            # Verify exclude_nulls is properly stored
            if config.get('exclude_nulls') is not True:
                print(f"⚠️  exclude_nulls should be True in webhook config")
                return False
            
            # Verify field_map is preserved
            field_map = config.get('field_map', [])
            if len(field_map) != 2:
                print(f"⚠️  Expected 2 field mappings, got {len(field_map)}")
                return False
            
            print(f"✅ Webhook exclude_nulls functionality working correctly")
        
        return success

    def test_step_reordering_structure(self):
        """Test that step order is preserved in API operations"""
        reorder_data = {
            "name": f"Reorder Test {datetime.now().strftime('%H%M%S')}",
            "enabled": True,
            "steps": [
                {
                    "id": "step-1",
                    "type": "delay",
                    "config": {"seconds": 30}
                },
                {
                    "id": "step-2", 
                    "type": "wait_for",
                    "config": {"fields": ["email"]}
                },
                {
                    "id": "step-3",
                    "type": "webhook",
                    "config": {
                        "name": "Final Step",
                        "url": "https://httpbin.org/post",
                        "exclude_nulls": True
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Automation for Reorder Test",
            "POST",
            "/automations",
            201,
            data=reorder_data
        )
        
        if success:
            automation = response.json()
            automation_id = automation.get('id')
            
            # Now reorder the steps (move delay to end)
            reordered_data = {
                "steps": [
                    {
                        "id": "step-2",
                        "type": "wait_for", 
                        "config": {"fields": ["email"]}
                    },
                    {
                        "id": "step-3",
                        "type": "webhook",
                        "config": {
                            "name": "Final Step",
                            "url": "https://httpbin.org/post",
                            "exclude_nulls": True
                        }
                    },
                    {
                        "id": "step-1",
                        "type": "delay",
                        "config": {"seconds": 30}
                    }
                ]
            }
            
            reorder_success, reorder_response = self.run_test(
                "Reorder Automation Steps",
                "PUT",
                f"/automations/{automation_id}",
                200,
                data=reordered_data
            )
            
            if reorder_success:
                updated_automation = reorder_response.json()
                steps = updated_automation.get('steps', [])
                
                # Verify new order
                expected_order = ['wait_for', 'webhook', 'delay']
                actual_order = [step.get('type') for step in steps]
                
                if actual_order != expected_order:
                    print(f"⚠️  Step reordering failed. Expected {expected_order}, got {actual_order}")
                    return False
                
                print(f"✅ Step reordering preserved correctly")
            
            return reorder_success
        
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
            # Verify automation was deleted
            verify_success, verify_response = self.run_test(
                "Verify Automation Deleted",
                "GET",
                f"/automations/{self.created_automation_id}",
                404
            )
            if not verify_success:
                print("⚠️  Automation was not properly deleted")
                return False
        
        return success

def main():
    print("🚀 Starting Automation Features API Tests")
    print("=" * 60)
    
    tester = AutomationFeaturesAPITester()
    
    # Test 1: Get automations list
    tester.test_get_automations()
    
    # Test 2: Create automation with new step structure
    tester.test_create_automation_with_steps()
    
    # Test 3: Get automation detail
    tester.test_get_automation_detail()
    
    # Test 4: Update automation (test step duplication)
    tester.test_update_automation_steps()
    
    # Test 5: Test webhook exclude_nulls functionality
    tester.test_webhook_exclude_nulls_functionality()
    
    # Test 6: Test step reordering structure
    tester.test_step_reordering_structure()
    
    # Test 7: Delete automation
    tester.test_delete_automation()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 AUTOMATION FEATURES TEST RESULTS")
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