# hyperclip

Official Node SDK for the [Hyperclip](https://hyperclip.co) API. Trigger flow runs, poll for completion, and pull the final video URL — without writing fetch boilerplate.

## Install

```sh
npm install hyperclip
```

Requires Node 18+ (uses native `fetch`).

## Quickstart

```ts
import { Hyperclip } from "hyperclip";

const hc = new Hyperclip({
  apiKey: process.env.HYPERCLIP_API_KEY,
  baseUrl: "https://YOUR-PROJECT.supabase.co/functions/v1/api-v1",
});

const { id } = await hc.runs.create({
  flow_id: "a3c7f1ea-1234-4abc-bb11-5faed63c7e90",
  inputs: { prompts: { 0: "a lighthouse at dawn" } },
  idempotency_key: crypto.randomUUID(),
});

const run = await hc.runs.wait(id, {
  onUpdate: (r) => console.log(r.status, r.current_step),
});

if (run.status === "completed") {
  console.log("Video:", run.video_url);
} else {
  console.error(run.error_code, run.error_message);
}
```

## Configuration

| Option | Env var | Required |
|---|---|---|
| `apiKey` | `HYPERCLIP_API_KEY` | yes |
| `baseUrl` | `HYPERCLIP_BASE_URL` | yes |
| `fetch` | — | no (defaults to global) |

## API

- `hc.runs.create(params)` — `POST /runs`
- `hc.runs.get(id)` — `GET /runs/:id`
- `hc.runs.list({ limit?, status? })` — `GET /runs`
- `hc.runs.cancel(id)` — `POST /runs/:id/cancel`
- `hc.runs.wait(id, { timeoutMs?, pollIntervalMs?, onUpdate?, signal? })` — polls until terminal
- `hc.flows.list()` — `GET /flows`
- `hc.flows.get(id)` — `GET /flows/:id`

Errors throw `HyperclipError` with `.status` and `.code`. Timeouts throw `HyperclipTimeoutError`.
