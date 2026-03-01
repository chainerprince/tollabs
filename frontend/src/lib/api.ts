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
  CredentialsStatus,
  ModelDeployment,
  DeploymentListItem,
  HFModelResult,
  MultiTradeResult,
  GPUTier,
  BacktestModelResult,
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

  // ── Credentials ────────────────────────────────────────
  getCredentials() {
    return request<CredentialsStatus>("/researcher/credentials");
  },
  setModalCredentials(tokenId: string, tokenSecret: string) {
    return request<{ message: string; modal_app_name: string }>("/researcher/credentials/modal", {
      method: "POST",
      body: JSON.stringify({ modal_token_id: tokenId, modal_token_secret: tokenSecret }),
    });
  },
  setHFToken(token: string) {
    return request<{ message: string }>("/researcher/credentials/huggingface", {
      method: "POST",
      body: JSON.stringify({ hf_token: token }),
    });
  },
  removeModalCredentials() {
    return request<{ message: string }>("/researcher/credentials/modal", { method: "DELETE" });
  },

  // ── Deployments ────────────────────────────────────────
  deployTrainedModel(trainingJobId: number, name: string) {
    return request<ModelDeployment>("/researcher/deployments", {
      method: "POST",
      body: JSON.stringify({ training_job_id: trainingJobId, name }),
    });
  },
  listDeployments() {
    return request<DeploymentListItem[]>("/researcher/deployments");
  },
  getDeployment(id: number) {
    return request<ModelDeployment>(`/researcher/deployments/${id}`);
  },
  stopDeployment(id: number) {
    return request<{ message: string }>(`/researcher/deployments/${id}/stop`, { method: "POST" });
  },

  // ── Marketplace publish ────────────────────────────────
  publishToMarketplace(deploymentId: number, name: string, description?: string, assetClass?: string) {
    return request<TradingModel>("/researcher/deployments/publish", {
      method: "POST",
      body: JSON.stringify({
        deployment_id: deploymentId,
        name,
        description: description ?? "",
        asset_class: assetClass ?? "stock",
      }),
    });
  },
  // ── GPU Tiers ───────────────────────────────────
  getGPUTiers() {
    return request<GPUTier[]>("/researcher/gpu-tiers");
  },

  // ── Dataset upload ──────────────────────────────
  uploadDataset(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const token = typeof window !== "undefined" ? localStorage.getItem("tollabs_token") : null;
    return fetch(`${BASE}/researcher/upload-dataset`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
      return r.json() as Promise<{ message: string; filename: string; size: number; rows: number }>;
    });
  },

  // ── Backtest a trained model ────────────────────
  backtestModel(trainingJobId: number, asset: string, periods: number) {
    return request<BacktestModelResult>("/researcher/backtest-model", {
      method: "POST",
      body: JSON.stringify({ training_job_id: trainingJobId, asset, periods }),
    });
  },

  // ── Submit to marketplace (final step) ───────────
  submitToMarketplace(data: {
    training_job_id: number;
    deployment_id?: number;
    name: string;
    description: string;
    asset_class: string;
    backtest_metrics: Record<string, unknown>;
    backtest_asset: string;
    backtest_periods: number;
  }) {
    return request<TradingModel>("/researcher/submit-to-marketplace", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ── Demo profitable strategy backtest ────────────
  backtestDemo(asset: string, periods: number) {
    return request<BacktestModelResult>("/researcher/backtest-demo", {
      method: "POST",
      body: JSON.stringify({ asset, periods }),
    });
  },

  // ── AI suggestion for unprofitable strategies ────
  aiSuggest(metrics: Record<string, unknown>, asset: string, periods: number) {
    return request<{ suggestion: string }>("/researcher/ai-suggest", {
      method: "POST",
      body: JSON.stringify({ metrics, asset, periods }),
    });
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
  seedDemoDataset() {
    return request<{ message: string; filename: string; rows: number; columns: string[]; labels: string[] }>(
      "/training/datasets/seed",
      { method: "POST" },
    );
  },
  searchHuggingFace(q: string, task = "text-classification", limit = 20) {
    return request<HFModelResult[]>(
      `/training/hf-search?q=${encodeURIComponent(q)}&task=${encodeURIComponent(task)}&limit=${limit}`
    );
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
  executeMultiTrade(subscriptionId: number, capitalPerTrade: number, numTrades: number) {
    return request<MultiTradeResult>("/trading/trades/multi", {
      method: "POST",
      body: JSON.stringify({ subscription_id: subscriptionId, capital_per_trade: capitalPerTrade, num_trades: numTrades }),
    });
  },
};
