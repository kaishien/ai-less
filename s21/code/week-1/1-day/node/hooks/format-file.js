#!/usr/bin/env node
// Hook: afterFileEdit (кросс-платформенный Node.js)
// Автоматически форматирует файл после редактирования

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Читаем JSON input из stdin
let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);
    const filePath = input.file_path || '';
    
    if (!filePath) {
      console.log('{}');
      process.exit(0);
      return;
    }
    
    // Логируем
    const logPath = path.join(require('os').tmpdir(), 'cursor-edits.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] File edited: ${filePath}\n`);
    
    // Определяем расширение
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      // Форматируем в зависимости от типа файла
      switch (ext) {
        case '.js':
        case '.jsx':
        case '.ts':
        case '.tsx':
        case '.json':
        case '.css':
        case '.md':
          // Prettier для JS/TS/JSON/CSS/MD
          try {
            execSync(`prettier --write "${filePath}"`, { 
              stdio: 'ignore',
              timeout: 10000 
            });
            fs.appendFileSync(logPath, `[${timestamp}] Formatted with prettier: ${filePath}\n`);
          } catch (e) {
            // Prettier не установлен или ошибка - пропускаем
          }
          break;
          
        case '.py':
          // Black для Python
          try {
            execSync(`black "${filePath}"`, { 
              stdio: 'ignore',
              timeout: 10000 
            });
            fs.appendFileSync(logPath, `[${timestamp}] Formatted with black: ${filePath}\n`);
          } catch (e) {
            // Black не установлен или ошибка - пропускаем
          }
          break;
          
        case '.go':
          // gofmt для Go
          try {
            execSync(`gofmt -w "${filePath}"`, { 
              stdio: 'ignore',
              timeout: 10000 
            });
            fs.appendFileSync(logPath, `[${timestamp}] Formatted with gofmt: ${filePath}\n`);
          } catch (e) {
            // gofmt не установлен или ошибка - пропускаем
          }
          break;
      }
    } catch (formatError) {
      // Ошибка форматирования - логируем но не падаем
      fs.appendFileSync(logPath, `[${timestamp}] Format error: ${formatError.message}\n`);
    }
    
    // Возвращаем пустой JSON (форматтер не требует output)
    console.log('{}');
    process.exit(0);
    
  } catch (error) {
    // При ошибке парсинга - возвращаем пустой объект
    console.log('{}');
    process.exit(0);
  }
});
