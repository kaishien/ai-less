import { LlmTool } from './chat.types';

export const GENERATE_IMAGE_TOOL = 'generate_image';

export interface GenerateImageArgs {
  prompt?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
}

export const CHAT_TOOLS: LlmTool[] = [
  {
    name: GENERATE_IMAGE_TOOL,
    description:
      'Сгенерировать изображение по текстовому описанию. Вызывай, когда пользователь просит нарисовать, создать, сгенерировать картинку, изображение, иллюстрацию, схему или любой визуал.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Подробное описание изображения. Уточни детали из контекста диалога, если пользователь ссылается на предыдущую картинку.',
        },
        size: {
          type: 'string',
          enum: ['1024x1024', '1024x1536', '1536x1024'],
          description: 'Размер изображения. По умолчанию 1024x1024.',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
];

export const TOOL_GUIDANCE = [
  'У тебя есть инструмент generate_image для генерации изображений — это поддерживаемая возможность приложения.',
  'Если пользователь просит нарисовать, создать или сгенерировать изображение/картинку/иллюстрацию/визуал, вызови generate_image вместо текстового отказа, даже если тема сама по себе нетехническая.',
  'Для обычных вопросов отвечай текстом как всегда, без вызова инструментов.',
].join(' ');
