import { Injectable } from '@nestjs/common';

export interface TokenBudgetSnapshot {
  used: number;
  limit: number;
  resetsAt: Date;
}

@Injectable()
export class TokenBudget {
  private used = 0;
  private windowStartedAt = Date.now();

  private readonly windowMs = 60 * 60 * 1000;
  private readonly limit = Number(process.env.TOKEN_BUDGET_PER_HOUR ?? 20_000);

  canSpend(estimatedTokens: number) {
    this.resetIfNeeded();
    return this.used + estimatedTokens <= this.limit;
  }

  spend(tokens: number) {
    this.resetIfNeeded();
    this.used += tokens;
  }

  snapshot(): TokenBudgetSnapshot {
    this.resetIfNeeded();

    return {
      used: this.used,
      limit: this.limit,
      resetsAt: new Date(this.windowStartedAt + this.windowMs),
    };
  }

  private resetIfNeeded() {
    if (Date.now() - this.windowStartedAt < this.windowMs) {
      return;
    }

    this.used = 0;
    this.windowStartedAt = Date.now();
  }
}
