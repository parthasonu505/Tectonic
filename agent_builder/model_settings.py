"""Which model the Agent Builder runs on: chosen in the Studio, validated, saved to .env, applied live.

The choice covers the Builder and all its specialists (intent, requirements, agent cards, code
generator) and the agent editor. Keys are written to the project .env and never returned in full.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import anthropic

from .shared_libraries.constants import MODEL, PROJECT_ROOT, build_model
from .shared_libraries.studio_model import claude_model_id, is_claude

ENV_PATH: Path = PROJECT_ROOT / ".env"

# Models offered in the Studio (any other model id can be typed in).
CATALOGUE = [
    {"id": "claude-opus-5-5", "provider": "anthropic", "label": "Claude Opus 5.5", "tag": "Recommended",
     "description": "Anthropic's default model: strongest for designing agents and writing their code."},
    {"id": "claude-sonnet-5-5", "provider": "anthropic", "label": "Claude Sonnet 5.5", "tag": "Balanced",
     "description": "Fast and capable for everyday building at half Opus's price."},
    {"id": "claude-haiku-5-5", "provider": "anthropic", "label": "Claude Haiku 5.5", "tag": "Fastest",
     "description": "Lowest cost and latency, for simple agents."},
    {"id": "claude-fable-5-1", "provider": "anthropic", "label": "Claude Fable 5.1", "tag": "Most capable",
     "description": "Anthropic's most capable model, for the hardest designs (premium price, longer turns)."},
    {"id": "gemini-3.6-flash", "provider": "google", "label": "Gemini 3.6 Flash", "tag": "Fast",
     "description": "Google's fast multimodal model."},
    {"id": "gemini-2.5-pro", "provider": "google", "label": "Gemini 2.5 Pro", "tag": "Reasoning",
     "description": "Google's reasoning model."},
    {"id": "gemini-2.5-flash", "provider": "google", "label": "Gemini 2.5 Flash", "tag": "Low latency",
     "description": "Google's low-latency model."},
]
_MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@-]{1,120}$")


class SettingsError(ValueError):
    """The requested settings cannot be applied (nothing was changed)."""


def provider_of(model: str) -> str:
    return "anthropic" if is_claude(model) else "google"


def _hint(key: str) -> str:
    return f"{key[:10]}…{key[-4:]}" if len(key) > 16 else ("set" if key else "")


def _google_key() -> str:
    return os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")


def status() -> dict:
    anthropic_key, google_key = os.getenv("ANTHROPIC_API_KEY", ""), _google_key()
    return {
        "model": MODEL.model, "provider": provider_of(MODEL.model), "catalogue": CATALOGUE,
        "has_anthropic_key": bool(anthropic_key), "anthropic_key_hint": _hint(anthropic_key),
        "has_google_key": bool(google_key), "google_key_hint": _hint(google_key),
    }


def _update_env_file(updates: dict[str, str]) -> None:
    """Set KEY=value lines in .env, keeping every other line (and its order) as it is."""
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.exists() else []
    pending = dict(updates)
    for i, line in enumerate(lines):
        key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
        if key in pending:
            lines[i] = f"{key}={pending.pop(key)}"
    lines += [f"{key}={value}" for key, value in pending.items()]
    tmp = ENV_PATH.with_name(ENV_PATH.name + ".tmp")
    tmp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.replace(tmp, ENV_PATH)


async def _check_claude(model: str, api_key: str) -> None:
    """Confirm the key works and can use the model (a metadata lookup: no tokens are spent)."""
    client = anthropic.AsyncAnthropic(api_key=api_key, max_retries=1, timeout=20.0)
    try:
        await client.models.retrieve(claude_model_id(model))
    except anthropic.AuthenticationError as exc:
        raise SettingsError("Anthropic rejected this API key. Check it in the Anthropic Console (it starts with sk-ant-).") from exc
    except anthropic.PermissionDeniedError as exc:
        raise SettingsError(f"This Anthropic API key is not allowed to use {model}.") from exc
    except anthropic.NotFoundError as exc:
        raise SettingsError(f"{model} is not an Anthropic model this key can use. Pick one from the list.") from exc
    except anthropic.APIConnectionError as exc:
        raise SettingsError("Could not reach the Anthropic API. Check your internet connection.") from exc
    except anthropic.APIStatusError as exc:
        raise SettingsError(f"Anthropic API error {exc.status_code}: {exc.message}") from exc
    finally:
        await client.close()


async def apply(model: str, anthropic_api_key: str | None = None, google_api_key: str | None = None) -> dict:
    """Validate and switch the Builder's model; new keys are saved too. On any error nothing changes."""
    model = (model or "").strip()
    anthropic_api_key = (anthropic_api_key or "").strip() or None
    google_api_key = (google_api_key or "").strip() or None
    if not _MODEL_ID.match(model):
        raise SettingsError("Choose a model (or type a valid model id).")
    if anthropic_api_key and not anthropic_api_key.startswith("sk-ant-"):
        raise SettingsError("That does not look like an Anthropic API key (it starts with sk-ant-).")

    updates: dict[str, str] = {"BUILDER_MODEL": model}
    if anthropic_api_key:
        updates["ANTHROPIC_API_KEY"] = anthropic_api_key
    if google_api_key:
        updates.update(GOOGLE_API_KEY=google_api_key, GEMINI_API_KEY=google_api_key)
    if is_claude(model):
        key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY", "")
        if not key:
            raise SettingsError("Add your Anthropic API key to build with Claude models.")
        await _check_claude(model, key)
    else:
        if not (google_api_key or _google_key()):
            raise SettingsError("Add a Google AI Studio API key to build with Gemini models.")
        updates["GEMINI_MODEL"] = model  # Gemini choices also stay the platform's default Gemini model

    previous = {k: os.environ.get(k) for k in updates}
    os.environ.update(updates)
    try:
        delegate = build_model(model)
        _update_env_file(updates)
    except Exception as exc:
        for key, value in previous.items():  # leave the process exactly as it was
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        raise SettingsError(f"Could not switch to {model}: {exc}") from exc
    MODEL.use(delegate, model)
    return status()
