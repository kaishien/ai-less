import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AIMessage } from '@langchain/core/messages';
import { Annotation, END, START, Send, StateGraph } from '@langchain/langgraph';
import {
  AnalyticsFindingSchema,
  AnalyticsPlanSchema,
  ClassificationSchema,
  ReviewReportSchema,
  ReviewVerdictSchema,
} from './dispatcher.schemas';
import {
  AnalyticsFinding,
  AnalyticsTask,
  DispatcherClassification,
  DispatcherRoute,
  DispatcherTraceStep,
  ReviewReport,
  ReviewVerdict,
} from './dispatcher.types';

export interface DispatcherGraphInput {
  inputId: string;
  inputTitle: string;
  content: string;
}

export interface DispatcherGraphState extends DispatcherGraphInput {
  classification?: DispatcherClassification;
  route?: DispatcherRoute;
  finalAnswer?: string;
  reviewReports: ReviewReport[];
  reviewVerdict?: ReviewVerdict;
  analyticsTasks: AnalyticsTask[];
  currentAnalyticsTask?: AnalyticsTask;
  analyticsFindings: AnalyticsFinding[];
  trace: DispatcherTraceStep[];
}

const DispatcherState = Annotation.Root({
  inputId: Annotation<string>(),
  inputTitle: Annotation<string>(),
  content: Annotation<string>(),
  classification: Annotation<DispatcherClassification | undefined>(),
  route: Annotation<DispatcherRoute | undefined>(),
  finalAnswer: Annotation<string | undefined>(),
  reviewReports: Annotation<ReviewReport[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  reviewVerdict: Annotation<ReviewVerdict | undefined>(),
  analyticsTasks: Annotation<AnalyticsTask[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  currentAnalyticsTask: Annotation<AnalyticsTask | undefined>(),
  analyticsFindings: Annotation<AnalyticsFinding[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  trace: Annotation<DispatcherTraceStep[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type GraphState = typeof DispatcherState.State;
type GraphUpdate = Partial<typeof DispatcherState.Update>;

const REVIEW_CHECKS = [
  {
    node: 'review_api_compatibility',
    axis: 'Обратная совместимость API',
    prompt: 'Проверь, ломает ли изменение публичные API, контракты запросов/ответов или совместимость клиентов.',
  },
  {
    node: 'review_test_coverage',
    axis: 'Покрытие изменённых функций тестами',
    prompt: 'Проверь, хватает ли тестов для изменённых функций и явно отметь риск, если тестов нет.',
  },
  {
    node: 'review_change_risk',
    axis: 'Риск изменения',
    prompt: 'Оцени размер и опасность изменения: auth, billing, миграции, безопасность и критичные файлы.',
  },
] as const;

const trace = (node: string, title: string, detail: string): DispatcherTraceStep[] => [{ node, title, detail }];

const messageText = (message: AIMessage | string) => {
  if (typeof message === 'string') {
    return message.trim();
  }

  if (typeof message.content === 'string') {
    return message.content.trim();
  }

  return message.content
    .map((part) => (typeof part === 'string' ? part : 'text' in part ? part.text : ''))
    .join('\n')
    .trim();
};

export class DispatcherGraphFactory {
  private readonly modelName = process.env.DISPATCHER_OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';

  create() {
    const model = this.createModel();
    const classify = this.createClassifier(model);
    const incident = this.createIncidentHandler(model);
    const aggregateReview = this.createReviewAggregator(model);
    const orchestrateAnalytics = this.createAnalyticsOrchestrator(model);
    const analyticsWorker = this.createAnalyticsWorker(model);
    const synthesizeAnalytics = this.createAnalyticsSynthesizer(model);

    const graph = new StateGraph(DispatcherState)
      .addNode('classify', classify)
      .addNode('needs_human', this.needsHuman)
      .addNode('incident', incident)
      .addNode('code_review_start', this.codeReviewStart)
      .addNode(REVIEW_CHECKS[0].node, this.createReviewCheck(model, REVIEW_CHECKS[0]))
      .addNode(REVIEW_CHECKS[1].node, this.createReviewCheck(model, REVIEW_CHECKS[1]))
      .addNode(REVIEW_CHECKS[2].node, this.createReviewCheck(model, REVIEW_CHECKS[2]))
      .addNode('review_aggregate', aggregateReview)
      .addNode('analytics_orchestrator', orchestrateAnalytics)
      .addNode('analytics_worker', analyticsWorker)
      .addNode('analytics_synthesize', synthesizeAnalytics)
      .addEdge(START, 'classify')
      .addConditionalEdges('classify', this.routeAfterClassify, {
        code_review: 'code_review_start',
        incident: 'incident',
        analytics: 'analytics_orchestrator',
        needs_human: 'needs_human',
      })
      .addEdge('needs_human', END)
      .addEdge('incident', END)
      .addEdge('code_review_start', REVIEW_CHECKS[0].node)
      .addEdge('code_review_start', REVIEW_CHECKS[1].node)
      .addEdge('code_review_start', REVIEW_CHECKS[2].node)
      .addEdge(REVIEW_CHECKS[0].node, 'review_aggregate')
      .addEdge(REVIEW_CHECKS[1].node, 'review_aggregate')
      .addEdge(REVIEW_CHECKS[2].node, 'review_aggregate')
      .addEdge('review_aggregate', END)
      .addConditionalEdges('analytics_orchestrator', this.fanOutAnalyticsTasks)
      .addEdge('analytics_worker', 'analytics_synthesize')
      .addEdge('analytics_synthesize', END);

    return graph.compile();
  }

  private createModel() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required to run the dispatcher graph.');
    }

    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: this.modelName,
      temperature: 0,
    });
  }

  private createClassifier(model: ChatOpenAI) {
    const chain = ChatPromptTemplate.fromMessages([
      [
        'system',
        [
          'Ты классифицируешь входящие задачи команды.',
          'Верни только структурированный результат.',
          'code_review: PR, diff, изменение кода.',
          'incident: alert, outage, ошибка продакшена, деградация сервиса.',
          'analytics: вопрос про метрики, пользователей, продуктовые срезы.',
          'needs_human: если уверенность ниже 0.65 или не хватает контекста.',
        ].join('\n'),
      ],
      ['human', 'Входящее:\n{content}'],
    ]).pipe(
      model.withStructuredOutput(ClassificationSchema, {
        name: 'DispatcherClassification',
        strict: true,
      }),
    );

    return async (state: GraphState): Promise<GraphUpdate> => {
      const classification = await chain.invoke({ content: state.content });
      const route = classification.confidence < 0.65 ? 'needs_human' : classification.route;

      return {
        classification: { ...classification, route },
        route,
        trace: trace('classify', 'Routing', `${route}, confidence ${classification.confidence.toFixed(2)}`),
      };
    };
  }

  private routeAfterClassify(state: GraphState) {
    return state.route ?? 'needs_human';
  }

  private needsHuman(state: GraphState): GraphUpdate {
    return {
      finalAnswer: `Нужна ручная triage-проверка: ${state.classification?.reasoning ?? 'классификатор не дал причину.'}`,
      trace: trace('needs_human', 'Fallback', 'Низкая уверенность классификации, обработка остановлена.'),
    };
  }

  private createIncidentHandler(model: ChatOpenAI) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'Ты on-call инженер. Дай краткий triage: severity, вероятная причина, первые действия.'],
      ['human', 'Алерт или инцидент:\n{content}'],
    ]);

    return async (state: GraphState): Promise<GraphUpdate> => {
      const response = await prompt.pipe(model).invoke({ content: state.content });

      return {
        finalAnswer: messageText(response),
        trace: trace('incident', 'Incident stub', 'Инцидент обработан отдельным LLM-промптом.'),
      };
    };
  }

  private codeReviewStart(state: GraphState): GraphUpdate {
    return {
      trace: trace('code_review_start', 'Parallel fan-out', `Запущены ${REVIEW_CHECKS.length} независимые проверки.`),
    };
  }

  private createReviewCheck(model: ChatOpenAI, check: (typeof REVIEW_CHECKS)[number]) {
    const chain = ChatPromptTemplate.fromMessages([
      ['system', `${check.prompt}\nОсь проверки: ${check.axis}. Верни структурированный отчёт.`],
      ['human', 'PR / diff:\n{content}'],
    ]).pipe(
      model.withStructuredOutput(ReviewReportSchema, {
        name: 'ReviewReport',
        strict: true,
      }),
    );

    return async (state: GraphState): Promise<GraphUpdate> => {
      const report = await chain.invoke({ content: state.content });

      return {
        reviewReports: [{ ...report, axis: check.axis }],
        trace: trace(check.node, check.axis, `${report.risk}: ${report.finding}`),
      };
    };
  }

  private createReviewAggregator(model: ChatOpenAI) {
    const chain = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Ты агрегатор code review. По отчётам вынеси verdict: approve, changes_requested или block. High risk обычно block.',
      ],
      ['human', 'Отчёты:\n{reports}'],
    ]).pipe(
      model.withStructuredOutput(ReviewVerdictSchema, {
        name: 'ReviewVerdict',
        strict: true,
      }),
    );

    return async (state: GraphState): Promise<GraphUpdate> => {
      const reviewVerdict = await chain.invoke({ reports: JSON.stringify(state.reviewReports, null, 2) });

      return {
        reviewVerdict,
        finalAnswer: `${reviewVerdict.verdict}: ${reviewVerdict.reason}`,
        trace: trace('review_aggregate', 'Fan-in verdict', reviewVerdict.reason),
      };
    };
  }

  private createAnalyticsOrchestrator(model: ChatOpenAI) {
    const chain = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Ты аналитический orchestrator. Разбей вопрос на 1-5 независимых расчётов метрик/сегментов. Верни структурированный план.',
      ],
      ['human', 'Вопрос:\n{content}'],
    ]).pipe(
      model.withStructuredOutput(AnalyticsPlanSchema, {
        name: 'AnalyticsPlan',
        strict: true,
      }),
    );

    return async (state: GraphState): Promise<GraphUpdate> => {
      const plan = await chain.invoke({ content: state.content });

      return {
        analyticsTasks: plan.tasks,
        trace: trace('analytics_orchestrator', 'Dynamic fan-out plan', `Задач: ${plan.tasks.length}.`),
      };
    };
  }

  private fanOutAnalyticsTasks(state: GraphState) {
    return state.analyticsTasks.map((task) => new Send('analytics_worker', { ...state, currentAnalyticsTask: task }));
  }

  private createAnalyticsWorker(model: ChatOpenAI) {
    const chain = ChatPromptTemplate.fromMessages([
      [
        'system',
        [
          'Ты worker аналитического графа.',
          'Нет живой БД: сделай правдоподобный локальный расчёт из текста вопроса и задачи.',
          'Верни структурированную находку, пригодную для синтеза.',
        ].join('\n'),
      ],
      ['human', 'Исходный вопрос:\n{content}\n\nЗадача worker:\n{task}'],
    ]).pipe(
      model.withStructuredOutput(AnalyticsFindingSchema, {
        name: 'AnalyticsFinding',
        strict: true,
      }),
    );

    return async (state: GraphState): Promise<GraphUpdate> => {
      const task = state.currentAnalyticsTask;

      if (!task) {
        return {
          trace: trace('analytics_worker', 'Skipped worker', 'Нет текущей analytics-задачи.'),
        };
      }

      const finding = await chain.invoke({ content: state.content, task: JSON.stringify(task) });

      return {
        analyticsFindings: [{ ...finding, metric: task.metric, segment: task.segment }],
        trace: trace('analytics_worker', `${task.metric} / ${task.segment}`, finding.result),
      };
    };
  }

  private createAnalyticsSynthesizer(model: ChatOpenAI) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'Ты senior product analyst. Синтезируй короткий ответ на исходный вопрос по findings.'],
      ['human', 'Вопрос:\n{content}\n\nFindings:\n{findings}'],
    ]);

    return async (state: GraphState): Promise<GraphUpdate> => {
      const response = await prompt
        .pipe(model)
        .invoke({ content: state.content, findings: JSON.stringify(state.analyticsFindings, null, 2) });

      return {
        finalAnswer: messageText(response),
        trace: trace('analytics_synthesize', 'Fan-in synthesis', `Собрано findings: ${state.analyticsFindings.length}.`),
      };
    };
  }
}

export const DISPATCHER_MERMAID = `graph TD
  START([START]) --> classify
  classify -->|code_review| code_review_start
  classify -->|incident| incident
  classify -->|analytics| analytics_orchestrator
  classify -->|needs_human| needs_human
  code_review_start --> review_api_compatibility
  code_review_start --> review_test_coverage
  code_review_start --> review_change_risk
  review_api_compatibility --> review_aggregate
  review_test_coverage --> review_aggregate
  review_change_risk --> review_aggregate
  analytics_orchestrator -->|Send per task| analytics_worker
  analytics_worker --> analytics_synthesize
  review_aggregate --> END([END])
  incident --> END
  needs_human --> END
  analytics_synthesize --> END`;
