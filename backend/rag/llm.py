"""LLM access layer.

Order of preference:
  1. LangChain chat model (langchain-openai / langchain-anthropic)  <- default
  2. The provider's own Python SDK (if LangChain isn't installed)
  3. Demo mode: no model is called. Callers must label demo output as such.

OPENAI_BASE_URL lets you point the OpenAI client at any OpenAI-compatible
endpoint (Azure OpenAI, OpenRouter, Groq, a local Ollama server, ...).
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import config

log = logging.getLogger("campussage.llm")


class LLMUnavailable(RuntimeError):
    pass


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str
    latency_ms: int
    via: str                      # "langchain" | "sdk"
    usage: dict | None = None


def provider() -> str:
    return config.resolve_provider()


def model_name() -> str | None:
    p = provider()
    if p == "openai":
        return config.OPENAI_MODEL
    if p == "anthropic":
        return config.ANTHROPIC_MODEL
    return None


def available() -> bool:
    return provider() != "demo"


def _langchain_messages(system: str | None, user: str):
    from langchain_core.messages import HumanMessage, SystemMessage

    msgs = [SystemMessage(content=system)] if system else []
    msgs.append(HumanMessage(content=user))
    return msgs


def _openai(system: str | None, user: str, temperature: float | None) -> tuple[str, str, dict | None]:
    kwargs = {"model": config.OPENAI_MODEL, "api_key": config.OPENAI_API_KEY, "timeout": config.LLM_TIMEOUT_S}
    if config.OPENAI_BASE_URL:
        kwargs["base_url"] = config.OPENAI_BASE_URL
    try:
        from langchain_openai import ChatOpenAI

        if temperature is not None:
            kwargs["temperature"] = temperature
        msg = ChatOpenAI(**kwargs).invoke(_langchain_messages(system, user))
        return msg.content, "langchain", getattr(msg, "usage_metadata", None)
    except ImportError:
        pass
    from openai import OpenAI

    client = OpenAI(api_key=kwargs["api_key"], base_url=kwargs.get("base_url"), timeout=kwargs["timeout"])
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": user}]
    extra = {"temperature": temperature} if temperature is not None else {}
    resp = client.chat.completions.create(model=config.OPENAI_MODEL, messages=messages, **extra)
    usage = resp.usage.model_dump() if getattr(resp, "usage", None) else None
    return resp.choices[0].message.content or "", "sdk", usage


def _anthropic(system: str | None, user: str, temperature: float | None) -> tuple[str, str, dict | None]:
    try:
        from langchain_anthropic import ChatAnthropic

        kwargs = {"model": config.ANTHROPIC_MODEL, "api_key": config.ANTHROPIC_API_KEY,
                  "timeout": config.LLM_TIMEOUT_S, "max_tokens": 800}
        if temperature is not None:
            kwargs["temperature"] = temperature
        msg = ChatAnthropic(**kwargs).invoke(_langchain_messages(system, user))
        content = msg.content if isinstance(msg.content, str) else "".join(
            b.get("text", "") for b in msg.content if isinstance(b, dict))
        return content, "langchain", getattr(msg, "usage_metadata", None)
    except ImportError:
        pass
    import anthropic

    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=config.LLM_TIMEOUT_S)
    extra = {"temperature": temperature} if temperature is not None else {}
    resp = client.messages.create(model=config.ANTHROPIC_MODEL, max_tokens=800, system=system or "",
                                  messages=[{"role": "user", "content": user}], **extra)
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text"), "sdk", None


def generate(system: str | None, user: str, temperature: float | None = None, retries: int = 2) -> LLMResult:
    p = provider()
    if p == "demo":
        raise LLMUnavailable("No LLM API key configured (demo mode).")
    fn = _openai if p == "openai" else _anthropic
    last: Exception | None = None
    for attempt in range(retries + 1):
        t0 = time.perf_counter()
        try:
            text, via, usage = fn(system, user, temperature)
            return LLMResult(text=text, provider=p, model=model_name() or "", via=via,
                             latency_ms=int((time.perf_counter() - t0) * 1000), usage=usage)
        except ImportError as exc:
            raise LLMUnavailable(
                f"Provider '{p}' is configured but its client library is not installed: {exc}") from exc
        except Exception as exc:  # network / rate limit / unsupported parameter
            last = exc
            if temperature is not None and "temperature" in str(exc).lower():
                log.warning("Model rejected temperature=%s; retrying with provider default", temperature)
                temperature = None
                continue
            log.warning("LLM call failed (attempt %d): %s", attempt + 1, exc)
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"LLM call failed after {retries + 1} attempts: {last}")
