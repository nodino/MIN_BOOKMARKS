## Server Shutdown (Windows executable)

When the application runs as the packaged `min-markers.exe`, a **Shutdown** button appears in the UI (top‑right corner). Clicking it opens a confirmation modal; confirming sends a `POST /api/shutdown` request to the server. The server then stops gracefully after a short delay. This provides a clean way to stop the app without terminating the console manually.
