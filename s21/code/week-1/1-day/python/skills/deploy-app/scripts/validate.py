#!/usr/bin/env python3
"""
Validation script for pre-deployment checks.
Проверяет готовность Python приложения к деплою.
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


def print_step(message: str) -> None:
    print(f"\n🔍 {message}...")


def print_success(message: str) -> None:
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")


def print_error(message: str) -> None:
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")


def print_warning(message: str) -> None:
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.RESET}")


def run_command(command: str, description: str) -> bool:
    """Run shell command and return success status."""
    print_step(description)
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            print_success(f"{description} - OK")
            return True
        else:
            print_error(f"{description} - FAILED")
            if result.stderr:
                print(result.stderr[:1000])
            return False
    except subprocess.TimeoutExpired:
        print_error(f"{description} - TIMEOUT")
        return False
    except Exception as e:
        print_error(f"{description} - ERROR: {e}")
        return False


def check_tests() -> bool:
    """Проверка что все тесты проходят."""
    return run_command("pytest --tb=short -q", "Running tests")


def check_linter() -> bool:
    """Проверка линтера (ruff)."""
    return run_command("ruff check .", "Running linter (ruff)")


def check_types() -> bool:
    """Проверка типов (mypy)."""
    return run_command("mypy . --ignore-missing-imports", "Type checking (mypy)")


def check_formatting() -> bool:
    """Проверка форматирования (black)."""
    return run_command("black --check .", "Checking formatting (black)")


def check_env_vars() -> bool:
    """Проверка обязательных environment variables."""
    print_step("Checking environment variables")

    required_vars = [
        "DATABASE_URL",
        "SECRET_KEY",
        "API_KEY",
    ]

    missing_vars = [var for var in required_vars if not os.getenv(var)]

    if missing_vars:
        print_error(f"Missing environment variables: {', '.join(missing_vars)}")
        return False

    print_success("All required environment variables are set")
    return True


def check_docker() -> bool:
    """Проверка что Docker образ собирается."""
    return run_command(
        "docker build -t test-build . --quiet",
        "Building Docker image",
    )


def check_dependencies() -> bool:
    """Проверка уязвимостей в зависимостях (pip-audit)."""
    print_step("Checking for dependency vulnerabilities")
    result = subprocess.run(
        "pip-audit --desc",
        shell=True,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 and result.stdout:
        print_warning("Security vulnerabilities found in dependencies")
        print(result.stdout[:500])
    else:
        print_success("No known vulnerabilities found")
    return True  # Not blocking


def main() -> None:
    """Run all validation checks."""
    print("\n" + "=" * 50)
    print("🚀 Pre-Deployment Validation (Python)")
    print("=" * 50)

    checks = [
        ("Tests", check_tests),
        ("Linter", check_linter),
        ("Type Check", check_types),
        ("Formatting", check_formatting),
        ("Environment Variables", check_env_vars),
        ("Docker Build", check_docker),
        ("Dependencies", check_dependencies),
    ]

    results: list[tuple[str, bool]] = []
    for name, check_func in checks:
        try:
            success = check_func()
            results.append((name, success))
        except Exception as e:
            print_error(f"{name} check failed with exception: {e}")
            results.append((name, False))

    print("\n" + "=" * 50)
    print("📊 Validation Summary")
    print("=" * 50)

    passed = sum(1 for _, success in results if success)
    total = len(results)

    for name, success in results:
        status = (
            f"{Colors.GREEN}✅ PASSED{Colors.RESET}"
            if success
            else f"{Colors.RED}❌ FAILED{Colors.RESET}"
        )
        print(f"{name + '.'*(40 - len(name))} {status}")

    print("\n" + "=" * 50)
    print(f"Results: {passed}/{total} checks passed")
    print("=" * 50)

    if passed == total:
        print_success("All validation checks passed! Ready to deploy.")
        sys.exit(0)
    else:
        print_error("Some validation checks failed. Fix issues before deploying.")
        sys.exit(1)


if __name__ == "__main__":
    main()
