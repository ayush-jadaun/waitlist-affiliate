import type {
  SubscribeRequest, SubscribeResponse, SubscriberStatusResponse,
  LeaderboardEntry, PublicStats,
} from "@waitlist/shared";

export interface WaitlistClientOptions {
  apiKey: string;
  baseUrl: string;
}

export class WaitlistClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: WaitlistClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...options.headers,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? `HTTP ${response.status}`);
    }
    return data as T;
  }

  async subscribe(input: Omit<SubscribeRequest, "ip">): Promise<SubscribeResponse> {
    return this.request<SubscribeResponse>("/api/v1/subscribe", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getStatus(email: string): Promise<SubscriberStatusResponse> {
    return this.request<SubscriberStatusResponse>(`/api/v1/subscribe/${encodeURIComponent(email)}/status`);
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>(`/api/v1/leaderboard?limit=${limit}`);
  }

  async getStats(): Promise<PublicStats> {
    return this.request<PublicStats>("/api/v1/stats");
  }
}
