import { makeAutoObservable, runInAction } from 'mobx';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  imageLoading?: boolean;
}

interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatResponse {
  assistant: {
    name: string;
    roleDescription: string;
  };
  message: {
    role: ChatRole;
    content: string;
  };
  usage: ChatUsage;
  budget: {
    used: number;
    limit: number;
    resetsAt: string;
  };
}

interface ImageResponse {
  prompt: string;
  image: {
    dataUrl: string;
    mimeType: string;
  };
  usage?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

type ChatStreamEvent =
  | {
      type: 'assistant';
      assistant: ChatResponse['assistant'];
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'image_pending';
      prompt: string;
    }
  | {
      type: 'image';
      prompt: string;
      image: {
        dataUrl: string;
        mimeType: string;
      };
      usage?: ImageResponse['usage'];
    }
  | {
      type: 'done';
      message: {
        role: ChatRole;
        content: string;
      };
      usage: ChatUsage;
      budget: ChatResponse['budget'];
    }
  | {
      type: 'error';
      message: string;
    };

class ChatStore {
  input = '';
  isStreaming = false;
  error: string | null = null;
  usage: ChatUsage | null = null;
  budget: ChatResponse['budget'] | null = null;
  assistant = {
    name: 'Северин',
    roleDescription:
      'Северин — спокойный технический наставник для разработчиков. Он помогает с API, TypeScript, backend-архитектурой и тестами, но не раскрывает секреты и не помогает с вредоносными действиями.',
  };
  messages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Привет. Я Северин. Отправь сообщение, и я отвечу через OpenAI-backed сервер.',
    },
  ];

  constructor() {
    makeAutoObservable(this);
  }

  setInput(value: string) {
    this.input = value;
  }

  async sendMessage() {
    const text = this.input.trim();

    if (!text || this.isStreaming) {
      return;
    }

    const history = this.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };

    this.messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    });
    this.messages.push(assistantMessage);
    this.input = '';
    this.isStreaming = true;
    this.error = null;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: text }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          typeof errorBody?.message === 'string' ? errorBody.message : `Chat request failed: ${response.status}`;
        throw new Error(message);
      }

      await this.readStream(response, assistantMessage);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unknown chat error';
        this.discardEmptyAssistantMessage(assistantMessage.id);
      });
    } finally {
      runInAction(() => {
        this.isStreaming = false;
      });
    }
  }

  private async readStream(response: Response, assistantMessage: ChatMessage) {
    if (!response.body) {
      throw new Error('Chat stream is not readable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        this.applyStreamEvent(JSON.parse(line) as ChatStreamEvent, assistantMessage);
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      this.applyStreamEvent(JSON.parse(buffer) as ChatStreamEvent, assistantMessage);
    }
  }

  private applyStreamEvent(event: ChatStreamEvent, assistantMessage: ChatMessage) {
    if (event.type === 'assistant') {
      runInAction(() => {
        this.assistant = event.assistant;
      });
      return;
    }

    if (event.type === 'delta') {
      runInAction(() => {
        const currentAssistantMessage = this.messages.find((message) => message.id === assistantMessage.id);

        if (currentAssistantMessage) {
          currentAssistantMessage.content += event.delta;
        } else {
          this.messages.push(assistantMessage);
          assistantMessage.content += event.delta;
        }
      });
      return;
    }

    if (event.type === 'image_pending') {
      runInAction(() => {
        const message = this.ensureAssistantMessage(assistantMessage);
        message.imagePrompt = event.prompt;
        message.imageLoading = true;

        if (!message.content) {
          message.content = `Генерирую изображение: ${event.prompt}`;
        }
      });
      return;
    }

    if (event.type === 'image') {
      runInAction(() => {
        const message = this.ensureAssistantMessage(assistantMessage);
        message.imageUrl = event.image.dataUrl;
        message.imagePrompt = event.prompt;
        message.imageLoading = false;

        if (event.usage?.total_tokens) {
          this.usage = {
            prompt_tokens: event.usage.input_tokens ?? 0,
            completion_tokens: event.usage.output_tokens ?? 0,
            total_tokens: event.usage.total_tokens,
          };
        }
      });
      return;
    }

    if (event.type === 'done') {
      console.log(
        `[chat] prompt_tokens=${event.usage.prompt_tokens} completion_tokens=${event.usage.completion_tokens} total_tokens=${event.usage.total_tokens}`,
      );

      runInAction(() => {
        const currentAssistantMessage = this.messages.find((message) => message.id === assistantMessage.id);
        const finalized = currentAssistantMessage ?? this.ensureAssistantMessage(assistantMessage);

        if (event.message.content) {
          finalized.content = event.message.content;
        }
        finalized.imageLoading = false;

        // Keep the image-generation token usage when this turn produced an image.
        if (!finalized.imageUrl) {
          this.usage = event.usage;
        }
        this.budget = event.budget;
      });
      return;
    }

    throw new Error(event.message);
  }

  private ensureAssistantMessage(assistantMessage: ChatMessage) {
    const existing = this.messages.find((message) => message.id === assistantMessage.id);

    if (existing) {
      return existing;
    }

    this.messages.push(assistantMessage);
    return assistantMessage;
  }

  private discardEmptyAssistantMessage(id: string) {
    const message = this.messages.find((item) => item.id === id);

    if (message && !message.content && !message.imageUrl && !message.imageLoading) {
      this.messages = this.messages.filter((item) => item.id !== id);
    }
  }

  get lastUsageLabel() {
    if (!this.usage) {
      return 'No usage yet';
    }

    return `prompt ${this.usage.prompt_tokens} · completion ${this.usage.completion_tokens} · total ${this.usage.total_tokens}`;
  }

  get budgetLabel() {
    if (!this.budget) {
      return null;
    }

    return `${this.budget.used}/${this.budget.limit} tokens · resets ${new Date(this.budget.resetsAt).toLocaleTimeString()}`;
  }
}

export const chatStore = new ChatStore();
