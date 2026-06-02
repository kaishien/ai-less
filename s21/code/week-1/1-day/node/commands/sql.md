# Команда: /sql

## Описание
Создай SQL запрос или миграцию с оптимизацией.

## Prompt
Создай SQL решение:

**Задача:** [опиши что нужно сделать]

1. **Для SELECT запросов:**
   ```sql
   -- Используй JOIN вместо подзапросов где возможно
   -- SELECT только нужные поля
   -- WHERE для фильтрации до JOIN
   -- LIMIT для пагинации
   
   SELECT 
     u.id,
     u.name,
     COUNT(o.id) as order_count
   FROM users u
   LEFT JOIN orders o ON u.id = o.user_id
   WHERE u.active = true
   GROUP BY u.id
   ORDER BY order_count DESC
   LIMIT 10 OFFSET 0;
   ```

2. **Для миграций (CREATE TABLE):**
   ```sql
   CREATE TABLE table_name (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     email VARCHAR(255) UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   -- Индексы для часто используемых полей
   CREATE INDEX idx_table_name_email ON table_name(email);
   CREATE INDEX idx_table_name_created_at ON table_name(created_at);
   
   -- Foreign keys с ON DELETE действиями
   ALTER TABLE orders 
     ADD CONSTRAINT fk_user_id 
     FOREIGN KEY (user_id) 
     REFERENCES users(id) 
     ON DELETE CASCADE;
   ```

3. **Триггеры для автоматизации:**
   ```sql
   -- Автообновление updated_at
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = CURRENT_TIMESTAMP;
     RETURN NEW;
   END;
   $$ language 'plpgsql';
   
   CREATE TRIGGER update_table_updated_at 
     BEFORE UPDATE ON table_name
     FOR EACH ROW 
     EXECUTE FUNCTION update_updated_at_column();
   ```

4. **Оптимизация:**
   - Используй EXPLAIN ANALYZE для проверки плана запроса
   - Добавь индексы для JOIN и WHERE условий
   - Избегай SELECT *
   - Используй пагинацию для больших выборок
   - Batch операции вместо множества одиночных

5. **Транзакции для атомарности:**
   ```sql
   BEGIN;
   
   UPDATE accounts SET balance = balance - 100 WHERE id = 1;
   UPDATE accounts SET balance = balance + 100 WHERE id = 2;
   
   COMMIT;
   -- или ROLLBACK при ошибке
   ```

**Результат:**
- Оптимизированный SQL запрос
- Индексы для производительности
- План выполнения (EXPLAIN)
- Примеры использования из кода
