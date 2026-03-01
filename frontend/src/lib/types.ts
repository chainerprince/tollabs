/* ── TOLLABS shared TypeScript types ────────────────────────────── */

export interface User {
  id: number;
  email: string;
  role: "researcher" | "subscriber";
  balance: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TradingModel {
  id: number;
  creator_id: number;
  creator_email?: string;
  name: string;
  description: string;
  asset_class: string;
  status: string;
  performance_metadata: PerformanceMetadata;
  subscriber_count?: number;
  created_at: string;
}

export interface PerformanceMetadata {
  sharpe_ratio?: number;
  max_drawdown_pct?: number;
  total_pnl?: number;
  total_return_pct?: number;
  win_rate?: number;
  num_trades?: number;
  error?: string | null;
}

export interface TradingModelDetail extends TradingModel {
  strategy_code: string;
  trade_history: TradeRecord[];
}

export interface TradeRecord {
  id: string;
  amount?: number;
  type?: string;
  entry_price?: number;
  exit_price?: number;
  entry_time?: string;
  exit_time?: string;
  pnl?: number;
  pnl_pct?: number;
  description?: string;
  created_at?: string;
}

export interface Subscription {
  id: number;
  subscriber_id: number;
  model_id: number;
  model_name: string;
  asset_class: string;
  profit_share_pct: number;
  is_active: boolean;
  high_water_mark: number;
  cumulative_pnl: number;
  stripe_session_id: string | null;
  subscribed_at: string;
}

export interface Transaction {
  id: number;
  subscription_id: number | null;
  user_id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface ResearcherEarnings {
  researcher_id: number;
  email: string;
  total_earnings: number;
  current_balance: number;
  num_payouts: number;
  per_model: ModelEarning[];
  stripe_transfers: StripeTransfer[];
}

export interface ModelEarning {
  model_id: number;
  model_name: string;
  total_earned: number;
}

export interface StripeTransfer {
  id: string;
  amount: number;
  amount_decimal: string;
  currency: string;
  destination: string;
  description: string;
  created: number;
  metadata: Record<string, unknown>;
}

export interface BacktestResult {
  job_id: string;
  status: string;
  asset: string;
  periods: number;
  metrics: PerformanceMetadata;
  trades: TradeRecord[];
  prices_summary: {
    count: number;
    first: PriceBar | null;
    last: PriceBar | null;
  };
}

export interface PriceBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ComputeResult {
  session_id: string;
  stdout: string;
  stderr: string;
  result: string | null;
  error: string | null;
  variables: string[];
}

export interface PlatformStats {
  total_models: number;
  active_subscribers: number;
  total_volume: number;
  developer_payouts: number;
}

export interface SimulateCycleResult {
  message: string;
  results: CycleModelResult[];
}

export interface CycleModelResult {
  model_id: number;
  model_name: string;
  asset_class: string;
  cycle_metrics: PerformanceMetadata;
  num_trades: number;
  subscribers_processed: number;
  subscriber_splits: SubscriberSplit[];
}

export interface SubscriberSplit {
  subscription_id: number;
  subscriber_id: number;
  cumulative_pnl: number;
  high_water_mark: number;
  trade_pnl: number;
  new_profit: number;
  researcher_payout: number;
  platform_commission: number;
  subscriber_net: number;
}

/* ── AI types ───────────────────────────────────────────────────── */
export interface StrategyParameter {
  name: string;
  current_value: string;
  type: string;
  description: string;
  suggested_range: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/* ── Compute / Workspace types ──────────────────────────────────── */
export interface WorkspaceFile {
  name: string;
  size: number;
  modified: string;
  type: string;
}

/* ── Training / Fine-tuning types ──────────────────────────────── */
export interface TrainingConfig {
  epochs: number;
  learning_rate: number;
  batch_size: number;
  lora_rank: number;
  warmup_steps: number;
  weight_decay: number;
  max_seq_length: number;
}

export interface TrainingJob {
  id: number;
  user_id: number;
  job_name: string;
  base_model: string;
  dataset_filename: string;
  config: Partial<TrainingConfig>;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  metrics: TrainingMetrics;
  model_artifact_path: string | null;
  logs: string;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TrainingJobListItem {
  id: number;
  job_name: string;
  base_model: string;
  status: string;
  progress: number;
  created_at: string;
  completed_at: string | null;
}

export interface TrainingMetrics {
  loss_history?: number[];
  val_loss_history?: number[];
  current_loss?: number;
  current_val_loss?: number;
  best_loss?: number;
  epoch?: number;
  step?: number;
  total_steps?: number;
}

export interface BaseModelInfo {
  model_id: string;
  name: string;
  description: string;
  parameter_count: string;
  task: string;
  tags: string[];
  source_url: string;
}

export interface ModelArtifact {
  filename: string;
  path: string;
  size: number;
  modified: string;
}

/* ── Trading / Subscriber types ─────────────────────────────────── */

export interface TradeRecord2 {
  id: number;
  subscription_id: number;
  subscriber_id: number;
  model_id: number;
  capital: number;
  status: "pending" | "confirmed" | "executing" | "completed" | "failed";
  entry_price: number | null;
  exit_price: number | null;
  direction: string | null;
  pnl: number;
  pnl_pct: number;
  num_trades: number;
  execution_details: Record<string, unknown>;
  researcher_share: number;
  platform_share: number;
  subscriber_net: number;
  modifications: string;
  created_at: string;
  executed_at: string | null;
}

export interface TradeSummary {
  trade_id: number;
  model_name: string;
  asset_class: string;
  capital: number;
  strategy_summary: string;
  modifications: string;
  estimated_risk: "Low" | "Medium" | "High";
  profit_share_pct: number;
  status: string;
}

export interface ProfitSharingDetail {
  trade_id: number;
  trade_pnl: number;
  researcher_share: number;
  platform_share: number;
  subscriber_net: number;
  researcher_email: string;
  model_name: string;
  executed_at: string | null;
}

export interface WalletInfo {
  balance: number;
  message?: string;
  email?: string;
}
