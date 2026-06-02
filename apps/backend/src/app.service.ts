import { Injectable } from '@nestjs/common';

export interface HelloResponse {
  message: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  getHello(): HelloResponse {
    return {
      message: 'Ping!',
      timestamp: new Date().toISOString(),
    };
  }
}
