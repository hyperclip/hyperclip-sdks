export class HyperclipError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HyperclipError";
    this.status = status;
    this.code = code;
  }
}

export class HyperclipTimeoutError extends Error {
  constructor(message = "Run polling timed out") {
    super(message);
    this.name = "HyperclipTimeoutError";
  }
}
