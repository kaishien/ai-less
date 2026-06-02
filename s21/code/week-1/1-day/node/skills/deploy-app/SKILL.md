---
name: deploy-app
description: Деплой приложения в staging или production. Используй когда пользователь упоминает deployment, releases или environments.
compatibility: Requires bash, docker, и доступ к container registry
---

# Deploy App Skill

Используй этот навык для деплоя приложения в различные окружения.

## Когда использовать

- Пользователь хочет задеплоить приложение
- Упоминается "deployment", "release", "production", "staging"
- Нужно опубликовать новую версию приложения

## Инструкции

### Перед деплоем

1. **Валидация:**
   Запусти скрипт валидации: `python scripts/validate.py`
   
   Скрипт проверит:
   - ✅ Все тесты проходят
   - ✅ Код скомпилирован
   - ✅ Environment variables настроены
   - ✅ Docker образ собирается

2. **Выбор окружения:**
   Спроси пользователя куда деплоить:
   - `staging` - тестовое окружение
   - `production` - продакшн

### Деплой

Запусти скрипт деплоя: `bash scripts/deploy.sh <environment>`

Где `<environment>` это `staging` или `production`.

### Скрипт выполняет:

1. Сборка Docker образа
2. Загрузка в container registry
3. Обновление deployment в Kubernetes
4. Проверка health checks
5. Rollback при ошибках

### После деплоя

1. **Проверь статус:**
   ```bash
   kubectl get pods -n <namespace>
   kubectl logs -f deployment/<app-name>
   ```

2. **Smoke тесты:**
   ```bash
   curl https://<environment>.example.com/health
   ```

3. **Мониторинг:**
   Проверь метрики и логи в течение 5-10 минут

## Rollback

Если что-то пошло не так:

```bash
bash scripts/rollback.sh <environment>
```

Скрипт откатит к предыдущей версии.

## Чеклист

Перед деплоем убедись:
- [ ] Все тесты проходят (`npm test`)
- [ ] Code review завершен
- [ ] Changelog обновлен
- [ ] Environment variables настроены
- [ ] База данных migration применена (если нужно)

После деплоя:
- [ ] Health check проходит
- [ ] Smoke тесты успешны
- [ ] Логи не показывают ошибок
- [ ] Метрики в норме

## Безопасность

⚠️ **ВАЖНО:**
- Всегда деплой в `staging` перед `production`
- Production деплой требует подтверждения пользователя
- Сохраняй backup перед деплоем
- Имей план rollback
