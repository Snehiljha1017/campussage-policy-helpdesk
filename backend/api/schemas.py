from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(..., max_length=2000)


class FeedbackRequest(BaseModel):
    query_id: int
    rating: int = Field(..., description="+1 helpful, -1 not helpful")
    comment: str | None = Field(None, max_length=1000)


class PromptCreate(BaseModel):
    name: str = Field(..., max_length=120)
    system_prompt: str = Field("", max_length=20000)
    user_template: str = Field(..., max_length=20000)
    temperature: float | None = Field(None, ge=0, le=2)
    base_version: str | None = None
    notes: str = Field("", max_length=4000)


class PreviewRequest(BaseModel):
    version_id: str
    question: str = Field(..., max_length=2000)


class CompareRequest(BaseModel):
    question: str = Field(..., max_length=2000)
    versions: list[str] = Field(default_factory=lambda: ["v1", "v2", "v3"])


class EvalRunRequest(BaseModel):
    configs: list[str] = Field(default_factory=lambda: ["system"])
    repeats: int = Field(1, ge=1, le=5)
    suite: str = Field("main", pattern="^(main|holdout)$")
