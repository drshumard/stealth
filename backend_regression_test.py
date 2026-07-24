#!/usr/bin/env python3
"""
Light backend regression test for React Router v7 migration.
Tests only the 3 GET endpoints to verify backend still works.
"""
import requests
import sys

BASE_URL = "https://lead-tracker-312.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

def test_endpoint(name, endpoint):
    """Test a single GET endpoint"""
    url = f"{API_URL}{endpoint}"
    print(f"\n🔍 Testing {name}...")
    print(f"   URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print(f"✅ Passed")
            try:
                data = response.json()
                print(f"   Response type: {type(data).__name__}")
                if isinstance(data, list):
                    print(f"   Items: {len(data)}")
                elif isinstance(data, dict):
                    print(f"   Keys: {list(data.keys())}")
            except:
                pass
            return True
        else:
            print(f"❌ Failed - Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Failed - Error: {str(e)}")
        return False

def main():
    print("🚀 Backend Regression Test (React Router v7 Migration)")
    print("=" * 60)
    
    tests = [
        ("GET /api/automations", "/automations"),
        ("GET /api/contacts", "/contacts"),
        ("GET /api/stats", "/stats"),
    ]
    
    results = []
    for name, endpoint in tests:
        results.append(test_endpoint(name, endpoint))
    
    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"📊 RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All backend endpoints working correctly")
        return 0
    else:
        print("❌ Some backend endpoints failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
