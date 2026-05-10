export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface FlowSchemaNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface FlowSchemaEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface FlowSchema {
  version: 1;
  metadata?: { title?: string; category?: string; description?: string };
  nodes: FlowSchemaNode[];
  edges: FlowSchemaEdge[];
}

export interface MediaInput {
  url: string;
  type: "image" | "video" | "audio";
}

export interface RunInputs {
  prompts?: Record<number, string>;
  media?: Record<number, MediaInput>;
  model_overrides?: Record<number, Record<string, unknown>>;
}

export interface CreateRunParams {
  flow_id?: string;
  flow_schema?: FlowSchema;
  inputs?: RunInputs;
  idempotency_key?: string;
}

export interface RunRef {
  id: string;
  status: RunStatus;
  created_at: string;
}

export interface Run {
  id: string;
  status: RunStatus;
  current_step: number | null;
  video_url: string | null;
  error_code: string | null;
  error_message: string | null;
  credits_charged: number;
  api_markup_multiplier: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RunListItem {
  id: string;
  status: RunStatus;
  current_step: number | null;
  video_url: string | null;
  error_code: string | null;
  credits_charged: number;
  created_at: string;
  completed_at: string | null;
}

export interface FlowListItem {
  id: string;
  title: string;
  description: string | null;
  updated_at: string;
}

export interface FlowDetail {
  id: string;
  title: string;
  description: string | null;
  flow_schema: FlowSchema;
  required_inputs: Array<{
    step_order: number;
    node_type: string;
    field: "prompt" | "media";
  }>;
}

export interface ListRunsParams {
  limit?: number;
  status?: RunStatus;
}

export interface WaitOptions {
  /** Total wait timeout in milliseconds. Default: 10 minutes. */
  timeoutMs?: number;
  /** Initial poll interval in milliseconds. Default: 4000. */
  pollIntervalMs?: number;
  /** Called on every poll with the latest run state. */
  onUpdate?: (run: Run) => void;
  /** AbortSignal to cancel the wait early. */
  signal?: AbortSignal;
}
