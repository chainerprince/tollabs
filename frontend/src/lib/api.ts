/* ── TOLLABS API client ─────────────────────────────────────────── */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tollabs_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/* ── Auth ──────────────────────────────────────────────────────── */
import type {
  TokenResponse,
  TradingModel,
  TradingModelDetail,
  Subscription,
  ResearcherEarnings,
  BacktestResult,
  ComputeResult,
  PlatformStats,
  Transaction,
  SimulateCycleResult,
} from "./types";

export const auth = {
  register(email: string, password: string, role: string) {
    return request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
  },
  login(email: string, password: string) {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
};

/* ── Marketplace ──────────────────────────────────────────────── */
export const marketplace = {
  listModels() {
    return request<TradingModel[]>("/marketplace/models");
  },
  getModel(id: number) {
    return request<TradingModelDetail>(`/marketplace/models/${id}`);
  },
  getStats() {
    return request<PlatformStats>("/marketplace/stats");
  },
};

/* ── Subscriptions ────────────────────────────────────────────── */
export const subscriptions = {
  subscribe(modelId: number, profitSharePct = 0.2) {
    return request<{ message: string; subscription: Subscription }>(
      `/subscribe/${modelId}`,
      {
        method: "POST",
        body: JSON.stringify({ profit_share_pct: profitSharePct }),
      },
    );
  },
  mySubscriptions() {
    return request<Subscription[]>("/subscriptions/me");
  },
  cancel(subscriptionId: number) {
    return request<{ message: string }>(`/subscriptions/${subscriptionId}`, {
      method: "DELETE",
    });
  },
  getDetail(subscriptionId: number) {
    return request<Subscription & { model: TradingModel; transactions: Transaction[] }>(
      `/subscriptions/${subscriptionId}/detail`,
    );
  },
};

/* ── Researcher ───────────────────────────────────────────────── */
export const researcher = {
  createModel(data: {
    name: string;
    description: string;
    asset_class: string;
    strategy_code: string;
  }) {
    return request<TradingModel>("/researcher/models", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  deployModel(modelId: number) {
    return request<TradingModel>(`/researcher/deploy/${modelId}`, {
      method: "POST",
    });
  },
  getEarnings() {
    return request<ResearcherEarnings>("/researcher/earnings");
  },
  myModels() {
    return request<TradingModel[]>("/researcher/models/mine");
  },
  getTransactions() {
    return request<Transaction[]>("/researcher/transactions");
  },
};

/* ── Backtest ─────────────────────────────────────────────────── */
export const backtest = {
  run(data: {
    strategy_code?: string;
    asset?: string;
    periods?: number;
    volatility?: number;
  }) {
    return request<BacktestResult>("/backtest/run", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getResult(jobId: string) {
    return request<BacktestResult>(`/backtest/results/${jobId}`);
  },
  listJobs() {
    return request<{ job_id: string; status: string; asset: string }[]>(
      "/backtest/jobs",
    );
  },
};

/* ── Compute ──────────────────────────────────────────────────── */
import type { WorkspaceFile } from "./types";

export const compute = {
  runCell(code: string, sessionId?: string) {
    return request<ComputeResult>("/compute/run-cell", {
      method: "POST",
      body: JSON.stringify({ code, session_id: sessionId }),
    });
  },
  resetSession() {
    return request<{ message: string }>("/compute/reset-session", {
      method: "POST",
    });
  },
  listFiles() {
    return request<{ files: WorkspaceFile[] }>("/compute/files");
  },
  async uploadFile(file: File) {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE}/compute/files/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail ?? `Upload failed (${res.status})`);
    }
    return res.json() as Promise<{ message: string; file: WorkspaceFile }>;
  },
  importUrl(url: string, filename?: string) {
    return request<{ message: string; file: WorkspaceFile }>("/compute/files/import-url", {
      method: "POST",
      body: JSON.stringify({ url, filename }),
    });
  },
  previewFile(filename: string) {
    return request<{ filename: string; preview: string; total_size: number }>(
      `/compute/files/${encodeURIComponent(filename)}`
    );
  },
  deleteFile(filename: string) {
    return request<{ message: string }>(
      `/compute/files/${encodeURIComponent(filename)}`,
      { method: "DELETE" }
    );
  },
};

/* ── Admin ─────────────────────────────────────────────────────── */
export const admin = {
  simulateCycle(periods = 200, modelId?: number) {
    return request<SimulateCycleResult>("/admin/simulate-cycle", {
      method: "POST",
      body: JSON.stringify({ periods, model_id: modelId }),
    });
  },
};

/* ── AI ────────────────────────────────────────────────────────── */
import type { StrategyParameter, ChatMessage, TrainingJob, TrainingJobListItem, BaseModelInfo, ModelArtifact, TradeRecord2, TradeSummary, ProfitSharingDetail, WalletInfo } from "./types";

export const ai = {
  explain(strategyCode: string, asset: string, periods: number) {
    return request<{ explanation: string }>("/ai/explain", {
      method: "POST",
      body: JSON.stringify({ strategy_code: strategyCode, asset, periods }),
    });
  },
  ask(strategyCode: string, question: string, history?: ChatMessage[]) {
    return request<{ answer: string }>("/ai/ask", {
      method: "POST",
      body: JSON.stringify({ strategy_code: strategyCode, question, history }),
    });
  },
  extractParams(strategyCode: string) {
    return request<{ parameters: StrategyParameter[] }>("/ai/extract-params", {
      method: "POST",
      body: JSON.stringify({ strategy_code: strategyCode }),
    });
  },
  codeAssist(prompt: string, context?: string, files?: string[]) {
    return request<{ code: string }>("/ai/code-assist", {
      method: "POST",
      body: JSON.stringify({ prompt, context, files }),
    });
  },
  buildStrategy(description: string, asset?: string) {
    return request<{ code: string; summary: string }>("/ai/build-strategy", {
      method: "POST",
      body: JSON.stringify({ description, asset }),
    });
  },
};

/* ── Training / Fine-tuning ───────────────────────────────────── */
export const training = {
  submitJob(data: {
    job_name: string;
    base_model: string;
    dataset_filename: string;
    config?: Partial<{
      epochs: number;
      learning_rate: number;
      batch_size: number;
      lora_rank: number;
      warmup_steps: number;
      weight_decay: number;
      max_seq_length: number;
    }>;
  }) {
    return request<TrainingJob>("/training/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  listJobs() {
    return request<TrainingJobListItem[]>("/training/jobs");
  },
  getJob(jobId: number) {
    return request<TrainingJob>(`/training/jobs/${jobId}`);
  },
  cancelJob(jobId: number) {
    return request<TrainingJob>(`/training/jobs/${jobId}`, { method: "DELETE" });
  },
  listBaseModels(task?: string) {
    const q = task ? `?task=${encodeURIComponent(task)}` : "";
    return request<BaseModelInfo[]>(`/training/models${q}`);
  },
  searchModels(query: string, limit = 10) {
    return request<BaseModelInfo[]>(
      `/training/models/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  },
  downloadModel(modelId: string) {
    return request<{ message: string; model_id: string; path: string; files: string[] }>(
      "/training/models/download",
      { method: "POST", body: JSON.stringify({ model_id: modelId }) },
    );
  },
  listArtifacts() {
    return request<ModelArtifact[]>("/training/artifacts");
  },
};

/* ── Trading (Subscriber) ─────────────────────────────────────── */
export const trading = {
  fundWallet(amount: number) {
    return request<WalletInfo>("/trading/wallet/fund", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  },
  withdrawWallet(amount: number) {
    return request<WalletInfo>("/trading/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  },
  getBalance() {
    return request<WalletInfo>("/trading/wallet/balance");
  },
  agentChat(subscriptionId: number, message: string, history?: { role: string; content: string }[], capital?: number) {
    return request<{ response: string }>("/trading/agent/chat", {
      method: "POST",
      body: JSON.stringify({
        subscription_id: subscriptionId,
        message,
        history: history ?? [],
        capital,
      }),
    });
  },
  configureTrade(subscriptionId: number, capital: number, modifications?: string) {
    return request<TradeSummary>("/trading/trades/configure", {
      method: "POST",
      body: JSON.stringify({
        subscription_id: subscriptionId,
        capital,
        modifications: modifications ?? "",
      }),
    });
  },
  executeTrade(tradeId: number) {
    return request<TradeRecord2>(`/trading/trades/${tradeId}/execute`, {
      method: "POST",
    });
  },
  listTrades() {
    return request<TradeRecord2[]>("/trading/trades");
  },
  listSubscriptionTrades(subscriptionId: number) {
    return request<TradeRecord2[]>(`/trading/trades/subscription/${subscriptionId}`);
  },
  getProfitSharing() {
    return request<ProfitSharingDetail[]>("/trading/profit-sharing");
  },
};
