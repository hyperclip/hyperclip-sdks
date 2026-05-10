# hyperclipco

[![PyPI](https://img.shields.io/pypi/v/hyperclipco.svg)](https://pypi.org/project/hyperclipco/)
[![PyPI downloads](https://img.shields.io/pypi/dm/hyperclipco.svg)](https://pypi.org/project/hyperclipco/)
[![Python versions](https://img.shields.io/pypi/pyversions/hyperclipco.svg)](https://pypi.org/project/hyperclipco/)

Official Python SDK for the [Hyperclip](https://hyperclip.co) API.

> Installed as `hyperclipco` (the unscoped `hyperclip` name was already taken on PyPI). Imports as `hyperclipco`.

## Install

```sh
pip install hyperclipco
```

Requires Python 3.9+.

## Quickstart

```python
import os, uuid
from hyperclipco import Hyperclip

hc = Hyperclip(
    api_key=os.environ["HYPERCLIP_API_KEY"],
    base_url="https://YOUR-PROJECT.supabase.co/functions/v1/api-v1",
)

ref = hc.runs.create(
    flow_id="a3c7f1ea-1234-4abc-bb11-5faed63c7e90",
    inputs={"prompts": {0: "a lighthouse at dawn"}},
    idempotency_key=str(uuid.uuid4()),
)

run = hc.runs.wait(
    ref["id"],
    on_update=lambda r: print(r["status"], r.get("current_step")),
)

if run["status"] == "completed":
    print("Video:", run["video_url"])
else:
    print(run["error_code"], run["error_message"])
```

## Configuration

| Argument | Env var | Required |
|---|---|---|
| `api_key` | `HYPERCLIP_API_KEY` | yes |
| `base_url` | `HYPERCLIP_BASE_URL` | yes |
| `timeout` | — | no (defaults to 30s) |
| `client` | — | no (inject your own `httpx.Client`) |

## API

- `hc.runs.create(flow_id=..., flow_schema=..., inputs=..., idempotency_key=...)`
- `hc.runs.get(run_id)`
- `hc.runs.list(limit=..., status=...)`
- `hc.runs.cancel(run_id)`
- `hc.runs.wait(run_id, timeout=600, poll_interval=4, on_update=...)` — polls until terminal
- `hc.flows.list()`
- `hc.flows.get(flow_id)`

Errors raise `HyperclipError` (with `.status` and `.code`). Timeouts raise `HyperclipTimeoutError`.
