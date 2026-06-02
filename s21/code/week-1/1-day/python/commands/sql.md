# Команда: /sql

## Описание
Создай SQL запрос или миграцию с оптимизацией (с примерами использования в Python).

## Prompt
Создай SQL решение:

**Задача:** [опиши что нужно сделать]

1. **Для SELECT запросов:**
   ```sql
   SELECT
     u.id,
     u.name,
     COUNT(o.id) AS order_count
   FROM users u
   LEFT JOIN orders o ON u.id = o.user_id
   WHERE u.active = true
   GROUP BY u.id
   ORDER BY order_count DESC
   LIMIT 10 OFFSET 0;
   ```

2. **Для миграций Alembic:**
   ```python
   # alembic/versions/XXX_create_table.py
   def upgrade() -> None:
       op.create_table(
           "table_name",
           sa.Column("id", sa.Integer, primary_key=True),
           sa.Column("name", sa.String(255), nullable=False),
           sa.Column("email", sa.String(255), unique=True, nullable=False),
           sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
       )
       op.create_index("idx_table_name_email", "table_name", ["email"])

   def downgrade() -> None:
       op.drop_table("table_name")
   ```

3. **Параметризованный запрос в Python:**
   ```python
   # psycopg2
   cursor.execute(
       "SELECT * FROM users WHERE email = %s AND active = %s",
       (email, True),
   )

   # SQLAlchemy
   result = await session.execute(
       select(User).where(User.email == email, User.active == True)
   )
   ```

4. **Транзакции:**
   ```python
   async with session.begin():
       await session.execute(
           update(Account).where(Account.user_id == from_id)
           .values(balance=Account.balance - amount)
       )
       await session.execute(
           update(Account).where(Account.user_id == to_id)
           .values(balance=Account.balance + amount)
       )
   ```

5. **Оптимизация:**
   - EXPLAIN ANALYZE для проверки плана запроса
   - Индексы для JOIN и WHERE условий
   - Избегай SELECT * — указывай нужные поля
   - Batch операции вместо множества одиночных
   - `selectinload` / `joinedload` для избежания N+1

**Результат:**
- Оптимизированный SQL / SQLAlchemy запрос
- Индексы для производительности
- Пример использования в Python коде
