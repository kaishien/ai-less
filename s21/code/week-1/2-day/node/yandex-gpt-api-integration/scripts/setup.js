#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

console.log('🚀 Настройка YandexGPT Node.js сервера...\n');

// Проверка версии Node.js
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion < 18) {
    console.error('❌ Ошибка: Требуется Node.js 18+.');
    console.error(`   Текущая версия: ${nodeVersion}`);
    process.exit(1);
}

console.log(`✅ Версия Node.js: ${nodeVersion}`);

// Проверка наличия файла .env
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (!fs.existsSync(envPath)) {
    console.log('\n📝 Создание файла .env из шаблона...');

    const envExample = `# ===================================
# Конфигурация сервера
# ===================================
PORT=3000
NODE_ENV=development

# ===================================
# Конфигурация Yandex Cloud
# ===================================
YANDEX_API_KEY=your_api_key_here
YANDEX_CATALOGUE_ID=your_catalogue_id_here
YANDEX_MODEL_URL=https://llm.api.cloud.yandex.net/foundationModels/v1/completion
YANDEX_MODEL=yandexgpt

# ===================================
# Параметры генерации
# ===================================
TEMPERATURE=0.3
MAX_TOKENS=1024

# ===================================
# Настройки приложения
# ===================================
CORS_ENABLED=false
LOG_LEVEL=info`;

    fs.writeFileSync(envPath, envExample);
    console.log('✅ Файл .env создан. Пожалуйста, обновите его своими учётными данными.');
} else {
    console.log('✅ Файл .env уже существует');
}

// Установка зависимостей, если node_modules не существует
const nodeModulesPath = path.join(rootDir, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
    console.log('\n📦 Установка зависимостей...');
    try {
        const { stdout, stderr } = await execAsync('npm install', { cwd: rootDir });
        if (stderr && !stderr.includes('npm WARN')) {
            console.error('Предупреждение во время установки:', stderr);
        }
        console.log('✅ Зависимости успешно установлены');
    } catch (error) {
        console.error('❌ Не удалось установить зависимости:', error.message);
        process.exit(1);
    }
} else {
    console.log('✅ Зависимости уже установлены');
}

console.log('\n' + '='.repeat(50));
console.log('✨ Настройка успешно завершена!');
console.log('='.repeat(50));
console.log(`
Следующие шаги:
1. Обновите файл .env вашими учётными данными Yandex Cloud:
   - YANDEX_API_KEY
   - YANDEX_CATALOGUE_ID

2. Запустите сервер:
   npm start

3. Перейдите к API:
   http://localhost:3000

Для получения дополнительной информации смотрите README.md
`);
