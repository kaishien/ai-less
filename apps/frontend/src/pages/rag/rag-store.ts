import { makeAutoObservable } from 'mobx';

class RagStore {
  question = '';

  constructor() {
    makeAutoObservable(this);
  }

  setQuestion(value: string) {
    this.question = value;
  }
}

export const ragStore = new RagStore();
