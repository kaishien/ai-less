import { makeAutoObservable, runInAction } from 'mobx';

export interface HelloResponse {
  message: string;
  timestamp: string;
}

class ApiStore {
  hello: HelloResponse | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchHello() {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch('/api/hello');

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const hello = (await response.json()) as HelloResponse;

      runInAction(() => {
        this.hello = hello;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unknown API error';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }
}

export const apiStore = new ApiStore();
