#!/usr/bin/env node
// Hook: beforeShellExecution (кросс-платформенный Node.js)
// Контролирует выполнение shell команд

const fs = require('fs');
const path = require('path');

// Читаем JSON input из stdin
let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);
    const command = input.command || '';
    
    // Логируем
    const logPath = path.join(require('os').tmpdir(), 'cursor-shell.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] Command: ${command}\n`);
    
    // Опасные паттерны (универсальные для всех ОС)
    const dangerousPatterns = [
      'rm -rf /',
      'Remove-Item -Recurse -Force C:\\',
      'Format-Volume',
      'dd if=',
      'mkfs',
      ':(){:|:&};:' // fork bomb
    ];
    
    // Проверка на опасные команды
    for (const pattern of dangerousPatterns) {
      if (command.includes(pattern)) {
        const response = {
          permission: 'deny',
          user_message: '⛔ Команда заблокирована: потенциально опасная операция',
          agent_message: `Команда '${command}' содержит опасный паттерн '${pattern}' и была заблокирована.`
        };
        console.log(JSON.stringify(response));
        process.exit(0);
      }
    }
    
    // Команды требующие подтверждения
    const confirmPatterns = [
      'npm install',
      'pip install',
      'apt-get install',
      'brew install',
      'git push',
      'docker run'
    ];
    
    for (const pattern of confirmPatterns) {
      if (command.includes(pattern)) {
        const response = {
          permission: 'ask',
          user_message: `⚠️ Команда требует подтверждения: ${command}`,
          agent_message: `Команда '${command}' изменяет систему или зависимости. Требуется подтверждение.`
        };
        console.log(JSON.stringify(response));
        process.exit(0);
      }
    }
    
    // Разрешаем безопасные команды
    console.log(JSON.stringify({ permission: 'allow' }));
    process.exit(0);
    
  } catch (error) {
    // При ошибке парсинга - разрешаем (fail-open)
    fs.appendFileSync(
      path.join(require('os').tmpdir(), 'cursor-hooks-error.log'),
      `[${new Date().toISOString()}] Error: ${error.message}\n`
    );
    console.log(JSON.stringify({ permission: 'allow' }));
    process.exit(0);
  }
});
