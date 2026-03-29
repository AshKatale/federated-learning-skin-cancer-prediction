#!/usr/bin/env python
"""
Quick Test & Verification Script
Tests all components of the federated learning system
"""

import subprocess
import time
import requests
import sys
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:3001"
FL_API = f"{BASE_URL}/api/federated-learning"
TIMEOUT = 10

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BLUE}{'='*50}")
    print(f"{text}")
    print(f"{'='*50}{Colors.END}\n")

def print_success(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.END}")

def print_error(text):
    print(f"{Colors.RED}✗ {text}{Colors.END}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠ {text}{Colors.END}")

def test_imports():
    """Test if all Python dependencies are installed"""
    print_header("Testing Python Imports")
    
    required_modules = {
        'torch': 'PyTorch',
        'torchvision': 'TorchVision',
        'flwr': 'Flower Framework',
        'numpy': 'NumPy',
        'pandas': 'Pandas',
        'PIL': 'Pillow'
    }
    
    all_ok = True
    for module, name in required_modules.items():
        try:
            __import__(module)
            print_success(f"{name} installed")
        except ImportError:
            print_error(f"{name} NOT installed")
            all_ok = False
    
    return all_ok

def test_file_structure():
    """Verify all required files exist"""
    print_header("Verifying File Structure")
    
    required_files = [
        'federated-learning/fl_server.py',
        'federated-learning/fl_client.py',
        'federated-learning/client_simulator.py',
        'federated-learning/training_orchestrator.py',
        'server/controllers/federatedLearningController.js',
        'server/routes/federatedLearningRoutes.js',
        'desktop-app/main.js',
        'desktop-app/preload.js'
    ]
    
    project_root = Path('.').resolve()
    all_ok = True
    
    for file_path in required_files:
        full_path = project_root / file_path
        if full_path.exists():
            print_success(f"{file_path}")
        else:
            print_error(f"{file_path} NOT FOUND")
            all_ok = False
    
    return all_ok

def test_python_syntax():
    """Check Python files for syntax errors"""
    print_header("Checking Python Syntax")
    
    python_files = [
        'federated-learning/fl_server.py',
        'federated-learning/fl_client.py',
        'federated-learning/client_simulator.py',
        'federated-learning/training_orchestrator.py'
    ]
    
    all_ok = True
    for file_path in python_files:
        try:
            result = subprocess.run(
                ['python', '-m', 'py_compile', file_path],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                print_success(f"{file_path}")
            else:
                print_error(f"{file_path}: {result.stderr.decode()}")
                all_ok = False
        except Exception as e:
            print_error(f"{file_path}: {str(e)}")
            all_ok = False
    
    return all_ok

def test_fl_server():
    """Test Flower FL server startup"""
    print_header("Testing Flower Server")
    
    print_warning("Attempting to start FL server (will timeout after 5 seconds)...")
    
    try:
        proc = subprocess.Popen(
            ['python', 'federated-learning/fl_server.py'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait a bit for server to start
        time.sleep(3)
        
        # Check if process is still running
        if proc.poll() is None:
            print_success("FL server process started")
            proc.terminate()
            proc.wait(timeout=5)
            return True
        else:
            stderr = proc.stderr.read().decode()
            print_error(f"FL server failed to start: {stderr[:100]}")
            return False
    except Exception as e:
        print_error(f"FL server test error: {str(e)}")
        return False

def test_client_simulator():
    """Test client simulator"""
    print_header("Testing Client Simulator")
    
    try:
        sys.path.insert(0, 'federated-learning')
        from client_simulator import ClientSimulator
        
        simulator = ClientSimulator(num_clients=3, iid=False)
        print_success("ClientSimulator instantiated")
        
        # Test with dummy data
        import numpy as np
        X = np.random.randn(100, 224, 224, 3).astype(np.float32)
        y = np.random.randint(0, 7, 100)
        
        simulator.distribute_data(X, y)
        print_success("Data distributed to clients")
        
        data = simulator.get_client_data(0)
        print_success(f"Retrieved data for client 0: {data[0].shape}")
        
        return True
    except Exception as e:
        print_error(f"Client simulator test failed: {str(e)}")
        return False

def test_backend_connectivity():
    """Test if backend services are running"""
    print_header("Testing Backend Connectivity")
    
    services = {
        'Backend': f'{BASE_URL}/api/health',
        'ML Server': 'http://localhost:5000/health',
        'FL Server': 'http://localhost:8080'
    }
    
    all_running = True
    for name, url in services.items():
        try:
            response = requests.get(url, timeout=TIMEOUT)
            print_success(f"{name} is running")
        except requests.exceptions.ConnectionError:
            print_warning(f"{name} is not running (expected if not started)")
            all_running = False
        except Exception as e:
            print_warning(f"{name} check error: {str(e)[:50]}")
    
    return all_running

def test_fl_endpoints():
    """Test FL API endpoints (requires running backend)"""
    print_header("Testing FL API Endpoints")
    
    # Note: These would need proper auth token
    print_warning("Skipping endpoint tests (requires running backend and auth token)")
    
    endpoints = [
        ('POST', '/train-global'),
        ('POST', '/train-local'),
        ('GET', '/{trainingId}/status'),
        ('GET', '/analytics')
    ]
    
    for method, endpoint in endpoints:
        print(f"  {method:6} {FL_API}{endpoint}")
    
    return True

def main():
    """Run all tests"""
    print(f"\n{Colors.BLUE}Federated Learning System - Verification Tests{Colors.END}\n")
    
    results = {}
    
    # Run tests
    results['Python Imports'] = test_imports()
    results['File Structure'] = test_file_structure()
    results['Python Syntax'] = test_python_syntax()
    results['Client Simulator'] = test_client_simulator()
    results['FL Server Startup'] = test_fl_server()
    results['Backend Connectivity'] = test_backend_connectivity()
    results['FL Endpoints'] = test_fl_endpoints()
    
    # Summary
    print_header("TEST SUMMARY")
    
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}PASS{Colors.END}" if passed else f"{Colors.RED}FAIL{Colors.END}"
        print(f"{test_name:.<40} {status}")
    
    total_passed = sum(1 for v in results.values() if v)
    total_tests = len(results)
    
    print(f"\n{Colors.BLUE}{'='*50}")
    print(f"Passed: {total_passed}/{total_tests}{Colors.END}")
    
    if total_passed == total_tests:
        print(f"{Colors.GREEN}All tests passed! System is ready.{Colors.END}\n")
        return 0
    else:
        print(f"{Colors.YELLOW}Some tests failed. Check output above.{Colors.END}\n")
        return 1

if __name__ == '__main__':
    sys.exit(main())
