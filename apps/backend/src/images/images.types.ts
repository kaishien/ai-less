export interface ImageRequest {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'low' | 'medium' | 'high';
}

export interface ImageUsage {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export interface ImageResponse {
  prompt: string;
  image: {
    dataUrl: string;
    mimeType: string;
  };
  usage?: ImageUsage;
}

export interface ImageClient {
  generate(request: Required<ImageRequest>): Promise<ImageResponse>;
}
