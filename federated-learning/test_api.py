#!/usr/bin/env python3
"""
API Test Script
Test federated learning server endpoints manually
"""
import requests
import json
import time

SERVER_URL = "http://localhost:5000"


def print_section(title):
    print(f"\n{'='*70}")
    print(f"{title}")
    print(f"{'='*70}\n")


def test_health():
    """Test /health endpoint"""
    print_section("TEST 1: Health Check")
    try:
        response = requests.get(f"{SERVER_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False


def test_get_model():
    """Test /get_model endpoint"""
    print_section("TEST 2: Get Model")
    try:
        response = requests.get(f"{SERVER_URL}/get_model")
        data = response.json()
        print(f"Status: {response.status_code}")
        print(f"Round: {data['round']}")
        print(f"Weights shape: ({len(data['weights']['weights'])},)")
        print(f"Bias: {data['weights']['bias']:.6f}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False


def test_update_model():
    """Test /update_model endpoint"""
    print_section("TEST 3: Update Model (Simulate Client)")
    try:
        # Create dummy update
        update_data = {
            "client_id": "test_client_1",
            "weights": {
                "weights": [0.1] * 10,  # 10 features
                "bias": 0.5
            },
            "num_samples": 100
        }
        
        response = requests.post(
            f"{SERVER_URL}/update_model",
            json=update_data
        )
        data = response.json()
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(data, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False


def test_aggregate():
    """Test /aggregate endpoint"""
    print_section("TEST 4: Aggregate (with test updates)")
    try:
        # Add more client updates first
        for i in range(2, 4):
            update_data = {
                "client_id": f"test_client_{i}",
                "weights": {
                    "weights": [0.1 + i*0.01] * 10,
                    "bias": 0.5 + i*0.01
                },
                "num_samples": 100
            }
            requests.post(f"{SERVER_URL}/update_model", json=update_data)
            time.sleep(0.2)
        
        # Aggregate
        aggregate_data = {
            "client_ids": ["test_client_1", "test_client_2", "test_client_3"],
            "method": "average"
        }
        
        response = requests.post(
            f"{SERVER_URL}/aggregate",
            json=aggregate_data
        )
        data = response.json()
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(data, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False


def test_get_status():
    """Test /get_status endpoint"""
    print_section("TEST 5: Get Status")
    try:
        response = requests.get(f"{SERVER_URL}/get_status")
        data = response.json()
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(data, indent=2)}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False


def test_reset():
    """Test /reset endpoint"""
    print_section("TEST 6: Reset Server")
    try:
        response = requests.post(f"{SERVER_URL}/reset")
        data = response.json()
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(data, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False


def main():
    print("\n" + "#"*70)
    print("# FEDERATED LEARNING SERVER - API TEST")
    print("#"*70)
    print(f"\nServer URL: {SERVER_URL}\n")
    
    # Check server is running
    print("Checking server connection...")
    try:
        requests.get(f"{SERVER_URL}/health", timeout=2)
        print("✓ Server is running\n")
    except:
        print("✗ Server is not running!")
        print("Start it with: python server/server.py\n")
        return
    
    # Run tests
    tests = [
        ("Health Check", test_health),
        ("Get Model", test_get_model),
        ("Update Model", test_update_model),
        ("Aggregate", test_aggregate),
        ("Get Status", test_get_status),
        ("Reset Server", test_reset),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"Test failed with error: {e}")
            results.append((name, False))
    
    # Summary
    print_section("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed\n")


if __name__ == '__main__':
    main()
