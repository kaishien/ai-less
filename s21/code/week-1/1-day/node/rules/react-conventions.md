---
globs: ['*.tsx', '*.jsx']
alwaysApply: false
---

# React Conventions

Соглашения и лучшие практики для разработки React приложений.

## Правила

### 1. Структура компонентов
```typescript
// ✅ ХОРОШО: Functional component с TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

// ❌ ПЛОХО: Class component (устаревший подход)
class Button extends React.Component {
  render() {
    return <button>{this.props.label}</button>;
  }
}
```

### 2. Hooks правила
```typescript
// ✅ ХОРОШО: Хуки на верхнем уровне
function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (!user) return <NotFound />;
  
  return <div>{user.name}</div>;
}

// ❌ ПЛОХО: Условные хуки
function UserProfile({ userId }: { userId: number }) {
  if (!userId) return null;
  
  // Ошибка: хуки после условия
  const [user, setUser] = useState<User | null>(null);
  
  return <div>{user?.name}</div>;
}
```

### 3. Custom Hooks
```typescript
// ✅ ХОРОШО: Переиспользуемая логика в хуке
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Использование
function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    if (debouncedQuery) {
      searchApi(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

### 4. Мemoization
```typescript
// ✅ ХОРОШО: useMemo для дорогих вычислений
function ProductList({ products }: { products: Product[] }) {
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.price - b.price);
  }, [products]);

  return (
    <div>
      {sortedProducts.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// ✅ ХОРОШО: useCallback для функций в зависимостях
function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = useCallback((text: string) => {
    setTodos(prev => [...prev, { id: Date.now(), text, done: false }]);
  }, []);

  return <TodoForm onSubmit={addTodo} />;
}

// ✅ ХОРОШО: React.memo для предотвращения ре-рендеров
export const ProductCard = React.memo(({ product }: { product: Product }) => {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  );
});
```

### 5. Context правильно
```typescript
// ✅ ХОРОШО: Типизированный Context с Provider
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const user = await loginApi(email, password);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ ХОРОШО: Custom hook для использования Context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 6. Error Boundaries
```typescript
// ✅ ХОРОШО: Error boundary для обработки ошибок
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Something went wrong</h1>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Использование
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### 7. Формы
```typescript
// ✅ ХОРОШО: Controlled components с валидацией
function LoginForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Некорректный email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль минимум 8 символов';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      submitLogin(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={formData.email}
        onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
      />
      {errors.email && <span className="error">{errors.email}</span>}
      
      <input
        type="password"
        value={formData.password}
        onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
      />
      {errors.password && <span className="error">{errors.password}</span>}
      
      <button type="submit">Войти</button>
    </form>
  );
}
```

### 8. Структура проекта
```
src/
├── components/         # Переиспользуемые компоненты
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── Button.module.css
│   └── Input/
├── features/          # Feature-based модули
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api.ts
│   └── products/
├── hooks/            # Общие custom hooks
├── utils/            # Утилитарные функции
├── types/            # TypeScript типы
├── pages/            # Страницы/Routes
└── App.tsx
```

## Применение правил
1. Используй функциональные компоненты с хуками
2. Типизируй все props с TypeScript
3. Применяй мemoization для оптимизации
4. Создавай custom hooks для переиспользуемой логики
5. Используй Context для глобального состояния
6. Добавляй Error Boundaries
7. Валидируй формы перед отправкой
8. Структурируй проект по features
