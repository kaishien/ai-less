# Команда: /component

## Описание
Создай React компонент с полной реализацией.

## Prompt
Создай React компонент:

**Компонент:** [опиши что должен делать компонент]

1. **TypeScript интерфейс:**
   ```typescript
   interface ComponentNameProps {
     // Обязательные props
     requiredProp: string;
     // Опциональные props со значением по умолчанию
     optionalProp?: number;
     // Callback функции
     onAction?: (value: string) => void;
   }
   ```

2. **Структура компонента:**
   ```typescript
   export function ComponentName({
     requiredProp,
     optionalProp = defaultValue,
     onAction,
   }: ComponentNameProps) {
     // 1. Хуки (useState, useEffect, etc.)
     // 2. Вычисления и мemoization
     // 3. Event handlers
     // 4. Render
   }
   ```

3. **State management:**
   - Используй useState для локального состояния
   - useReducer для сложной логики
   - Context для глобального состояния

4. **Side effects:**
   - useEffect с правильными dependencies
   - Cleanup функции для subscriptions
   - Обработка unmount

5. **Performance:**
   - useMemo для дорогих вычислений
   - useCallback для функций в dependencies
   - React.memo если компонент часто ре-рендерится

6. **Accessibility:**
   - Семантичный HTML
   - ARIA атрибуты где нужно
   - Keyboard navigation
   - Screen reader support

7. **Стилизация:**
   - CSS Modules / Styled Components
   - Responsive design
   - Темизация (если нужно)

8. **Обработка ошибок:**
   - Error boundaries для критичных компонентов
   - Fallback UI для loading/error состояний

**Результат:**
- Полностью типизированный компонент
- Оптимизированный для производительности
- С обработкой всех edge cases
- Пример использования
