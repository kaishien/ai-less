#!/usr/bin/env python3
"""
Пример использования генератора изображений.
Демонстрирует создание и сохранение изображения с помощью GigaChat API.
"""

from mcp.client import Client
import asyncio

async def main():
    # Инициализируем клиент MCP для работы с сервисом
    client = Client("image-generator")
    
    try:
        # Генерируем изображение по текстовому описанию
        print("Генерация изображения...")
        file_id = await client.generate_image(
            prompt="Красивый закат на море в стиле импрессионизма"
        )
        
        if file_id.startswith("Error"):
            print(f"Ошибка при генерации: {file_id}")
            return
            
        print(f"Изображение сгенерировано, ID: {file_id}")
        
        # Сохраняем изображение на диск
        print("Сохранение изображения...")
        result = await client.download_image(
            file_id=file_id,
            output_path="C:/Images/generated/sunset.png"
        )
        print(result)
        
    except Exception as e:
        print(f"Произошла ошибка: {str(e)}")

if __name__ == "__main__":
    # Запускаем асинхронную функцию main
    asyncio.run(main())
