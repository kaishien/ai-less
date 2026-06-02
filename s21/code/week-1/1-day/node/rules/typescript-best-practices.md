---
globs: ['*.ts', '*.tsx']
alwaysApply: false
---

# TypeScript Best Practices

Правила и рекомендации для написания качественного TypeScript кода.

## Правила

### 1. Типизация
```typescript
// ✅ ХОРОШО: Явная типизация параметров и возвращаемых значений
function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}

// ❌ ПЛОХО: Отсутствие типов
function calculateTotal(price, quantity) {
  return price * quantity;
}

// ✅ ХОРОШО: Использование interface для объектов
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// ✅ ХОРОШО: Использование type для union/intersection
type Status = 'pending' | 'active' | 'completed';
type UserWithStatus = User & { status: Status };
```

### 2. Избегай any
```typescript
// ❌ ПЛОХО: Использование any
function processData(data: any): any {
  return data.value;
}

// ✅ ХОРОШО: Использование generic или unknown
function processData<T extends { value: unknown }>(data: T): T['value'] {
  return data.value;
}

// ✅ ХОРОШО: unknown с type guard
function processData(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new Error('Invalid data format');
}
```

### 3. Null Safety
```typescript
// ✅ ХОРОШО: Optional chaining
const userName = user?.profile?.name;

// ✅ ХОРОШО: Nullish coalescing
const displayName = userName ?? 'Anonymous';

// ✅ ХОРОШО: Type guard
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

if (isUser(data)) {
  console.log(data.name); // TypeScript знает, что это User
}
```

### 4. Immutability
```typescript
// ✅ ХОРОШО: readonly для неизменяемых данных
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

// ✅ ХОРОШО: ReadonlyArray
function processItems(items: ReadonlyArray<string>): string[] {
  return items.map(item => item.toUpperCase());
}

// ✅ ХОРОШО: as const для литералов
const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  CONTACT: '/contact',
} as const;

type Route = typeof ROUTES[keyof typeof ROUTES];
```

### 5. Utility Types
```typescript
// ✅ ХОРОШО: Использование встроенных utility types
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

// Partial - все поля опциональны
type UserUpdate = Partial<User>;

// Pick - выбор определенных полей
type UserPublic = Pick<User, 'id' | 'name'>;

// Omit - исключение полей
type UserWithoutPassword = Omit<User, 'password'>;

// Required - все поля обязательны
type RequiredUser = Required<Partial<User>>;

// Record - объект с определенными ключами и типами
type UserRoles = Record<number, 'admin' | 'user' | 'guest'>;
```

### 6. Generic Functions
```typescript
// ✅ ХОРОШО: Generic для переиспользуемых функций
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// ✅ ХОРОШО: Constrained generics
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// ✅ ХОРОШО: Default generic types
function createArray<T = string>(length: number, value: T): T[] {
  return Array(length).fill(value);
}
```

### 7. Async/Await типизация
```typescript
// ✅ ХОРОШО: Явная типизация Promise
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// ✅ ХОРОШО: Обработка ошибок с типами
async function safelyFetchUser(id: number): Promise<User | null> {
  try {
    return await fetchUser(id);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Fetch error:', error.message);
    }
    return null;
  }
}
```

### 8. Enum vs Union Types
```typescript
// ✅ ПРЕДПОЧТИТЕЛЬНО: Union types (легче для tree-shaking)
type UserRole = 'admin' | 'user' | 'guest';

const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const;

// ⚠️ ДОПУСТИМО: Enum (когда нужны numeric значения)
enum HttpStatus {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
}
```

## Конфигурация tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

## Применение правил
1. Всегда используй строгую типизацию (strict mode)
2. Избегай any, используй unknown или generic
3. Предпочитай interface для объектов, type для unions
4. Используй readonly где возможно
5. Применяй utility types вместо дублирования кода
6. Типизируй Promise и async функции
7. Используй type guards для runtime проверок
