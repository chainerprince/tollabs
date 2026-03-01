"""
Modal.com App definition for TOLLABS compute engine.

Deploy with:  modal deploy modal_engine/app.py
Serve (dev):  modal serve modal_engine/app.py
"""

import modal

app = modal.App("tollabs-compute")

# Persistent volume for financial datasets and model weights
volume = modal.Volume.from_name("tollabs-financial-data", create_if_missing=True)

# Container image with financial / ML libraries
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    # Data & numerics
    "pandas",
    "numpy",
    "scipy",
    "scikit-learn",
    # Visualization
    "matplotlib",
    "seaborn",
    # Finance
    "yfinance",
    "ta",
    # Deep learning
    "torch",
    "transformers",
    "datasets",
    # Utilities
    "requests",
    "tqdm",
)
