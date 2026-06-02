import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const GENERATED_DIR = path.join(process.cwd(), 'generated');

export interface ImageMeta {
  url: string;
  prompt: string;
  created: number;
}

@Injectable()
export class ImagesService {
  async generate(prompt: string): Promise<ImageMeta> {
    const apiKey = process.env.API_KEY;
    const apiUrl = process.env.API_URL || 'https://bothub.chat/api/v2/openai/v1';
    const model = process.env.MODEL || 'dall-e-3';

    if (!apiKey) throw new InternalServerErrorException('API_KEY is not configured');

    const response = await axios.post(
      `${apiUrl}/images/generations`,
      { model, prompt, n: 1, size: '1024x1024' },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
    );

    const imageUrl: string = response.data.data[0].url;
    const timestamp = Date.now();
    const filename = `${timestamp}.png`;

    await this.downloadFile(imageUrl, path.join(GENERATED_DIR, filename));

    const meta: ImageMeta = { url: `/generated/${filename}`, prompt, created: timestamp };
    fs.writeFileSync(path.join(GENERATED_DIR, `${timestamp}.json`), JSON.stringify(meta));

    return meta;
  }

  findAll(): ImageMeta[] {
    return fs
      .readdirSync(GENERATED_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, f), 'utf-8')) as ImageMeta)
      .sort((a, b) => b.created - a.created);
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      proto.get(url, res => {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }).on('error', err => {
        fs.unlink(dest, () => undefined);
        reject(err);
      });
    });
  }
}
