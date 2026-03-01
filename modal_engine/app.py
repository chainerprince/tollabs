"""
Modal.com App definition for TOLLABS compute engine.

Deploy with:  modal deploy modal_engine/app.py
Serve (dev):  modal serve modal_engine/app.py
"""

import modal

app = modal.App("tollabs-compute")

# Persistent volume for financial datasets and model weights
volume = modal.Volume.from_name("tollabs-financial-data", create_if_missing=True)

# Container image with financial libraries
image = modal.Image.debian_slim().pip_install(
    "pandas",
    "numpy",
    "scipy",
)
