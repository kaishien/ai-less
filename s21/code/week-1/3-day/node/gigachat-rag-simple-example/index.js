import GigaChat from 'gigachat';
import { Agent } from 'node:https';

// загружаем переменные окружения из .env файла
process.loadEnvFile('.env');

// создаем https агент для запросов к GigaChat
const httpsAgent = new Agent({
    rejectUnauthorized: false,
});

// функция для запроса к GigaChat
async function main() {
    const client = new GigaChat({
        httpsAgent,
        credentials: process.env.GIGACHAT_CREDENTIALS,
    });
    const response = await client.embeddings(['Привет, это Эльбрус Буткемп!']);
    console.log(response.data);
}

main();