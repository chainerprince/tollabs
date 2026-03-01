# TOLLABS — Hackathon Demo Video Script

> **Runtime target:** 3–4 minutes
> **Tone:** Confident, technical, slightly cinematic
> **Format:** Screen recording with voiceover. Cut between browser views.

---

## 🎬 COLD OPEN (0:00 – 0:15)

**[SCREEN: Black → TOLLABS logo fades in → tagline animates beneath it]**

**VOICEOVER:**

> "What if the best trading algorithms in the world weren't locked behind hedge fund doors — but available to anyone with a wallet and a thesis?"
>
> "This is **TOLLABS** — where quant meets AI."

---

## ACT 1 — THE RESEARCHER (0:15 – 1:30)

**[SCREEN: Login page → click "Alice (Researcher)" demo button → dashboard loads]**

**VOICEOVER:**

> "Let's start with Alice. She's a quant researcher. Her job is to build strategies, backtest them, and deploy them to the marketplace."

**[SCREEN: Researcher Dashboard → Backtest Lab tab]**

> "This is the Backtest Lab. Alice can write strategy code directly — or, she can describe what she wants in plain English."

**[SCREEN: Click "NL Strategy Builder" tab → type: "Build a mean reversion strategy on forex with 20-period Bollinger Bands and RSI confirmation" → click Generate]**

> "Behind the scenes, we send this to **Google Gemini 2.5 Flash**, which generates production-grade Python — complete with entry logic, exit rules, and risk parameters."

**[SCREEN: Show generated code appearing → click "Run Backtest"]**

> "One click, and the strategy runs against simulated market data. We get a full performance report — Sharpe ratio, max drawdown, win rate, trade-by-trade breakdown."

**[SCREEN: Show backtest results with metrics grid + equity curve]**

> "Happy with the results? Alice can open this strategy directly in our **Cloud Notebook** — a full Colab-like environment where the code is automatically split into executable cells."

**[SCREEN: Click "Open in Notebook" → Compute page loads with cells]**

> "She can tweak parameters, run cells with Command-Enter, and use the **AI Code Assistant** on the right to ask questions or generate helper functions."

**[SCREEN: Show AI Assist panel → type a question → get response]**

> "When Alice is ready, she deploys her strategy to the **TOLLABS Marketplace** — where subscribers can discover it."

**[SCREEN: Researcher Dashboard → click Deploy on a model → show "Live" badge]**

---

## ACT 2 — THE INFRASTRUCTURE (1:30 – 2:15)

**[SCREEN: Architecture diagram or animated graphic overlay]**

**VOICEOVER:**

> "Now let's talk about what's happening under the hood."
>
> "When a researcher submits a training job — say, fine-tuning a language model on financial data — we dispatch that to **Modal.com**."

**[SCREEN: Training Hub → show TrainingForm → submit a job → JobMonitor with progress bar and loss curve]**

> "Modal gives us **serverless GPUs on demand**. No provisioning. No idle costs. The job spins up, trains with LoRA adapters, and writes the artifact back — all orchestrated through our backend."

> "The same infrastructure powers our **AI inference layer**. When a subscriber asks a question about a strategy — 'What's the risk profile?' or 'How does this handle volatile markets?' — we don't just do a keyword lookup."

**[SCREEN: Trading Portal → Strategy Agent chat → type a question]**

> "We run inference through Gemini, grounded on the **actual strategy source code**, the model's live performance metrics, and the user's capital context. The agent doesn't hallucinate — it reasons over real data."

**[SCREEN: Show agent responding with specific numbers from the strategy]**

> "This is the power of combining **Modal's compute** with **Gemini's reasoning** — real-time, context-aware financial AI."

---

## ACT 3 — THE SUBSCRIBER (2:15 – 3:15)

**[SCREEN: Login page → click "Charlie (Subscriber)" demo button → Marketplace loads]**

**VOICEOVER:**

> "Now meet Charlie. He's a subscriber — someone who wants algorithmic returns without writing a single line of code."

**[SCREEN: Marketplace → browse model cards → show the "Subscribed" badge on one]**

> "Charlie browses the marketplace, sees Alice's strategy — win rate, Sharpe ratio, subscriber count — all transparent."

> "He subscribes with one click."

**[SCREEN: Click Subscribe → button changes to ✓ Subscribed → navigate to strategy detail page]**

> "Now he's on the Strategy Detail page. He can see the live PnL chart, performance stats, and — most importantly — his **Investment Capital** panel."

**[SCREEN: Strategy detail page → click "Add Capital" → modal opens → type $10,000 → click Fund Wallet]**

> "Charlie funds his wallet with ten thousand dollars. This is mocked for the demo, but the flow mirrors a real brokerage integration."

**[SCREEN: Balance updates to $10,000 → click "Open Trading Portal"]**

> "He opens the **Trading Portal** — and this is where it gets interesting."

**[SCREEN: Trade page → Strategy Agent tab → type "How much should I allocate for a conservative approach?"]**

> "Charlie can chat with the **Strategy Agent** — an AI trained on Alice's exact strategy code. It recommends allocation, explains risk, and answers follow-up questions."

**[SCREEN: Configure tab → set $5,000 capital → click Configure Trade → Summary card appears]**

> "He configures a trade — five thousand dollars. The system generates a full trade summary: estimated risk, profit share split, strategy overview."

**[SCREEN: Click "Execute Trade" → Trade Result card with PnL, profit sharing breakdown]**

> "One click to execute. The mock trading engine simulates the strategy against 200 price bars, computes PnL, and **automatically settles profit sharing**."

> "Alice — the researcher — gets her 20% cut. TOLLABS takes a 10% commission. And Charlie keeps the rest. All transparent. All automatic."

**[SCREEN: Profit Sharing tab → show the breakdown table]**

---

## 🎬 CLOSING (3:15 – 3:45)

**[SCREEN: Fade to black → TOLLABS logo center screen]**

**VOICEOVER (slower, cinematic):**

> "Researchers build. Subscribers invest. AI reasons. Infrastructure scales."
>
> "No gatekeepers. No black boxes. Just algorithms, capital, and trust — connected by code."

**[SCREEN: Tagline animates in below logo]**

> **"TOLLABS — Democratizing Alpha, One Algorithm at a Time."**

**[SCREEN: Hold for 3 seconds → fade to black]**

**[TEXT CARD:]**

```
Built at UIUC — 2026
FastAPI · Next.js 14 · Gemini 2.5 Flash · Modal.com
github.com/tollabs
```

---

## 📝 Production Notes

| Element | Detail |
|:--------|:-------|
| **Recording tool** | OBS / Loom / QuickTime |
| **Resolution** | 1920×1080, 60fps |
| **Browser** | Chrome, dark mode disabled, zoom 100% |
| **Music** | Subtle lo-fi or cinematic ambient (Artlist / Epidemic Sound) |
| **Transitions** | Simple crossfades between sections, no flashy effects |
| **Demo accounts** | Alice = `alice@tollabs.io`, Charlie = `charlie@gmail.com`, password: `password123` |
| **Pre-recording checklist** | Run `python -m app.utils.seed` fresh, clear browser cache, fund Charlie's wallet to $0 before recording so the "Add Capital" moment is clean |

---

## 🏷️ Social Captions

**Primary (for submission):**
> 🧠 TOLLABS — Democratizing Alpha, One Algorithm at a Time.
> AI-powered quant trading infrastructure connecting researchers who build strategies with investors who deploy capital. Built with FastAPI, Next.js, Gemini AI & Modal.com.

**Short (Twitter/X):**
> What if anyone could access hedge-fund-grade algorithms?
> Meet TOLLABS — where quant researchers deploy, subscribers invest, and AI handles the rest. 🚀
> #Hackathon #QuantTrading #AI #NextJS #FastAPI

**LinkedIn:**
> Excited to share TOLLABS — a full-stack AI trading infrastructure platform we built at UIUC.
>
> 🔬 Researchers build & backtest strategies with natural language
> 💰 Subscribers deploy capital with AI-guided trade execution
> ⚡ Modal.com powers serverless GPU training & inference
> 🤖 Gemini 2.5 Flash reasons over live strategy code
>
> Democratizing Alpha, One Algorithm at a Time.
