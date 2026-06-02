export interface RagAskRequest {
  question: string;
}

export interface RagAskResponse {
  answer: string;
  sources: string[];
}
