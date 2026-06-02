import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRequest, ChatResponse } from './chat.types';

@Controller()
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post('chat')
  chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    return this.chatService.chat(body);
  }

  @Post('chat/stream')
  async streamChat(@Body() body: ChatRequest, @Res() response: any) {
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    try {
      for await (const event of this.chatService.streamChat(body)) {
        response.write(`${JSON.stringify(event)}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown stream error';
      response.write(`${JSON.stringify({ type: 'error', message })}\n`);
    } finally {
      response.end();
    }
  }
}
