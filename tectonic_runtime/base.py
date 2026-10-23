"""The standardized module contract shared by the Builder Agent and every worker agent.

A module exposes named *operations*. Every call goes through ``BaseModule.invoke`` which:
  1. boots the module on first use (``booting`` → ``idle``: the module "spinning up"),
  2. validates the payload against the operation's signature,
  3. emits MODULE_CALL_START / MODULE_CALL_END and busy/idle state transitions,
  4. returns a uniform ``ModuleResult`` envelope — operations never raise to the caller.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import time
import uuid
from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Awaitable, Callable

from .events import ModuleEventBus

OperationFn = Callable[..., Awaitable[Any]]


@dataclass(frozen=True)
class CallContext:
    """Who is calling. ``agent_id`` drives the office visualisation and memory scoping."""

    agent_id: str = "anonymous"
    tenant_id: str = "default"
    session_id: str | None = None


@dataclass
class ModuleResult:
    ok: bool
    module: str
    operation: str
    call_id: str
    duration_ms: float
    data: Any = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": "success" if self.ok else "error",
            "module": self.module,
            "operation": self.operation,
            "call_id": self.call_id,
            "duration_ms": self.duration_ms,
            **({"data": self.data} if self.ok else {"error": self.error}),
        }


@dataclass
class Operation:
    name: str
    fn: OperationFn
    summary: str
    params: list[dict[str, Any]] = field(default_factory=list)


def to_jsonable(value: Any) -> Any:
    """Recursively convert dataclasses/enums/datetimes from module cores into JSON-safe data."""
    if is_dataclass(value) and not isinstance(value, type):
        return to_jsonable(asdict(value))
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(v) for v in value]
    return value


def _short(value: Any, limit: int = 160) -> str:
    text = value if isinstance(value, str) else json.dumps(to_jsonable(value), default=str)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def operation(summary: str) -> Callable[[OperationFn], OperationFn]:
    """Mark a ``async def op(self, ctx, **params)`` method as a public module operation."""

    def mark(fn: OperationFn) -> OperationFn:
        fn.__module_operation__ = summary  # type: ignore[attr-defined]
        return fn

    return mark


_RESERVED = frozenset({"invoke", "boot", "setup", "describe", "summarize", "state", "operations"})


class BaseModule:
    name: str = "module"
    label: str = "Module"
    description: str = ""
    category: str = "core"

    def __init__(self, bus: ModuleEventBus) -> None:
        self._bus = bus
        self._booted = False
        self._boot_lock: asyncio.Lock | None = None
        self._active = 0
        self._total = 0
        self._state = "offline"
        self.operations: dict[str, Operation] = {}
        for attr in dir(type(self)):
            fn = getattr(self, attr)
            summary = getattr(fn, "__module_operation__", None)
            if summary is None:
                continue
            if attr in _RESERVED:
                raise TypeError(f"{type(self).__name__}.{attr}: operation name collides with BaseModule API")
            params = [
                {
                    "name": p.name,
                    "required": p.default is inspect.Parameter.empty,
                    **({} if p.default is inspect.Parameter.empty else {"default": to_jsonable(p.default)}),
                }
                for p in list(inspect.signature(fn).parameters.values())[1:]  # skip ctx
                if p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY)
            ]
            self.operations[attr] = Operation(attr, fn, summary, params)

    # --- lifecycle ---------------------------------------------------------------------------
    async def setup(self) -> None:
        """Build the module's core services and adapters. Override in subclasses."""

    def describe(self) -> dict[str, Any]:
        return {
            "module": self.name,
            "label": self.label,
            "description": self.description,
            "category": self.category,
            "operations": [{"name": o.name, "summary": o.summary, "params": o.params} for o in self.operations.values()],
        }

    @property
    def state(self) -> str:
        return self._state

    def _set_state(self, state: str, detail: str | None = None) -> None:
        self._state = state
        self._bus.emit(
            "MODULE_STATE",
            module=self.name,
            state=state,
            active_calls=self._active,
            total_calls=self._total,
            **({"detail": detail} if detail else {}),
        )

    async def boot(self) -> None:
        if self._booted:
            return
        if self._boot_lock is None:
            self._boot_lock = asyncio.Lock()
        async with self._boot_lock:
            if self._booted:
                return
            self._set_state("booting", "spinning up core services")
            try:
                await self.setup()
            except Exception as exc:
                self._set_state("error", f"boot failed: {exc}")
                raise
            self._booted = True
            self._set_state("idle")

    # --- invocation --------------------------------------------------------------------------
    async def invoke(self, op_name: str, payload: dict[str, Any] | None = None, ctx: CallContext | None = None) -> ModuleResult:
        ctx = ctx or CallContext()
        payload = dict(payload or {})
        call_id = uuid.uuid4().hex[:12]
        started = time.perf_counter()

        op = self.operations.get(op_name)
        if op is None:
            return ModuleResult(False, self.name, op_name, call_id, 0.0,
                                error=f"unknown operation '{op_name}'; available: {sorted(self.operations)}")
        try:
            inspect.signature(op.fn).bind(ctx, **payload)
        except TypeError as exc:
            expected = ", ".join(p["name"] + ("" if p["required"] else "?") for p in op.params)
            return ModuleResult(False, self.name, op_name, call_id, 0.0, error=f"invalid arguments ({exc}); expected: {expected}")

        try:
            await self.boot()
        except Exception as exc:
            return ModuleResult(False, self.name, op_name, call_id, 0.0, error=f"module failed to boot: {exc}")

        self._active += 1
        self._total += 1
        self._set_state("busy", op_name)
        self._bus.emit("MODULE_CALL_START", module=self.name, operation=op_name, call_id=call_id,
                       agent_id=ctx.agent_id, session_id=ctx.session_id, payload=to_jsonable(payload))
        try:
            data = to_jsonable(await op.fn(ctx, **payload))
            ok, error = True, None
        except Exception as exc:
            data, ok, error = None, False, f"{type(exc).__name__}: {exc}"
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        self._active -= 1

        result = ModuleResult(ok, self.name, op_name, call_id, duration_ms, data=data, error=error)
        self._bus.emit("MODULE_CALL_END", module=self.name, operation=op_name, call_id=call_id,
                       agent_id=ctx.agent_id, session_id=ctx.session_id,
                       status="success" if ok else "error", duration_ms=duration_ms,
                       summary=self.summarize(op_name, data) if ok else (error or ""),
                       **({"result": data} if ok else {"error": error}))
        if self._active == 0:
            self._set_state("idle" if ok else "error", None if ok else error)
        return result

    def summarize(self, op_name: str, data: Any) -> str:
        """One-line, human-readable outcome for the office event feed. Override per module."""
        return _short(data)
