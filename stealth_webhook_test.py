#!/usr/bin/env python3
"""
Test script for Tether Workflows Stealth Webhook functionality
Tests name parsing and dynamic tag features as requested.
"""

import requests
import json
import sys
import uuid
from datetime import datetime

class StealthWebhookTester:
    def __init__(self, base_url="https://tether-workflows.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []
        self.created_contacts = []  # Track contacts for cleanup

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if params:
            print(f"   Params: {params}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=15)
            
            print(f"   Status: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    print(f"   Response: {response.text}")
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text}")
                self.failures.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                return False, None

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failures.append({
                "test": name,
                "error": str(e)
            })
            return False, None

    def test_name_parsing_two_words(self):
        """Test 1: Two-word name parsing"""
        test_data = {
            "email": "test1@example.com",
            "name": "John Doe",
            "phone": "1111111111"
        }
        
        success, response = self.run_test(
            "Name Parsing - Two Words",
            "POST",
            "/stealth/webhook",
            200,
            data=test_data
        )
        
        if success and response:
            contact_id = response.get('contact_id')
            if contact_id:
                self.created_contacts.append(contact_id)
                # Verify the contact was created with correct name parsing
                return self.verify_contact_name_parsing(contact_id, "John", "Doe", "John Doe")
        
        return success

    def test_name_parsing_three_words(self):
        """Test 2: Three-word name parsing"""
        test_data = {
            "email": "test2@example.com", 
            "name": "John Paul Doe",
            "phone": "2222222222"
        }
        
        success, response = self.run_test(
            "Name Parsing - Three Words",
            "POST",
            "/stealth/webhook",
            200,
            data=test_data
        )
        
        if success and response:
            contact_id = response.get('contact_id')
            if contact_id:
                self.created_contacts.append(contact_id)
                # Expected: first_name="John Paul", last_name="Doe"
                return self.verify_contact_name_parsing(contact_id, "John Paul", "Doe", "John Paul Doe")
        
        return success

    def test_name_parsing_hyphenated_first(self):
        """Test 3: Hyphenated first name parsing"""
        test_data = {
            "email": "test3@example.com",
            "name": "Mary-Jane Watson", 
            "phone": "3333333333"
        }
        
        success, response = self.run_test(
            "Name Parsing - Hyphenated First Name",
            "POST",
            "/stealth/webhook",
            200,
            data=test_data
        )
        
        if success and response:
            contact_id = response.get('contact_id')
            if contact_id:
                self.created_contacts.append(contact_id)
                # Expected: first_name="Mary-Jane", last_name="Watson"
                return self.verify_contact_name_parsing(contact_id, "Mary-Jane", "Watson", "Mary-Jane Watson")
        
        return success

    def test_name_parsing_hyphenated_last(self):
        """Test 4: Hyphenated last name parsing"""
        test_data = {
            "email": "test4@example.com",
            "name": "John Smith-Jones",
            "phone": "4444444444"
        }
        
        success, response = self.run_test(
            "Name Parsing - Hyphenated Last Name", 
            "POST",
            "/stealth/webhook",
            200,
            data=test_data
        )
        
        if success and response:
            contact_id = response.get('contact_id')
            if contact_id:
                self.created_contacts.append(contact_id)
                # Expected: first_name="John", last_name="Smith-Jones"
                return self.verify_contact_name_parsing(contact_id, "John", "Smith-Jones", "John Smith-Jones")
        
        return success

    def test_dynamic_tags_no_param(self):
        """Test 5: No tag parameter - should default to 'stealth'"""
        test_data = {
            "email": "test5@example.com",
            "name": "Default Tag",
            "phone": "5555555555"
        }
        
        success, response = self.run_test(
            "Dynamic Tags - No Parameter",
            "POST", 
            "/stealth/webhook",
            200,
            data=test_data
        )
        
        if success and response:
            contact_id = response.get('contact_id')
            if contact_id:
                self.created_contacts.append(contact_id)
                # Verify contact has 'stealth' tag
                return self.verify_contact_tags(contact_id, ["stealth"])
        
        return success

    def test_dynamic_tags_single_custom(self):
        """Test 6: Single custom tag"""
        test_data = {
            "email": "test6@example.com",
            "name": "Single Tag",
            "phone": "6666666666"
        }
        
        success, response = self.run_test(
            "Dynamic Tags - Single Custom",
            "POST",
            "/stealth/webhook",
            200,
            data=test_data,
            params={"tag": "replay"}
        )
        
        if success and response:
            contact_id = response.get('contact_id')
            if contact_id:
                self.created_contacts.append(contact_id)
                # Verify contact has 'replay' tag (not 'stealth')
                return self.verify_contact_tags(contact_id, ["replay"])
        
        return success

    def test_dynamic_tags_multiple(self):
        """Test 7: Multiple tags"""
        test_data = {
            "email": "test7@example.com",
            "name": "Multiple Tags",
            "phone": "7777777777"
        }
        
        success, response = self.run_test(
            "Dynamic Tags - Multiple",
            "POST",
            "/stealth/webhook", 
            200,
            data=test_data,
            params={"tag": "webinar,premium,vip"}
        )
        
        if success and response:
            contact_id = response.get('contact_id')
            if contact_id:
                self.created_contacts.append(contact_id)
                # Verify contact has all three tags
                return self.verify_contact_tags(contact_id, ["webinar", "premium", "vip"])
        
        return success

    def verify_contact_name_parsing(self, contact_id, expected_first, expected_last, expected_full):
        """Verify a contact has the correct name parsing"""
        print(f"   🔍 Verifying name parsing for contact {contact_id}")
        
        success, contact_data = self.run_test(
            f"Verify Contact {contact_id} Name Parsing",
            "GET",
            f"/contacts/{contact_id}",
            200
        )
        
        if not success or not contact_data:
            print(f"   ❌ Failed to fetch contact details")
            return False
        
        actual_first = contact_data.get('first_name')
        actual_last = contact_data.get('last_name') 
        actual_full = contact_data.get('name')
        
        print(f"   Expected: first='{expected_first}', last='{expected_last}', full='{expected_full}'")
        print(f"   Actual:   first='{actual_first}', last='{actual_last}', full='{actual_full}'")
        
        name_parsing_correct = (
            actual_first == expected_first and
            actual_last == expected_last and
            actual_full == expected_full
        )
        
        if name_parsing_correct:
            print(f"   ✅ Name parsing correct")
            return True
        else:
            print(f"   ❌ Name parsing incorrect")
            self.failures.append({
                "test": f"Name parsing verification for {contact_id}",
                "expected": f"first='{expected_first}', last='{expected_last}'",
                "actual": f"first='{actual_first}', last='{actual_last}'"
            })
            return False

    def verify_contact_tags(self, contact_id, expected_tags):
        """Verify a contact has the correct tags"""
        print(f"   🔍 Verifying tags for contact {contact_id}")
        
        success, contact_data = self.run_test(
            f"Verify Contact {contact_id} Tags",
            "GET", 
            f"/contacts/{contact_id}",
            200
        )
        
        if not success or not contact_data:
            print(f"   ❌ Failed to fetch contact details")
            return False
        
        actual_tags = contact_data.get('tags', [])
        
        print(f"   Expected tags: {expected_tags}")
        print(f"   Actual tags:   {actual_tags}")
        
        # Check if all expected tags are present
        tags_correct = all(tag in actual_tags for tag in expected_tags)
        
        if tags_correct:
            print(f"   ✅ Tags correct")
            return True
        else:
            print(f"   ❌ Tags incorrect")
            missing_tags = [tag for tag in expected_tags if tag not in actual_tags]
            self.failures.append({
                "test": f"Tag verification for {contact_id}",
                "expected": expected_tags,
                "actual": actual_tags,
                "missing": missing_tags
            })
            return False

    def cleanup_test_contacts(self):
        """Clean up test contacts"""
        print(f"\n🧹 Cleaning up {len(self.created_contacts)} test contacts...")
        
        for contact_id in self.created_contacts:
            try:
                success, _ = self.run_test(
                    f"Cleanup Contact {contact_id}",
                    "DELETE",
                    f"/contacts/{contact_id}",
                    204
                )
                if success:
                    print(f"   ✅ Deleted contact {contact_id}")
                else:
                    print(f"   ⚠️  Failed to delete contact {contact_id}")
            except Exception as e:
                print(f"   ❌ Error deleting contact {contact_id}: {e}")

def main():
    print("🚀 Starting Tether Workflows Stealth Webhook Tests")
    print("=" * 60)
    
    tester = StealthWebhookTester()
    
    try:
        # Test 1: Name Parsing Tests
        print("\n📝 TESTING NAME PARSING")
        print("-" * 30)
        
        tester.test_name_parsing_two_words()
        tester.test_name_parsing_three_words() 
        tester.test_name_parsing_hyphenated_first()
        tester.test_name_parsing_hyphenated_last()
        
        # Test 2: Dynamic Tags Tests
        print("\n🏷️  TESTING DYNAMIC TAGS")
        print("-" * 30)
        
        tester.test_dynamic_tags_no_param()
        tester.test_dynamic_tags_single_custom()
        tester.test_dynamic_tags_multiple()
        
    finally:
        # Always cleanup test contacts
        tester.cleanup_test_contacts()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failures:
        print(f"\n❌ FAILURES:")
        for failure in tester.failures:
            if 'error' in failure:
                print(f"   • {failure['test']}: {failure['error']}")
            else:
                expected = failure.get('expected', 'N/A')
                actual = failure.get('actual', 'N/A')
                print(f"   • {failure['test']}: Expected {expected}, got {actual}")
                if 'missing' in failure:
                    print(f"     Missing tags: {failure['missing']}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("✅ Tests PASSED - Stealth webhook functionality working correctly!")
        return 0
    else:
        print("❌ Tests FAILED - Issues found with stealth webhook functionality")
        return 1

if __name__ == "__main__":
    sys.exit(main())