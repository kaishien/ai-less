import { MockJiraAdfDocument, MockJiraIssuePayload } from './mock-jira.types';

type IssueInput = {
  key: string;
  summary: string;
  description: string;
  target: {
    service: string;
    file: string;
  };
  testSteps: string[];
  labels?: string[];
};

export const MOCK_JIRA_ISSUES: MockJiraIssuePayload[] = [
  issue({
    key: 'TASK-1',
    summary: 'Нужно написать тесты для ChatService',
    description:
      'Покрыть ключевое поведение ChatService автотестами: нормализацию входных сообщений, guard-ветку, проверку token budget и успешный ответ ассистента.',
    target: {
      service: 'ChatService',
      file: 'apps/backend/src/chat/chat.service.ts',
    },
    testSteps: [
      'Создать ChatService с mock LlmClient, TokenBudget, InputGuard и ImagesService.',
      'Передать в chat сообщения с пустым content и неизвестными role, проверить что в LlmClient уходят только user/assistant сообщения с trim.',
      'Настроить InputGuard.inspect на blocked=true и проверить, что chat возвращает guarded response без вызова LlmClient.',
      'Настроить TokenBudget.canSpend на false и проверить, что chat выбрасывает HTTP 429.',
      'Настроить LlmClient.complete на успешный ответ и проверить message, usage и списание total_tokens в TokenBudget.',
    ],
  }),
  issue({
    key: 'TASK-2',
    summary: 'Проверить streamChat для ChatService',
    description: 'Покрыть потоковую выдачу ChatService и обработку delta/done событий.',
    target: {
      service: 'ChatService',
      file: 'apps/backend/src/chat/chat.service.ts',
    },
    testSteps: [
      'Создать async iterable с несколькими delta chunk и финальным usage.',
      'Вызвать streamChat и собрать все события в массив.',
      'Проверить что первым событием приходит assistant.',
      'Проверить что delta события сохраняют порядок чанков.',
      'Проверить что done содержит склеенный assistant content и serialized budget.',
    ],
  }),
  issue({
    key: 'TASK-3',
    summary: 'Покрыть ImagesService тестами',
    description:
      'Добавить автотесты для генерации изображений: обязательный prompt, trim входных данных, guard-блокировка prompt injection и default-параметры клиента.',
    target: {
      service: 'ImagesService',
      file: 'apps/backend/src/images/images.service.ts',
    },
    testSteps: [
      'Создать ImagesService с mock ImageClient и InputGuard.',
      'Передать пустой или whitespace-only prompt и проверить HTTP 400 с сообщением Image prompt is required.',
      'Настроить InputGuard.inspect на blocked=true и reason=prompt_injection, проверить HTTP 400 и отсутствие вызова ImageClient.generate.',
      'Передать prompt с пробелами по краям и проверить что ImageClient.generate получает trim prompt.',
      'Проверить default size=1024x1024 и quality=low, когда параметры не переданы.',
      'Передать явные size и quality, проверить что они прокидываются в ImageClient.generate без перезаписи.',
    ],
  }),
  issue({
    key: 'TASK-4',
    summary: 'Покрыть RagService uploadDocument тестами',
    description:
      'Добавить тесты на загрузку документов в RAG: валидация файла, расширения, пустого содержимого, запись файла и переиндексация.',
    target: {
      service: 'RagService',
      file: 'apps/backend/src/rag/rag.service.ts',
    },
    testSteps: [
      'Создать RagService с mock OpenAiClientProvider и временной директорией RAG_DOCS_DIR.',
      'Передать undefined file и проверить HTTP 400 с сообщением о необходимости файла.',
      'Передать файл с неподдерживаемым расширением, например notes.pdf, и проверить HTTP 400.',
      'Передать .md файл с пустым buffer после trim и проверить HTTP 400 Uploaded file is empty.',
      'Передать валидный .md файл, проверить что файл записан в директорию RAG_DOCS_DIR.',
      'Проверить что результат uploadDocument содержит uploaded.fileName, uploaded.source и обновлённые поля индекса.',
    ],
  }),
  issue({
    key: 'TASK-5',
    summary: 'Покрыть RagService askStream fallback-сценарий',
    description:
      'Добавить тесты для потокового RAG-ответа, когда retrieval не находит релевантных чанков и сервис должен вернуть fallback без вызова генерации ответа.',
    target: {
      service: 'RagService',
      file: 'apps/backend/src/rag/rag.service.ts',
    },
    testSteps: [
      'Создать RagService с mock OpenAiClientProvider, который возвращает embedding для вопроса.',
      'Замокать Qdrant search так, чтобы result был пустым или ниже score threshold.',
      'Вызвать askStream и собрать все события в массив.',
      'Проверить что первым событием приходит retrieval с пустыми chunks и sources.',
      'Проверить что затем приходит delta со строкой Информация не найдена в базе знаний.',
      'Проверить что done содержит fallback answer и пустые chunks.',
    ],
  }),
  issue({
    key: 'TASK-6',
    summary: 'Покрыть ChatStore потоковые события',
    description:
      'Добавить frontend unit-тесты для MobX ChatStore: отправка сообщения, обработка assistant/delta/done событий и очистка состояния после завершения.',
    target: {
      service: 'ChatStore',
      file: 'apps/frontend/src/pages/chat/chat-store.ts',
    },
    testSteps: [
      'Создать ChatStore и замокать global fetch для /api/chat/stream.',
      'Смоделировать NDJSON stream с assistant, двумя delta событиями и done.',
      'Установить input, вызвать sendMessage и дождаться завершения.',
      'Проверить что user message добавлен в историю, input очищен, assistant message содержит склеенный ответ.',
      'Проверить что usage и budget обновлены из done события.',
      'Проверить что isStreaming возвращается в false и error остаётся null.',
    ],
  }),
  issue({
    key: 'TASK-7',
    summary: 'Покрыть ChatStore image events',
    description:
      'Добавить frontend unit-тесты для image_pending и image событий в ChatStore, чтобы UI-состояние генерации изображения не регрессировало.',
    target: {
      service: 'ChatStore',
      file: 'apps/frontend/src/pages/chat/chat-store.ts',
    },
    testSteps: [
      'Создать ChatStore и замокать fetch NDJSON stream с assistant, image_pending, image и done.',
      'Проверить что после image_pending у assistant message выставлены imagePrompt и imageLoading=true.',
      'Проверить что если content пустой, store добавляет текст Генерирую изображение.',
      'Проверить что image событие записывает imageUrl, imagePrompt и снимает imageLoading.',
      'Проверить что image usage сохраняется и не перетирается обычным done usage для image-turn.',
    ],
  }),
  issue({
    key: 'TASK-8',
    summary: 'Покрыть RagStore ask stream',
    description:
      'Добавить frontend unit-тесты для RagStore: вопрос, retrieval событие, delta накопление, done финализация и cancel/error поведение.',
    target: {
      service: 'RagStore',
      file: 'apps/frontend/src/pages/rag/rag-store.ts',
    },
    testSteps: [
      'Создать RagStore и замокать fetch для /api/rag/ask/stream.',
      'Смоделировать stream с retrieval, двумя delta событиями и done.',
      'Установить question, вызвать ask и дождаться завершения.',
      'Проверить askedQuestion, sources, chunks и финальный answer.',
      'Проверить что isAsking становится false после завершения.',
      'Смоделировать HTTP error и проверить что error заполняется fallback-сообщением.',
    ],
  }),
  issue({
    key: 'TASK-9',
    summary: 'Покрыть RagStore index и uploadFile',
    description:
      'Добавить frontend unit-тесты для индексирования и загрузки документов в RagStore, включая busy guard и чтение ошибок backend.',
    target: {
      service: 'RagStore',
      file: 'apps/frontend/src/pages/rag/rag-store.ts',
    },
    testSteps: [
      'Создать RagStore и замокать fetch для /api/rag/index.',
      'Вызвать index и проверить indexResult, uploadResult=null и isIndexing=false.',
      'Проверить что повторный index не стартует, если store находится в busy-состоянии.',
      'Создать File и замокать fetch для /api/rag/upload.',
      'Вызвать uploadFile и проверить uploadResult плюс синхронизацию indexResult.',
      'Смоделировать backend error body с message и проверить что store.error получает это сообщение.',
    ],
  }),
  issue({
    key: 'TASK-10',
    summary: 'Покрыть MCP mock Jira tool',
    description:
      'Добавить тесты для MCP Jira client/tool: чтение задачи из mock backend, формирование Cursor brief и корректный JSON response.',
    target: {
      service: 'Mock Jira MCP tool',
      file: 'apps/mcp/src/tools/jira-tools.ts',
    },
    testSteps: [
      'Замокать global fetch для fetchMockJiraTask и вернуть TASK-1 payload.',
      'Проверить что fetchMockJiraTask ходит в Jira-like /issue/TASK-1 относительно MOCK_JIRA_BASE_URL.',
      'Проверить что createCursorTaskBrief содержит key, title, target file и все testSteps.',
      'Зарегистрировать tool на fake McpServer с registerTool spy.',
      'Вызвать handler tool и проверить что JSON response содержит taskKey, title, target, steps и brief.',
      'Смоделировать HTTP 404 и проверить информативную ошибку Mock Jira request failed.',
    ],
  }),
  issue({
    key: 'TASK-11',
    summary: 'Добавить поиск задач в mock Jira backend',
    description:
      'Расширить mock Jira backend endpoint-ом поиска, чтобы Cursor мог найти подходящую задачу по тексту, сервису или target file перед получением конкретной задачи.',
    target: {
      service: 'MockJiraService',
      file: 'apps/backend/src/mock-jira/mock-jira.service.ts',
    },
    testSteps: [
      'Добавить query parameter q для GET /api/mock-jira/tasks.',
      'Если q не передан, возвращать полный список задач без изменения текущего поведения.',
      'Если q передан, искать case-insensitive по key, title, description, target.service, target.file и testSteps.',
      'Добавить unit-тесты на поиск по ChatService, RagStore и несуществующей строке.',
      'Обновить MCP так, чтобы отдельный tool мог искать задачи по query и возвращать краткий список.',
    ],
  }),
  issue({
    key: 'TASK-12',
    summary: 'Убрать debug logging из RagService search',
    description:
      'В RagService.search сейчас есть console.log со score результатов. Нужно убрать или заменить его контролируемым debug-логированием, чтобы продовый backend не шумел.',
    target: {
      service: 'RagService',
      file: 'apps/backend/src/rag/rag.service.ts',
    },
    testSteps: [
      'Найти console.log внутри RagService search.',
      'Убрать безусловный вывод score из runtime path.',
      'Если нужен debug-режим, завязать его на env flag и не логировать по умолчанию.',
      'Добавить или обновить тест, который проверяет что обычный ask/askStream не вызывает console.log score.',
      'Запустить backend build и релевантные тесты RagService.',
    ],
  }),
  issue({
    key: 'TASK-13',
    summary: 'Покрыть Obsidian MCP path safety',
    description:
      'Добавить тесты для Obsidian MCP/lib слоя, чтобы чтение, запись и поиск заметок не позволяли path traversal и корректно нормализовали .md расширение.',
    target: {
      service: 'Obsidian MCP tools',
      file: 'apps/mcp/src/lib/obsidian.ts',
    },
    testSteps: [
      'Создать временный vault directory для теста.',
      'Проверить что note path без .md резолвится в markdown файл.',
      'Проверить что ../ path traversal отклоняется.',
      'Проверить writeVaultNote в режимах create, overwrite и append.',
      'Проверить searchVaultNotes возвращает path и snippet для найденного текста.',
      'Проверить что obsidian tools возвращают JSON response через jsonText.',
    ],
  }),
];

function issue(input: IssueInput): MockJiraIssuePayload {
  return {
    id: issueId(input.key),
    key: input.key,
    fields: {
      project: {
        key: 'TASK',
      },
      summary: input.summary,
      description: descriptionAdf(input.description, input.testSteps),
      status: {
        name: 'To Do',
      },
      issuetype: {
        name: 'Task',
      },
      labels: ['mock-jira', 'cursor-task', input.target.service.toLowerCase(), ...(input.labels ?? [])],
      customfield_10010: input.testSteps,
      customfield_10011: input.target,
    },
  };
}

function descriptionAdf(description: string, testSteps: string[]): MockJiraAdfDocument {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: description }],
      },
      {
        type: 'heading',
        attrs: {
          level: 3,
        },
        content: [{ type: 'text', text: 'Test steps' }],
      },
      {
        type: 'bulletList',
        content: testSteps.map((step) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: step }],
            },
          ],
        })),
      },
    ],
  };
}

function issueId(key: string): string {
  const [, rawNumber] = key.split('-');

  return String(10_000 + Number(rawNumber));
}
