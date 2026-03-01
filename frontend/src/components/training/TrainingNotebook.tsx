"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import CodeCell from "@/components/compute/CodeCell";
import { compute, ai } from "@/lib/api";

/* ── Script templates ────────────────────────────────────────── */
const TEMPLATES: { label: string; icon: string; cells: string[] }[] = [
  {
    label: "Fine-tune Chronos (Time-Series)",
    icon: "trending_up",
    cells: [
      `# ── Load & prepare your time-series dataset ──────────────────
import pandas as pd

df = pd.read_csv("workspace/your_data.csv")
print(f"Loaded {len(df)} rows, columns: {list(df.columns)}")
df.head()`,
      `# ── Configure fine-tuning ──────────────────────────────────────
from transformers import AutoModelForCausalLM, TrainingArguments

MODEL_ID  = "amazon/chronos-t5-small"
EPOCHS    = 3
LR        = 5e-5
BATCH     = 8

training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=EPOCHS,
    learning_rate=LR,
    per_device_train_batch_size=BATCH,
    warmup_steps=50,
    weight_decay=0.01,
    logging_steps=10,
    save_strategy="epoch",
)
print("Training config ready ✓")`,
      `# ── Train the model ───────────────────────────────────────────
from transformers import Trainer

# model = AutoModelForCausalLM.from_pretrained(MODEL_ID)
# trainer = Trainer(model=model, args=training_args, train_dataset=dataset)
# trainer.train()
print("🚀 Training would start here (uncomment above lines)")
print("Tip: Use the Training Hub → New Job tab for GPU-accelerated runs")`,
    ],
  },
  {
    label: "Sentiment Fine-tuning (FinBERT)",
    icon: "sentiment_satisfied",
    cells: [
      `# ── Load financial sentiment dataset ──────────────────────────
import pandas as pd

# Example: CSV with 'text' and 'label' columns
# label: 0=negative, 1=neutral, 2=positive
df = pd.read_csv("workspace/sentiment_data.csv")
print(f"Dataset: {len(df)} samples")
print(f"Label distribution:\\n{df['label'].value_counts()}")`,
      `# ── Tokenize & prepare for FinBERT ────────────────────────────
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")

def tokenize(batch):
    return tokenizer(batch["text"], padding="max_length",
                     truncation=True, max_length=128)

# tokenized = dataset.map(tokenize, batched=True)
print("Tokenizer loaded ✓  (vocab size:", tokenizer.vocab_size, ")")`,
      `# ── Fine-tune FinBERT ─────────────────────────────────────────
from transformers import AutoModelForSequenceClassification

model = AutoModelForSequenceClassification.from_pretrained(
    "ProsusAI/finbert", num_labels=3
)
print(f"Model params: {sum(p.numel() for p in model.parameters()):,}")
print("Ready for fine-tuning – configure TrainingArguments & Trainer")`,
    ],
  },
  {
    label: "LoRA Adapter Training",
    icon: "auto_awesome",
    cells: [
      `# ── LoRA (Low-Rank Adaptation) setup ─────────────────────────
# Efficient fine-tuning: only ~0.1% of params are trainable
from peft import LoraConfig, get_peft_model, TaskType

lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                  # rank
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"],
)
print("LoRA config:", lora_config)`,
      `# ── Apply LoRA to base model ─────────────────────────────────
from transformers import AutoModelForCausalLM

BASE_MODEL = "microsoft/phi-2"
# model = AutoModelForCausalLM.from_pretrained(BASE_MODEL)
# peft_model = get_peft_model(model, lora_config)
# peft_model.print_trainable_parameters()
print(f"Base model: {BASE_MODEL}")
print("LoRA reduces trainable params from ~2.7B to ~2.6M")`,
      `# ── Train & save adapter ──────────────────────────────────────
# trainer = Trainer(model=peft_model, args=training_args, ...)
# trainer.train()
# peft_model.save_pretrained("./lora-adapter")
print("After training, save with model.save_pretrained()")
print("Load later: PeftModel.from_pretrained(base_model, './lora-adapter')")`,
    ],
  },
  {
    label: "Custom Evaluation Script",
    icon: "assessment",
    cells: [
      `# ── Evaluate a fine-tuned model ─────────────────────────────
import numpy as np

# Load your fine-tuned model artifact
ARTIFACT = "workspace/models/my_finetuned_model.pt"
print(f"Loading model from: {ARTIFACT}")`,
      `# ── Run predictions on test set ──────────────────────────────
import pandas as pd

# test_df = pd.read_csv("workspace/test_data.csv")
# predictions = model.predict(test_df)

# Simulated metrics
accuracy = 0.87
f1_score = 0.84
print(f"Accuracy: {accuracy:.2%}")
print(f"F1 Score: {f1_score:.2%}")`,
      `# ── Visualize results ──────────────────────────────────────────
# import matplotlib.pyplot as plt
# plt.figure(figsize=(10, 5))
# plt.plot(loss_history, label="Training Loss")
# plt.plot(val_loss_history, label="Validation Loss")
# plt.legend()
# plt.title("Training Curves")
# plt.show()
print("📊 Uncomment matplotlib code to visualize training curves")`,
    ],
  },
];

/* ── Quick prompts for AI code generation ─────────────────────── */
const QUICK_PROMPTS = [
  { label: "Load HuggingFace model", prompt: "Write Python code to load a HuggingFace transformers model and tokenizer for financial text classification using ProsusAI/finbert" },
  { label: "Prepare dataset", prompt: "Write Python code to load a CSV dataset, split it into train/val/test sets, and tokenize it for transformer fine-tuning" },
  { label: "Training loop", prompt: "Write a PyTorch training loop with loss tracking, learning rate scheduling, gradient clipping, and checkpoint saving" },
  { label: "Evaluate model", prompt: "Write Python code to evaluate a classification model computing accuracy, F1, precision, recall, and confusion matrix" },
  { label: "LoRA config", prompt: "Write Python code to set up LoRA (Low-Rank Adaptation) using the peft library for efficient fine-tuning of a large language model" },
  { label: "Export to ONNX", prompt: "Write Python code to export a fine-tuned HuggingFace model to ONNX format for efficient inference" },
];

/* ── Component ────────────────────────────────────────────────── */
interface Cell {
  id: number;
  code: string;
  output?: string;
}

export default function TrainingNotebook() {
  const [cells, setCells] = useState<Cell[]>([
    {
      id: 1,
      code: `# 🧪 Training Code Lab
# Write custom fine-tuning scripts, experiment with models,
# and test training pipelines before submitting GPU jobs.
#
# Quick start: choose a template below or write your own code.
print("Training Code Lab ready ✓")`,
    },
  ]);
  const [running, setRunning] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const nextId = useRef(2);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addCell = useCallback((code = "# New cell\n") => {
    setCells((prev) => [...prev, { id: nextId.current++, code }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  const deleteCell = useCallback((id: number) => {
    setCells((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  }, []);

  const runCell = useCallback(
    async (id: number, code: string) => {
      setRunning(id);
      try {
        const result = await compute.runCell(code, sessionId ?? undefined);
        if (result.session_id) setSessionId(result.session_id);
        const out = [result.stdout, result.result].filter(Boolean).join("\n") || "✓ Done (no output)";
        setCells((prev) =>
          prev.map((c) => (c.id === id ? { ...c, output: result.error || out } : c)),
        );
      } catch (e) {
        setCells((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, output: `Error: ${e instanceof Error ? e.message : "Execution failed"}` } : c,
          ),
        );
      } finally {
        setRunning(null);
      }
    },
    [sessionId],
  );

  const loadTemplate = useCallback(
    (template: (typeof TEMPLATES)[number]) => {
      const newCells = template.cells.map((code) => ({
        id: nextId.current++,
        code,
      }));
      setCells(newCells);
      setShowTemplates(false);
    },
    [],
  );

  const handleAiGenerate = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const { code } = await ai.codeAssist(aiInput, "training fine-tuning financial ML");
      addCell(code);
      setAiInput("");
      setShowAiPrompt(false);
    } catch {
      addCell(`# AI generation failed – write your code manually\n`);
    } finally {
      setAiLoading(false);
    }
  };

  const runAll = async () => {
    for (const cell of cells) {
      await runCell(cell.id, cell.code);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-16rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-t-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={runAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Icon name="play_arrow" className="text-sm" />
            Run All
          </button>
          <button
            onClick={() => addCell()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-medium transition-colors"
          >
            <Icon name="add" className="text-sm" />
            Cell
          </button>
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <span className="text-[10px] text-slate-400 font-mono">
            {cells.length} cell{cells.length !== 1 && "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiPrompt(!showAiPrompt)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              showAiPrompt
                ? "bg-purple-100 text-purple-700 border border-purple-200"
                : "bg-white hover:bg-purple-50 text-slate-600 border border-slate-200 hover:text-purple-600"
            }`}
          >
            <Icon name="auto_awesome" className="text-sm" />
            AI Assist
          </button>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-xs font-medium transition-colors"
          >
            <Icon name="description" className="text-sm" />
            Templates
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-600 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Python 3.11
          </div>
        </div>
      </div>

      {/* AI Prompt bar */}
      {showAiPrompt && (
        <div className="px-4 py-3 bg-purple-50 border-x border-b border-purple-200">
          <div className="flex gap-2 mb-2">
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
              placeholder="Describe the training code you need..."
              className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg bg-white focus:border-purple-400 focus:ring focus:ring-purple-200/50"
            />
            <button
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiInput.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {aiLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Icon name="auto_awesome" className="text-sm" />
                  Generate
                </>
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => {
                  setAiInput(qp.prompt);
                  handleAiGenerate();
                }}
                className="text-[10px] px-2 py-1 bg-white text-purple-600 rounded-full border border-purple-200 hover:bg-purple-100 transition-colors"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template picker */}
      {showTemplates && (
        <div className="px-4 py-3 bg-blue-50 border-x border-b border-blue-200">
          <p className="text-xs text-blue-700 font-medium mb-2">
            <Icon name="lightbulb" className="text-sm align-middle mr-1" />
            Start with a template or write your own script
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => loadTemplate(tpl)}
                className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-colors shrink-0">
                  <Icon name={tpl.icon} className="text-lg" />
                </div>
                <span className="text-xs font-medium text-slate-700 leading-tight">
                  {tpl.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cells */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white border-x border-b border-slate-200 rounded-b-xl">
        {cells.map((cell, idx) => (
          <div key={cell.id} className="relative">
            {/* Light-theme cell wrapper */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-blue-300 transition-colors group">
              {/* Cell header */}
              <div className="h-8 bg-slate-50 flex items-center justify-between px-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    [{running === cell.id ? "*" : idx + 1}]
                  </span>
                  <span className="text-[10px] text-purple-500 font-medium">Python</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => runCell(cell.id, cell.code)}
                    disabled={running === cell.id}
                    className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-green-600 disabled:opacity-40"
                    title="Run Cell (⌘⏎)"
                  >
                    <Icon name="play_arrow" className="text-sm" />
                  </button>
                  <button
                    onClick={() => deleteCell(cell.id)}
                    className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500"
                    title="Delete Cell"
                  >
                    <Icon name="delete" className="text-xs" />
                  </button>
                </div>
              </div>
              {/* Code editor */}
              <textarea
                value={cell.code}
                onChange={(e) =>
                  setCells((prev) =>
                    prev.map((c) => (c.id === cell.id ? { ...c, code: e.target.value } : c)),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    runCell(cell.id, cell.code);
                  }
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    const val = cell.code;
                    const newCode = val.substring(0, start) + "    " + val.substring(end);
                    setCells((prev) =>
                      prev.map((c) => (c.id === cell.id ? { ...c, code: newCode } : c)),
                    );
                  }
                }}
                className="w-full bg-slate-50 text-slate-800 font-mono text-[13px] leading-[20px] p-3 resize-none focus:outline-none min-h-[80px] placeholder:text-slate-300"
                placeholder="# Write your training code here..."
                spellCheck={false}
                rows={cell.code.split("\n").length}
              />
              {/* Output */}
              {(cell.output || running === cell.id) && (
                <div
                  className={`border-t border-slate-200 p-3 ${
                    cell.output?.includes("Error") ? "bg-red-50" : "bg-slate-50"
                  }`}
                >
                  {running === cell.id ? (
                    <div className="flex items-center gap-2 text-blue-600 text-xs">
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Executing...
                    </div>
                  ) : (
                    <pre
                      className={`text-xs font-mono whitespace-pre-wrap leading-relaxed ${
                        cell.output?.includes("Error") ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {cell.output}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />

        {/* Add cell prompt */}
        <button
          onClick={() => addCell()}
          className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-blue-300 hover:text-blue-500 text-xs font-medium transition-colors flex items-center justify-center gap-1"
        >
          <Icon name="add" className="text-sm" />
          Add Cell
        </button>
      </div>
    </div>
  );
}
