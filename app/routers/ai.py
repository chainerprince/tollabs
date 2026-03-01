"""
AI router — Gemini-powered strategy explanation, Q&A, and parameter extraction.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.routers.auth import get_current_user
from app.models.user import User
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["AI"])


class ExplainRequest(BaseModel):
    strategy_code: str = ""
    asset: str = "EUR/USD"
    periods: int = 500


class AskRequest(BaseModel):
    strategy_code: str = ""
    question: str
    history: list[dict] | None = None


class ExtractParamsRequest(BaseModel):
    strategy_code: str = ""


class CodeAssistRequest(BaseModel):
    prompt: str
    context: str = ""
    files: list[str] | None = None


class BuildStrategyRequest(BaseModel):
    description: str
    asset: str = "EUR/USD"


@router.post("/explain")
def explain_strategy(
    body: ExplainRequest,
    user: User = Depends(get_current_user),
):
    """Get a Gemini-generated explanation of a trading strategy."""
    explanation = ai_service.explain_strategy(
        body.strategy_code, body.asset, body.periods
    )
    return {"explanation": explanation}


@router.post("/ask")
def ask_about_strategy(
    body: AskRequest,
    user: User = Depends(get_current_user),
):
    """Ask a follow-up question about a strategy via Gemini."""
    answer = ai_service.ask_about_strategy(
        body.strategy_code, body.question, body.history
    )
    return {"answer": answer}


@router.post("/extract-params")
def extract_parameters(
    body: ExtractParamsRequest,
    user: User = Depends(get_current_user),
):
    """Extract tunable parameters from strategy code using Gemini."""
    params = ai_service.extract_parameters(body.strategy_code)
    return params


@router.post("/code-assist")
def code_assist(
    body: CodeAssistRequest,
    user: User = Depends(get_current_user),
):
    """Generate Python code from a natural-language description using Gemini."""
    code = ai_service.code_assist(body.prompt, body.context, body.files)
    return {"code": code}


@router.post("/build-strategy")
def build_strategy(
    body: BuildStrategyRequest,
    user: User = Depends(get_current_user),
):
    """Convert a natural-language strategy description into executable Python code."""
    result = ai_service.build_strategy(body.description, body.asset)
    return result
