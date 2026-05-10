class HyperclipError(Exception):
    """Raised when the Hyperclip API returns a non-2xx response."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message

    def __str__(self) -> str:
        return f"[{self.status} {self.code}] {self.message}"


class HyperclipTimeoutError(Exception):
    """Raised when `runs.wait()` exceeds its deadline."""
