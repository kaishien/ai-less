// Импорт необходимых модулей
import { GigaChat, detectImage } from 'gigachat';
import * as dotenv from 'dotenv';
import { Agent } from 'node:https';
import * as fs from 'node:fs';
import path from 'node:path';

// Настройка HTTPS агента для работы с самоподписанными сертификатами
const httpsAgent = new Agent({
    rejectUnauthorized: false,
});

// Загрузка переменных окружения из .env файла
dotenv.config();

async function main() {
    try {
        // Инициализация клиента GigaChat
        const client = new GigaChat({
            timeout: 600,
            model: 'GigaChat',
            credentials: process.env.GIGACHAT_API_KEY,
            httpsAgent,
        });

        // Проверка наличия API ключа
        if (!process.env.GIGACHAT_API_KEY) {
            throw new Error('GIGACHAT_API_KEY не найден в переменных окружения');
        }

        // Проверка и создание папки для изображений
        const imgDir = path.resolve('./img');
        if (!fs.existsSync(imgDir)) {
            console.log('Создаем папку для изображений...');
            fs.mkdirSync(imgDir, { recursive: true });
            console.log('Папка img создана успешно');
        }

        console.log('Генерируем изображение...');

        // Генерация изображения
        const resp = await client.chat({
            messages: [
                {
                    role: 'system',
                    content: 'Ты художник, который умеет генерировать изображения по текстовому описанию. Ты можешь генерировать изображения в стиле аниме, фотореалистичном стиле, в стиле векторных изображений и в стиле пиксельного искусства.',
                },
                {
                    role: 'user',
                    content: 'Сгенерируй изображение котика',
                },
            ],
            function_call: 'auto',
            temperature: 0.7,
        });

        // Проверка ответа от API
        if (!resp.choices || resp.choices.length === 0) {
            throw new Error('Получен пустой ответ от GigaChat API');
        }

        // Обнаружение изображения в ответе
        const detectedImage = detectImage(resp.choices[0]?.message.content ?? '');

        if (detectedImage && detectedImage.uuid) {
            console.log('Изображение обнаружено, загружаем...');

            // Получение изображения по UUID
            const image = await client.getImage(detectedImage.uuid);

            // Сохранение изображения в файл
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const imagePath = path.join(imgDir, `image_${timestamp}.jpg`);
            fs.writeFile(imagePath, image.content, 'binary', function (err) {
                if (err) {
                    console.error('Ошибка при сохранении изображения:', err.message);
                    return;
                }
                console.log(`[OK] Изображение успешно сохранено: ${imagePath}`);
                console.log(`[INFO] Описание изображения: "${detectedImage.postfix}"`);
            });
        } else {
            console.log('[INFO] Ответ от API:', resp.choices[0]?.message.content);
            console.log('[ERROR] Изображение не было сгенерировано');
        }
    } catch (error) {
        console.error('[ERROR] Ошибка при выполнении программы:', error.message);
        process.exit(1);
    }
}

// Запуск основной функции
main();