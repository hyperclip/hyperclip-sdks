from __future__ import annotations

import os
import time
from typing import Any, Callable, Mapping, Optional

import httpx

from .errors import HyperclipError, HyperclipTimeoutError

_TERMINAL = {"completed", "failed", "cancelled"}


class Hyperclip:
    """Synchronous client for the Hyperclip REST API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        *,
        timeout: float = 30.0,
        client: Optional[httpx.Client] = None,
    ) -> None:
        api_key = api_key or os.environ.get("HYPERCLIP_API_KEY")
        base_url = base_url or os.environ.get("HYPERCLIP_BASE_URL")
        if not api_key:
            raise ValueError(
                "Hyperclip: missing api_key. Pass api_key= or set HYPERCLIP_API_KEY."
            )
        if not base_url:
            raise ValueError(
                "Hyperclip: missing base_url. Pass base_url= or set HYPERCLIP_BASE_URL "
                "(e.g. https://your-project.supabase.co/functions/v1/api-v1)."
            )
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._http = client or httpx.Client(timeout=timeout)
        self._owns_client = client is None

        self.runs = _Runs(self)
        self.flows = _Flows(self)

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> "Hyperclip":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        merged_headers = {"Authorization": f"Bearer {self._api_key}"}
        if headers:
            merged_headers.update(headers)
        resp = self._http.request(
            method,
            f"{self._base_url}{path}",
            json=json,
            params=params,
            headers=merged_headers,
        )
        try:
            data = resp.json() if resp.text else None
        except ValueError:
            data = None
        if resp.is_error:
            err = (data or {}).get("error", {}) if isinstance(data, dict) else {}
            raise HyperclipError(
                resp.status_code,
                err.get("code", "unknown_error"),
                err.get("message", f"HTTP {resp.status_code}"),
            )
        return data


class _Runs:
    def __init__(self, parent: Hyperclip) -> None:
        self._p = parent

    def create(
        self,
        *,
        flow_id: Optional[str] = None,
        flow_schema: Optional[dict] = None,
        inputs: Optional[dict] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        body: dict[str, Any] = {}
        if flow_id is not None:
            body["flow_id"] = flow_id
        if flow_schema is not None:
            body["flow_schema"] = flow_schema
        if inputs is not None:
            body["inputs"] = inputs
        if idempotency_key is not None:
            body["idempotency_key"] = idempotency_key
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._p._request("POST", "/runs", json=body, headers=headers)

    def get(self, run_id: str) -> dict:
        return self._p._request("GET", f"/runs/{run_id}")

    def list(
        self, *, limit: Optional[int] = None, status: Optional[str] = None
    ) -> list[dict]:
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if status is not None:
            params["status"] = status
        data = self._p._request("GET", "/runs", params=params or None)
        return data.get("runs", [])

    def cancel(self, run_id: str) -> dict:
        return self._p._request("POST", f"/runs/{run_id}/cancel")

    def wait(
        self,
        run_id: str,
        *,
        timeout: float = 600.0,
        poll_interval: float = 4.0,
        on_update: Optional[Callable[[dict], None]] = None,
    ) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            run = self.get(run_id)
            if on_update is not None:
                on_update(run)
            if run.get("status") in _TERMINAL:
                return run
            time.sleep(poll_interval)
        raise HyperclipTimeoutError(f"Run {run_id} did not finish within {timeout}s")


class _Flows:
    def __init__(self, parent: Hyperclip) -> None:
        self._p = parent

    def list(self) -> list[dict]:
        data = self._p._request("GET", "/flows")
        return data.get("flows", [])

    def get(self, flow_id: str) -> dict:
        return self._p._request("GET", f"/flows/{flow_id}")
