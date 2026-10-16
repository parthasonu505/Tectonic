"""Single source of truth for the model, filesystem paths and environment lookups."""

import os
from pathlib import Path

from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm

# Suppress ADK advisory notice for LiteLLM
os.environ["ADK_SUPPRESS_GEMINI_LITELLM_WARNINGS"] = "true"

PACKAGE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = PACKAGE_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

# --- Model & Environment --------------------------------------------------
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
if GOOGLE_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
    os.environ["GEMINI_API_KEY"] = GOOGLE_API_KEY

import litellm

# Configure global LiteLLM resilience for high demand spikes (HTTP 503 / 429)
litellm.num_retries = 5
litellm.request_timeout = 90

RAW_MODEL_NAME = os.getenv("GEMINI_MODEL", os.getenv("MODEL_NAME", "gemini-3.8-flash"))


def resolve_model_name(raw_name: str) -> str:
    """Normalize model string to provider format for LiteLLM generalization."""
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


def build_model(model_name: str = None) -> LiteLlm:
    """Create generalized LiteLlm model wrapper used by every agent."""
    target_model = resolve_model_name(model_name or MODEL_NAME)
    kwargs = {
        "model": target_model,
        "num_retries": 5,
    }
    api_key = os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    if api_key and "gemini" in target_model:
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

# --- Session state keys --------------------------------------------------
STATE_INTENT = "intent"
STATE_REQUIREMENTS = "requirements"
STATE_GUARDRAIL_REPORT = "guardrail_report"
STATE_GUARDRAIL_HISTORY = "guardrail_history"
STATE_AGENT_CARDS = "agent_cards"
STATE_PROJECT_NAME = "project_name"
STATE_GENERATED_FILES = "generated_files"
STATE_NOTES = "notes"

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
