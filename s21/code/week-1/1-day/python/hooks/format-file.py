#!/usr/bin/env python3
"""Hook: afterFileEdit
Автоматически форматирует файл после редактирования.
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

LOG_PATH = Path(tempfile.gettempdir()) / "cursor-edits.log"


def log(message: str) -> None:
    timestamp = datetime.now().isoformat()
    with LOG_PATH.open("a") as f:
        f.write(f"[{timestamp}] {message}\n")


def run_formatter(command: str, file_path: str) -> None:
    try:
        subprocess.run(
            command.split() + [file_path],
            capture_output=True,
            timeout=10,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass


def main() -> None:
    try:
        input_data = json.loads(sys.stdin.read())
        file_path: str = input_data.get("file_path", "")

        if not file_path:
            print("{}")
            return

        log(f"File edited: {file_path}")
        ext = Path(file_path).suffix.lower()

        if ext == ".py":
            run_formatter("black", file_path)
            log(f"Formatted with black: {file_path}")
        elif ext in (".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".md"):
            run_formatter("prettier --write", file_path)
            log(f"Formatted with prettier: {file_path}")
        elif ext == ".go":
            run_formatter("gofmt -w", file_path)
            log(f"Formatted with gofmt: {file_path}")

    except Exception as e:
        log(f"Hook error: {e}")

    print("{}")


if __name__ == "__main__":
    main()
