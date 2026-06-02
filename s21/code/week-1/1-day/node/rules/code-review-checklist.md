---
alwaysApply: false
---

# Code Review Checklist

Чек-лист для проверки кода перед коммитом и ревью. Agent использует этот чек-лист когда делает code review.

## Общие проверки

### ✅ Читаемость
- [ ] Понятные имена переменных и функций
- [ ] Функции выполняют одну задачу (Single Responsibility)
- [ ] Максимальная длина функции до 50 строк
- [ ] Нет избыточных комментариев (код сам себя объясняет)
- [ ] Есть комментарии для сложной бизнес-логики
- [ ] Отсутствуют "магические числа" (используются константы)

### ✅ Производительность
- [ ] Нет лишних циклов и итераций
- [ ] Используются правильные структуры данных (Map vs Object, Set vs Array)
- [ ] Избегается n+1 проблема в запросах к БД
- [ ] Добавлена пагинация для больших списков
- [ ] Используется мemoization где необходимо
- [ ] Асинхронные операции не блокируют UI

### ✅ Безопасность
- [ ] Нет SQL injection (используются prepared statements)
- [ ] Нет XSS уязвимостей (санитизация входных данных)
- [ ] Секреты в environment variables, не в коде
- [ ] Валидация всех пользовательских данных
- [ ] Защита от CSRF для изменяющих операций
- [ ] Rate limiting для API endpoints
- [ ] Правильная обработка авторизации

### ✅ Обработка ошибок
- [ ] Try-catch для асинхронных операций
- [ ] Понятные сообщения об ошибках для пользователя
- [ ] Логирование ошибок
- [ ] Graceful degradation (приложение не ломается полностью)
- [ ] Валидация данных с понятными ошибками
- [ ] Обработка edge cases

### ✅ Тестирование
- [ ] Добавлены unit тесты для новой логики
- [ ] Покрытие критических путей тестами
- [ ] Тесты проходят локально
- [ ] Проверены граничные случаи
- [ ] Моки используются правильно

### ✅ TypeScript / Типизация
- [ ] Нет использования `any`
- [ ] Все функции типизированы
- [ ] Интерфейсы для объектов
- [ ] Используются utility types (Pick, Omit, Partial)
- [ ] Type guards для runtime проверок

### ✅ React специфика
- [ ] Нет лишних ре-рендеров
- [ ] Правильные dependency arrays в useEffect
- [ ] Ключи у списков (key prop)
- [ ] Мemoization для дорогих операций
- [ ] Нет мутаций state напрямую
- [ ] Controlled components для форм

### ✅ База данных
- [ ] Индексы для часто используемых полей
- [ ] Оптимизированные запросы (EXPLAIN ANALYZE)
- [ ] Транзакции для атомарных операций
- [ ] Миграции версионированы
- [ ] Нет N+1 запросов

### ✅ API / Backend
- [ ] REST endpoints соответствуют стандартам
- [ ] Правильные HTTP коды ответов
- [ ] Пагинация для больших списков
- [ ] Rate limiting
- [ ] API документация обновлена
- [ ] Версионирование API

### ✅ Git
- [ ] Осмысленное сообщение коммита
- [ ] Один коммит = одна логическая единица изменений
- [ ] Нет закоммиченных секретов
- [ ] Нет временных файлов
- [ ] .gitignore настроен правильно

### ✅ Код стайл
- [ ] Линтер проходит без ошибок
- [ ] Код отформатирован (prettier/eslint)
- [ ] Соблюдается стиль проекта
- [ ] Нет console.log в production коде
- [ ] Нет закомментированного кода

## Примеры проверок

### Пример 1: Проверка функции
```typescript
// ❌ ПЛОХО
function calc(a, b, t) {
  if (t == 1) {
    return a + b;
  } else if (t == 2) {
    return a - b;
  } else if (t == 3) {
    return a * b;
  } else {
    return a / b;
  }
}

// ✅ ХОРОШО
type Operation = 'add' | 'subtract' | 'multiply' | 'divide';

function calculate(firstNumber: number, secondNumber: number, operation: Operation): number {
  const operations: Record<Operation, (a: number, b: number) => number> = {
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
    divide: (a, b) => {
      if (b === 0) throw new Error('Division by zero');
      return a / b;
    },
  };

  return operations[operation](firstNumber, secondNumber);
}
```

### Пример 2: Проверка компонента
```typescript
// ❌ ПЛОХО
function UserList({ users }) {
  const [filter, setFilter] = useState('');
  
  const filteredUsers = users.filter(u => u.name.includes(filter));
  
  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {filteredUsers.map((user, index) => <div key={index}>{user.name}</div>)}
    </div>
  );
}

// ✅ ХОРОШО
interface User {
  id: number;
  name: string;
}

interface UserListProps {
  users: User[];
}

export function UserList({ users }: UserListProps) {
  const [filter, setFilter] = useState('');
  
  // Мemoization для предотвращения пересчета на каждом рендере
  const filteredUsers = useMemo(() => {
    if (!filter) return users;
    return users.filter(user => 
      user.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [users, filter]);
  
  return (
    <div>
      <input 
        type="text"
        value={filter} 
        onChange={e => setFilter(e.target.value)}
        placeholder="Поиск пользователей"
        aria-label="Фильтр пользователей"
      />
      {filteredUsers.length === 0 ? (
        <p>Пользователи не найдены</p>
      ) : (
        <ul>
          {filteredUsers.map(user => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Быстрая проверка перед коммитом
```bash
# 1. Запустить линтер
npm run lint

# 2. Запустить тесты
npm test

# 3. Проверить типы
npm run type-check

# 4. Проверить форматирование
npm run format:check

# 5. Проверить на TODO/FIXME
git diff --cached | grep -i "TODO\|FIXME"
```
