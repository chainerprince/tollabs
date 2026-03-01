# ── Load Pre-trained Model ───────────────────────────────────
import torch
import numpy as np
import pandas as pd

MODEL_ID = "amazon/chronos-t5-small"

# Chronos models use a special pipeline
try:
    from chronos import ChronosPipeline
    pipeline = ChronosPipeline.from_pretrained(MODEL_ID, device_map="auto")
    print(f"✓ Loaded Chronos model: {MODEL_ID}")
except ImportError:
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID)
    print(f"✓ Loaded T5-based model: {MODEL_ID}")

print(f"Device: {torch.device('cuda' if torch.cuda.is_available() else 'cpu')}")