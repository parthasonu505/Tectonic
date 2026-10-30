"""Single source of truth for the model, filesystem paths and environment lookups."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Suppress ADK advisory notice for LiteLLM
os.environ["ADK_SUPPRESS_GEMINI_LITELLM_WARNINGS"] = "true"

PACKAGE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = PACKAGE_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

# --- Model & Environment --------------------------------------------------
# Support Google Agent Builder Platform API Key (AQ.* format) and standard Gemini API keys
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
if GOOGLE_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
    os.environ["GEMINI_API_KEY"] = GOOGLE_API_KEY

import litellm

# Configure global LiteLLM resilience for high demand spikes (HTTP 503 / 429)
litellm.num_retries = 5
litellm.request_timeout = 90

# Default model - use gemini-3.8-flash (latest available model)
RAW_MODEL_NAME = os.getenv("GEMINI_MODEL", os.getenv("MODEL_NAME", "gemini-3.8-flash"))


def resolve_model_name(raw_name: str) -> str:
    """Normalize model string to provider format for LiteLLM generalization."""
    if not raw_name:
        return "gemini-3.8-flash"
    clean = raw_name.strip()
    # For native Gemini model, don't add gemini/ prefix
    if "/" in clean:
        # Extract just the model name for native Gemini
        return clean.split("/")[-1]
    return clean


def resolve_litellm_model_name(raw_name: str) -> str:
    """Normalize model string to provider format for LiteLLM."""
    if not raw_name:
        return "gemini/gemini-3.8-flash"
    clean = raw_name.strip()
    if "/" in clean:
        return clean
    if clean.startswith("gemini"):
        return f"gemini/{clean}"
    return clean


MODEL_NAME = resolve_model_name(RAW_MODEL_NAME)
MODEL_ID = MODEL_NAME


def _is_aq_key(api_key: str) -> bool:
    """Check if the API key is an AQ. (Authentication Key) format from Google AI Studio."""
    return api_key and api_key.startswith("AQ.")


def build_model(model_name: str = None):
    """Create model wrapper used by every agent.
    
    Uses native Google Gemini model for AQ.* keys (Authentication Keys from Google AI Studio)
    which work better with the native SDK. Falls back to LiteLLM for other key formats.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    target_model = resolve_model_name(model_name or MODEL_NAME)
    
    # For AQ. keys (new Google AI Studio Authentication Keys), use native Gemini model
    # These keys work best with the native google-genai SDK, not LiteLLM's OpenAI-compatible route
    if _is_aq_key(api_key):
        from google.adk.models.google_llm import Gemini
        return Gemini(model=target_model)
    
    # For standard API keys (AIza*), use LiteLLM wrapper
    from google.adk.models.lite_llm import LiteLlm
    litellm_model = resolve_litellm_model_name(model_name or RAW_MODEL_NAME)
    
    kwargs = {
        "model": litellm_model,
        "num_retries": 5,
    }
    
    # Pass API key for Gemini models
    if api_key and "gemini" in litellm_model.lower():
        kwargs["api_key"] = api_key
    
    return LiteLlm(**kwargs)


MODEL = build_model()


# --- Paths ---------------------------------------------------------------
def _resolve_dir(env_name: str, default: Path) -> Path:
    raw = os.getenv(env_name)
    if not raw:
        return default.resolve()
    path = Path(raw).expanduser()
    return (path if path.is_absolute() else PROJECT_ROOT / path).resolve()


PROFILES_DIR = PACKAGE_DIR / "profiles"
OUTPUT_DIR = _resolve_dir("AGENT_BUILDER_OUTPUT_DIR", PROJECT_ROOT / "generated_agents")
LOG_DIR = _resolve_dir("AGENT_BUILDER_LOG_DIR", PROJECT_ROOT / "logs")
REGISTRY_DIR_NAME = "_registry"
SESSIONS_DIR_NAME = "_sessions"
EDITS_DIR_NAME = "_edits"  # per-project history of conversational edits (what undo restores)

# --- Session state keys --------------------------------------------------
STATE_INTENT = "intent"
STATE_REQUIREMENTS = "requirements"
STATE_GUARDRAIL_REPORT = "guardrail_report"
STATE_GUARDRAIL_HISTORY = "guardrail_history"
STATE_AGENT_CARDS = "agent_cards"
STATE_PROJECT_NAME = "project_name"
STATE_GENERATED_FILES = "generated_files"
STATE_NOTES = "notes"
STATE_VERIFICATION = "verification"
STATE_PENDING_DECISIONS = "pending_decisions"  # structured select-cards awaiting the user (read by the Studio UI)
STATE_DECISIONS = "decisions_answered"  # every decision the user has made, keyed by question id
STATE_DECISION_ROUND = "decision_round"
STATE_RESEARCH = "design_research"
STATE_BUILD_RECORD = "build_record"
STATE_INTERVIEW = "interview"  # {"index", "completed", "approved", "return_to_compile"}: the guided interview position
STATE_ARCH_SPEC = "architecture_spec"  # compiled Agent Architecture Specification (lead prompt, roles, JSON config)
STATE_BUILD_PHASE = "build_phase"  # current pipeline phase, mirrored to the Studio's journey stepper

# Keys the orchestrator may write through save_progress (the guardrail verdict
# is deliberately excluded: only the guardrails sub-agent can record it).
PROGRESS_KEYS = (
    STATE_INTENT,
    STATE_REQUIREMENTS,
    STATE_PROJECT_NAME,
    STATE_NOTES,
)

# --- Local-only enforcement ---------------------------------------------
FORBIDDEN_FILENAMES = (
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".dockerignore",
    "cloudbuild.yaml",
    "app.yaml",
    "procfile",
    ".gitlab-ci.yml",
    "deploy.py",
)
FORBIDDEN_PATH_PARTS = (
    ".github",
    ".ipynb_checkpoints",
    "__pycache__",
    ".pytest_cache",
    "terraform",
    "helm",
    "k8s",
    "kubernetes",
)
FORBIDDEN_SUFFIXES = (".tf", ".tfvars", ".ipynb")
ALLOWED_WRITE_SUFFIXES = (".py", ".json", ".txt", ".md", ".example", ".env", ".gitkeep")
