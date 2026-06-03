import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRequest, ChatResponse } from './chat.types';
import { writeNdjsonResponse } from '../common/streaming/ndjson-response';

@Controller()
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post('chat')
  chat(@Body() body: ChatRequest): Promise<ChatResponse> {
    return this.chatService.chat(body);
  }

  @Post('chat/stream')
  async streamChat(@Body() body: ChatRequest, @Res() response: any) {
    await writeNdjsonResponse(response, this.chatService.streamChat(body));
  }
}
