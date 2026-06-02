#!/usr/bin/env python3
"""
Validation script for pre-deployment checks.
Проверяет готовность приложения к деплою.
"""

import subprocess
import sys
import os
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

def print_step(message):
    print(f"\n🔍 {message}...")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")

def run_command(command, description):
    """Run shell command and return success status."""
    print_step(description)
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            print_success(f"{description} - OK")
            return True
        else:
            print_error(f"{description} - FAILED")
            print(result.stderr)
            return False
    except subprocess.TimeoutExpired:
        print_error(f"{description} - TIMEOUT")
        return False
    except Exception as e:
        print_error(f"{description} - ERROR: {str(e)}")
        return False

def check_tests():
    """Проверка что все тесты проходят."""
    return run_command("npm test", "Running tests")

def check_build():
    """Проверка что код компилируется."""
    return run_command("npm run build", "Building application")

def check_linter():
    """Проверка линтера."""
    return run_command("npm run lint", "Running linter")

def check_env_vars():
    """Проверка обязательных environment variables."""
    print_step("Checking environment variables")
    
    required_vars = [
        'DATABASE_URL',
        'API_KEY',
        'JWT_SECRET'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print_error(f"Missing environment variables: {', '.join(missing_vars)}")
        return False
    else:
        print_success("All required environment variables are set")
        return True

def check_docker():
    """Проверка что Docker образ собирается."""
    return run_command(
        "docker build -t test-build . --quiet",
        "Building Docker image"
    )

def check_dependencies():
    """Проверка на устаревшие зависимости."""
    print_step("Checking for outdated dependencies")
    
    result = subprocess.run(
        "npm outdated",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if result.stdout:
        print_warning("Some dependencies are outdated")
        print(result.stdout)
    else:
        print_success("All dependencies are up to date")
    
    return True  # Not blocking

def main():
    """Run all validation checks."""
    print("\n" + "="*50)
    print("🚀 Pre-Deployment Validation")
    print("="*50)
    
    checks = [
        ("Tests", check_tests),
        ("Linter", check_linter),
        ("Build", check_build),
        ("Environment Variables", check_env_vars),
        ("Docker Build", check_docker),
        ("Dependencies", check_dependencies),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            success = check_func()
            results.append((name, success))
        except Exception as e:
            print_error(f"{name} check failed with exception: {str(e)}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*50)
    print("📊 Validation Summary")
    print("="*50)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for name, success in results:
        status = f"{Colors.GREEN}✅ PASSED{Colors.RESET}" if success else f"{Colors.RED}❌ FAILED{Colors.RESET}"
        print(f"{name:.<40} {status}")
    
    print("\n" + "="*50)
    print(f"Results: {passed}/{total} checks passed")
    print("="*50)
    
    if passed == total:
        print_success("All validation checks passed! Ready to deploy.")
        sys.exit(0)
    else:
        print_error("Some validation checks failed. Fix issues before deploying.")
        sys.exit(1)

if __name__ == "__main__":
    main()
