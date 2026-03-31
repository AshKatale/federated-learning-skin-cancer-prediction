#!/usr/bin/env python3
"""
CUDA PyTorch Installation Helper
Downloads and installs PyTorch with CUDA 12.1 support with progress reporting.
"""

import sys
import subprocess
import re
import json
import time
import threading

def send_progress(status, downloaded=0, total=0, percentage=0, message=""):
    """Send progress update to Electron."""
    data = {
        "status": status,
        "downloaded": downloaded,
        "total": total,
        "percentage": percentage,
        "message": message,
    }
    print(json.dumps(data), flush=True)
    sys.stdout.flush()

def watch_process(proc, status_prefix="downloading"):
    """Watch process output in real-time without blocking."""
    try:
        for line in iter(proc.stdout.readline, ''):
            if not line:
                break
            line = line.strip()
            if not line:
                continue
            
            # Send all meaningful output for visibility
            if any(word in line for word in ['Downloading', 'Collecting', 'Successfully', 'Requirement', 'Installing', 'Processing']):
                send_progress(status_prefix, message=line[:120])
    except:
        pass

def parse_size(size_str):
    """Parse size string like '1.5 MB' or '123 bytes' to bytes."""
    try:
        size_str = size_str.strip()
        if 'MB' in size_str:
            return float(size_str.replace('MB', '').strip()) * 1024 * 1024
        elif 'KB' in size_str:
            return float(size_str.replace('KB', '').strip()) * 1024
        elif 'bytes' in size_str:
            return float(size_str.replace('bytes', '').strip())
        elif 'B' in size_str:
            return float(size_str.replace('B', '').strip())
        return 0
    except:
        return 0

def install_pytorch_cuda():
    """Install PyTorch with CUDA 12.1 support."""
    try:
        send_progress("started", message="Starting PyTorch CUDA 12.1 installation...")
        
        # Step 0: Clear pip cache to avoid stale packages
        send_progress("upgrading_pip", message="Clearing pip cache...")
        cache_cmd = [sys.executable, '-m', 'pip', 'cache', 'purge']
        subprocess.run(cache_cmd, capture_output=True, timeout=30)
        
        # Step 1: Force uninstall CPU-only PyTorch
        send_progress("upgrading_pip", percentage=10, message="Removing old CPU-only PyTorch...")
        uninstall_cmd = [sys.executable, '-m', 'pip', 'uninstall', '-y', '--no-deps', 
                        'torch', 'torchvision', 'torchaudio']
        result = subprocess.run(uninstall_cmd, capture_output=True, text=True, encoding='utf-8', timeout=60)
        send_progress("upgrading_pip", percentage=15, message="✅ Old PyTorch removed")
        
        # Step 2: Upgrade pip
        send_progress("upgrading_pip", percentage=20, message="Upgrading pip...")
        upgrade_cmd = [sys.executable, '-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel', '--quiet']
        result = subprocess.run(upgrade_cmd, capture_output=True, text=True, encoding='utf-8', timeout=120)
        
        if result.returncode != 0:
            send_progress("error", message=f"Failed to upgrade pip. Error: {result.stderr[:200]}")
            return False
        
        send_progress("upgrading_pip", percentage=30, message="✅ Pip upgraded")
        
        # Step 3: Install PyTorch CUDA with force-reinstall to ensure no CPU version exists
        send_progress("downloading", percentage=5, message="⏳ Downloading PyTorch 2.5.1 with CUDA 12.1...")
        
        install_cmd = [
            sys.executable, '-m', 'pip', 'install',
            '--force-reinstall',  # Force replacement of any old version
            '--no-cache-dir',
            '--default-timeout=1000',
            '--index-url', 'https://download.pytorch.org/whl/cu121',
            'torch==2.5.1',
            'torchvision==0.20.1',  # Latest compatible with torch 2.5.1
            'torchaudio==2.5.1',
        ]
        
        # Run installation process
        proc = subprocess.Popen(
            install_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1,
        )
        
        last_update = time.time()
        total_size_bytes = 0
        downloaded_bytes = 0
        installing = False
        found_downloads = False
        
        for line in iter(proc.stdout.readline, ''):
            if not line:
                break
            
            line = line.rstrip('\n\r')
            if not line:
                continue
            
            # Send EVERY line to the UI immediately - no filtering
            # User sees complete terminal output with progress speed, ETA, etc.
            send_progress("downloading", message=line)
            
            # Also try to parse and update progress percentage if line has useful info
            if 'Downloading' in line or 'MB/s' in line:
                if 'Collecting' not in line:  # Skip the "Collecting" header lines
                    found_downloads = True
            
            # Detect installation phase transitions
            if 'Installing collected' in line or 'Running install for' in line or 'Installing build dependencies' in line:
                installing = True
            
            # Detect completion
            if 'Successfully installed' in line:
                send_progress("downloading", percentage=95, message="✅ Installation complete, finalizing...")
            elif 'already satisfied' in line:
                send_progress("downloading", percentage=95, message="✅ Packages already satisfied, finalizing...")
        
        # Wait for completion
        returncode = proc.wait()
        
        if returncode == 0:
            send_progress("completed", 
                        percentage=100,
                        message="✅ PyTorch CUDA 12.1 installed! Please restart the app to detect GPU.")
            return True
        else:
            send_progress("error", message="❌ Installation failed. Check logs above for details.")
            return False
            
    except subprocess.TimeoutExpired:
        proc.kill()
        send_progress("error", message="❌ Installation timeout. Try again with a stable internet connection.")
        return False
    except Exception as e:
        send_progress("error", message=f"❌ Error: {str(e)}")
        return False

if __name__ == '__main__':
    success = install_pytorch_cuda()
    sys.exit(0 if success else 1)
