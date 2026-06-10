import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class DevAgentsModelFactory {
  private readonly modelName = process.env.DEV_AGENTS_OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o';

  createChatModel({ temperature }: { temperature: number }) {
    if (!process.env.OPENAI_API_KEY) {
      throw new HttpException(
        {
          message: 'OPENAI_API_KEY is required to call LangChain dev-agent endpoints.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: this.modelName,
      temperature,
    });
  }
}
