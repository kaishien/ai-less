#!/usr/bin/env python3
"""Hook: beforeShellExecution
Контролирует выполнение shell команд — блокирует опасные, запрашивает подтверждение для изменяющих.
"""

import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path

LOG_PATH = Path(tempfile.gettempdir()) / "cursor-shell.log"

DANGEROUS_PATTERNS = [
    "rm -rf /",
    "dd if=",
    "mkfs",
    ":(){:|:&};:",  # fork bomb
    "chmod -R 777 /",
]

CONFIRM_PATTERNS = [
    "pip install",
    "pip uninstall",
    "uv add",
    "uv remove",
    "git push",
    "docker run",
    "apt-get install",
    "brew install",
    "alembic upgrade",
    "alembic downgrade",
]


def log(message: str) -> None:
    timestamp = datetime.now().isoformat()
    with LOG_PATH.open("a") as f:
        f.write(f"[{timestamp}] {message}\n")


def main() -> None:
    try:
        input_data = json.loads(sys.stdin.read())
        command: str = input_data.get("command", "")

        log(f"Command: {command}")

        for pattern in DANGEROUS_PATTERNS:
            if pattern in command:
                response = {
                    "permission": "deny",
                    "user_message": f"⛔ Команда заблокирована: потенциально опасная операция ({pattern!r})",
                    "agent_message": f"Команда содержит опасный паттерн {pattern!r} и была заблокирована.",
                }
                print(json.dumps(response))
                return

        for pattern in CONFIRM_PATTERNS:
            if pattern in command:
                response = {
                    "permission": "ask",
                    "user_message": f"⚠️ Команда требует подтверждения: {command}",
                    "agent_message": f"Команда '{command}' изменяет систему или зависимости. Требуется подтверждение.",
                }
                print(json.dumps(response))
                return

        print(json.dumps({"permission": "allow"}))

    except Exception as e:
        log(f"Hook error: {e}")
        # fail-open: при ошибке разрешаем
        print(json.dumps({"permission": "allow"}))


if __name__ == "__main__":
    main()
