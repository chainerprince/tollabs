"""
AI service — Gemini-powered strategy analysis & Q&A.
"""

import google.generativeai as genai
from app.config import settings

_model = None


def _get_model():
    global _model
    if _model is None:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-2.5-flash")
    return _model


STRATEGY_SYSTEM = """You are an expert quantitative trading strategist working inside TOLLABS,
an AI trading infrastructure platform.  Speak concisely and use markdown.
When analysing strategy code, focus on: entry/exit logic, risk management,
edge cases, potential improvements, and risk-adjusted return expectations.
When the user asks a question, answer with concrete, actionable advice."""

CODE_ASSIST_SYSTEM = """You are a Python coding assistant inside TOLLABS Cloud Notebook,
a Colab-like environment for quantitative finance.  The user has uploaded data files
into their workspace and can run Python cells.  Common libraries available:
pandas, numpy, matplotlib, scikit-learn, scipy, statsmodels.

Rules:
- Return ONLY executable Python code. No markdown fences. No explanations outside code comments.
- If the user asks to load a file, use pandas with the filename as-is (files are in the cwd).
- Keep code concise and well-commented.
- For plots, use matplotlib with plt.show().
- When describing results add print() statements."""


def explain_strategy(strategy_code: str, asset: str, periods: int) -> str:
    """Generate a plain-English explanation of a strategy."""
    prompt = f"""{STRATEGY_SYSTEM}

Given the following trading strategy code targeting **{asset}** with a backtest window of **{periods}** periods,
provide a clear explanation that covers:
1. **Overview** — What the strategy does in one sentence.
2. **Entry & Exit Logic** — When it buys and when it sells.
3. **Risk Management** — Built-in safeguards (stop-loss, position sizing, etc.).
4. **Strengths** — Why this approach can work.
5. **Weaknesses** — Known pitfalls and market regimes where it may fail.
6. **Improvement Ideas** — 2-3 concrete suggestions to improve performance.

If the code is empty, explain the default SMA crossover strategy that TOLLABS uses.

```python
{strategy_code or "# Default: Simple Moving Average Crossover (SMA 20 / SMA 50)"}
```"""
    response = _get_model().generate_content(prompt)
    return response.text


def ask_about_strategy(strategy_code: str, question: str, history: list[dict] | None = None) -> str:
    """Answer a follow-up question about a strategy with optional chat history."""
    history_text = ""
    if history:
        for msg in history[-6:]:  # keep last 6 messages for context
            role = msg.get("role", "user")
            history_text += f"\n**{role.capitalize()}**: {msg['content']}\n"

    prompt = f"""{STRATEGY_SYSTEM}

Strategy code:
```python
{strategy_code or "# Default: Simple Moving Average Crossover (SMA 20 / SMA 50)"}
```

{f"Previous conversation:{history_text}" if history_text else ""}

User question: {question}

Answer concisely with markdown formatting:"""
    response = _get_model().generate_content(prompt)
    return response.text


def extract_parameters(strategy_code: str) -> dict:
    """Use Gemini to extract tunable parameters from strategy code."""
    prompt = f"""{STRATEGY_SYSTEM}

Analyze the following strategy code and extract ALL tunable parameters.
Return ONLY a valid JSON object (no markdown fences) with this exact structure:
{{
  "parameters": [
    {{
      "name": "parameter_name",
      "current_value": "current value in code or default",
      "type": "int | float | string | bool",
      "description": "one-line description",
      "suggested_range": "e.g. 5-50 or 0.01-0.05"
    }}
  ]
}}

If the code is empty, return parameters for a default SMA crossover strategy
(fast_period=20, slow_period=50, stop_loss_pct=0.02, take_profit_pct=0.04, position_size=0.1).

```python
{strategy_code or "# Default: Simple Moving Average Crossover (SMA 20 / SMA 50)"}
```"""
    response = _get_model().generate_content(prompt)
    text = response.text.strip()
    # Strip markdown fences if the model wraps them anyway
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3].strip()

    import json
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "parameters": [
                {"name": "fast_period", "current_value": "20", "type": "int",
                 "description": "Fast SMA lookback window", "suggested_range": "5-30"},
                {"name": "slow_period", "current_value": "50", "type": "int",
                 "description": "Slow SMA lookback window", "suggested_range": "20-200"},
                {"name": "stop_loss_pct", "current_value": "0.02", "type": "float",
                 "description": "Stop-loss percentage", "suggested_range": "0.01-0.05"},
                {"name": "take_profit_pct", "current_value": "0.04", "type": "float",
                 "description": "Take-profit percentage", "suggested_range": "0.02-0.10"},
                {"name": "position_size", "current_value": "0.1", "type": "float",
                 "description": "Fraction of capital per trade", "suggested_range": "0.05-0.25"},
            ]
        }


def code_assist(prompt: str, context: str = "", files: list[str] | None = None) -> str:
    """Generate Python code from a natural-language request.
    
    Args:
        prompt: What the user wants to do (e.g. "load data.csv and plot close prices")
        context: Optional existing code context from the notebook
        files: Optional list of filenames in the user's workspace
    """
    files_hint = ""
    if files:
        files_hint = f"\n\nFiles in the user's workspace:\n" + "\n".join(f"- {f}" for f in files)

    full_prompt = f"""{CODE_ASSIST_SYSTEM}{files_hint}

{f"Current notebook context:\n```python\n{context}\n```\n" if context else ""}
User request: {prompt}

Generate ONLY the Python code (no markdown fences):"""

    response = _get_model().generate_content(full_prompt)
    text = response.text.strip()
    # Strip markdown fences if model wraps them
    if text.startswith("```python"):
        text = text[len("```python"):].strip()
    elif text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()
    return text


STRATEGY_AGENT_SYSTEM = (
    "You are a personal trading assistant AI inside TOLLABS, trained on a specific trading strategy. "
    "You help subscribers understand the strategy, configure trades, and make informed decisions.\n\n"
    "You have deep knowledge of:\n"
    "1. The strategy logic, entry/exit rules, and risk management\n"
    "2. How profit sharing works (subscriber keeps most, researcher gets a share of profits)\n"
    "3. Position sizing and capital allocation best practices\n"
    "4. The specific asset class and market conditions\n\n"
    "Behavioral rules:\n"
    "- Be conversational, helpful, and concise. Use markdown.\n"
    "- If the user asks how much money to trade with, help them think about risk tolerance, not just returns.\n"
    "- If the user asks to modify the strategy, explain what the modification would change and any risks.\n"
    "- If the user asks about profit sharing, explain: profits are split — researcher gets their share (e.g. 20%), "
    "TOLLABS takes a commission (10%), and you keep the rest (70%).\n"
    "- Never guarantee returns. Always mention that past performance does not guarantee future results.\n"
    "- If the user asks something unrelated to trading, politely redirect.\n"
    "- When the user is ready to trade, summarize the key details: capital, strategy, risk level, and expected profit sharing split."
)


STRATEGY_BUILDER_SYSTEM = """You are a quantitative trading strategy code generator inside TOLLABS.
Your job is to convert a natural-language trading strategy description into executable Python code
that works with the TOLLABS backtest engine.

The backtest engine provides these variables in the execution namespace:
- `prices`: list of dicts with keys "timestamp", "open", "high", "low", "close", "volume"
- `np`: numpy
- `math`: math module
- `uuid`: uuid module
- `trades`: an empty list — you MUST append trade dicts to this list

Each trade dict must have these keys:
{
    "id": str (use uuid.uuid4().hex[:8]),
    "type": "long" or "short",
    "entry_price": float,
    "exit_price": float,
    "entry_time": str (ISO timestamp from prices),
    "exit_time": str (ISO timestamp from prices),
    "pnl": float (exit_price - entry_price for long, entry - exit for short),
    "pnl_pct": float (pnl / entry_price * 100),
}

Rules:
- Return ONLY executable Python code. No markdown fences. No explanations outside comments.
- Extract close prices as: closes = [p["close"] for p in prices]
- Implement the exact strategy the user described with proper entry/exit signals.
- Always include a stop-loss if the user mentioned one. If not mentioned, add a 2% default stop-loss.
- Add clear comments explaining each part of the logic.
- Use simple, readable code. No classes needed.
- The code will be executed via exec() with the namespace above."""


def build_strategy(description: str, asset: str = "EUR/USD") -> dict:
    """Convert a natural-language strategy description into executable Python strategy code.
    
    Returns dict with 'code', 'summary', and 'parameters' keys.
    """
    prompt = f"""{STRATEGY_BUILDER_SYSTEM}

Asset: {asset}

User's strategy description:
\"\"\"{description}\"\"\"

Generate the Python strategy code. Add a brief comment block at the top summarizing the strategy rules.
Return ONLY the code:"""

    response = _get_model().generate_content(prompt)
    code = response.text.strip()
    # Strip markdown fences
    if code.startswith("```python"):
        code = code[len("```python"):].strip()
    elif code.startswith("```"):
        code = code[3:].strip()
    if code.endswith("```"):
        code = code[:-3].strip()

    # Generate a brief summary
    summary_prompt = f"""{STRATEGY_SYSTEM}
Summarize this trading strategy in exactly 2-3 bullet points.
Be very concise. Use markdown bullet points (- ).

Strategy description: {description}

Bullet summary:"""

    try:
        summary_response = _get_model().generate_content(summary_prompt)
        summary = summary_response.text.strip()
    except Exception:
        summary = f"- Custom strategy for {asset}\n- Based on: {description[:100]}"

    return {
        "code": code,
        "summary": summary,
    }


def strategy_agent_chat(
    strategy_code: str,
    model_name: str,
    asset_class: str,
    description: str,
    performance: dict,
    message: str,
    history: list[dict] | None = None,
    capital: float | None = None,
) -> str:
    """Chat with an AI agent that is an expert on a specific subscribed strategy.
    
    The agent helps subscribers understand the strategy, decide on capital allocation,
    request modifications, and prepare for trade execution.
    """
    history_text = ""
    if history:
        for msg in history[-8:]:
            role = msg.get("role", "user")
            history_text += f"\n**{role.capitalize()}**: {msg['content']}\n"

    perf_summary = ""
    if performance:
        perf_summary = f"""
Performance metrics:
- Sharpe Ratio: {performance.get('sharpe_ratio', 'N/A')}
- Max Drawdown: {performance.get('max_drawdown_pct', 'N/A')}%
- Win Rate: {performance.get('win_rate', 'N/A')}%
- Total Return: {performance.get('total_return_pct', 'N/A')}%
- Number of Trades: {performance.get('num_trades', 'N/A')}"""

    capital_context = ""
    if capital is not None:
        capital_context = f"\nThe user is considering trading with ${capital:,.2f}."

    prompt = f"""{STRATEGY_AGENT_SYSTEM}

You are the AI agent for the strategy: **{model_name}**
Asset class: {asset_class}
Description: {description}
{perf_summary}
{capital_context}

Strategy code:
```python
{strategy_code or "# Default SMA crossover strategy"}
```

{f"Previous conversation:{history_text}" if history_text else ""}

User: {message}

Respond helpfully and concisely:"""

    response = _get_model().generate_content(prompt)
    return response.text
