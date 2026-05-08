import express from "express";
import path from "path";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { exec } from "child_process";

async function startServer() {
  // Prevent console window from instantly closing on fatal errors (like port already in use)
  process.on("uncaughtException", (err) => {
    console.error("\n[CRITICAL ERROR] Le serveur a rencontré un problème :");
    console.error(err.message);
    if ((err as any).code === "EADDRINUSE") {
      console.error("\n=> Le port 3000 est déjà utilisé !");
      console.error("=> Assure-toi qu'aucune autre instance de l'application n'est déjà ouverte.");
    }
    console.error("\nCette fenêtre se fermera automatiquement dans 30 secondes...");
    setTimeout(() => process.exit(1), 30000);
  });

  const app = express();
  const PORT = 3000;

  // Ensure NODE_ENV defaults to "production" when running from a packaged binary
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
  }

  app.use(express.json());

  // ---------------------------------------------------------------------------
  // SSE Event Bus — Companion pushes events, frontend listens via /api/events
  // ---------------------------------------------------------------------------
  type SSEClient = { id: number; res: express.Response };
  const sseClients: SSEClient[] = [];
  let sseClientId = 0;

  function broadcastEvent(event: string, data: Record<string, unknown> = {}) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    console.log(`[SSE] Broadcasting: ${event}`, data);
    for (const client of sseClients) {
      try { client.res.write(payload); } catch (_) { /* client disconnected */ }
    }
  }

  // Frontend subscribes here to receive live events
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const id = ++sseClientId;
    sseClients.push({ id, res });
    console.log(`[SSE] Client connected (id=${id}), total=${sseClients.length}`);

    // Send a heartbeat every 15 s to keep the connection alive
    const heartbeat = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch (_) { /* ignore */ }
    }, 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      const idx = sseClients.findIndex(c => c.id === id);
      if (idx !== -1) sseClients.splice(idx, 1);
      console.log(`[SSE] Client disconnected (id=${id}), total=${sseClients.length}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Companion Webhook Endpoints
  // Configure in Companion → "Generic HTTP" action:
  //   POST http://localhost:3000/api/companion/rec-start
  //   POST http://localhost:3000/api/companion/rec-stop
  // ---------------------------------------------------------------------------
  app.post("/api/companion/rec-start", (req, res) => {
    const timecode: string = (req.body?.timecode as string) || "00:00:00:00";
    console.log("[Companion] REC START received, timecode:", timecode);
    broadcastEvent("rec-start", { timecode });
    res.json({ ok: true, event: "rec-start", timecode });
  });

  app.post("/api/companion/rec-stop", (req, res) => {
    console.log("[Companion] REC STOP received");
    broadcastEvent("rec-stop", {});
    res.json({ ok: true, event: "rec-stop" });
  });

  // Also support GET for easy browser / Companion URL action testing
  app.get("/api/companion/rec-start", (req, res) => {
    const timecode = (req.query.timecode as string) || "00:00:00:00";
    console.log("[Companion] REC START (GET) received, timecode:", timecode);
    broadcastEvent("rec-start", { timecode });
    res.json({ ok: true, event: "rec-start", timecode });
  });

  app.get("/api/companion/rec-stop", (req, res) => {
    console.log("[Companion] REC STOP (GET) received");
    broadcastEvent("rec-stop", {});
    res.json({ ok: true, event: "rec-stop" });
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown endpoint — callable from the UI
  // ---------------------------------------------------------------------------
  app.post("/api/shutdown", (req, res) => {
    console.log("[Server] Shutdown requested from UI");
    res.json({ ok: true, message: "Server shutting down..." });
    setTimeout(() => process.exit(0), 300);
  });

  // ---------------------------------------------------------------------------
  // TriCaster Proxy Endpoint
  // ---------------------------------------------------------------------------
  app.get("/api/tricaster/status", async (req, res) => {
    const { ip } = req.query;
    if (!ip) {
      return res.status(400).json({ error: "IP address is required" });
    }

    try {
      console.log(`[DEBUG] Fetching from http://${ip}/v1/dictionary`);
      const response = await axios.get(`http://${ip}/v1/dictionary`, { timeout: 8000 });
      console.log("[DEBUG] Raw response length:", response.data.length);
      console.log("[DEBUG] First 200 chars:", response.data.substring(0, 200));

      const result = await parseStringPromise(response.data);
      console.log("[DEBUG] Parsed result keys:", Object.keys(result));
      console.log("[DEBUG] Full parsed structure:", JSON.stringify(result, null, 2));

      let dictionary = [];
      if (result.dictionary && result.dictionary.key) {
        console.log("[DEBUG] Found dictionary with keys");
        dictionary = Array.isArray(result.dictionary.key) ? result.dictionary.key : [result.dictionary.key];
      } else {
        console.warn("[WARN] No keys found in dictionary");
      }

      console.log("[DEBUG] Dictionary keys count:", dictionary.length);

      let recording = false;
      let timecode = "00:00:00:00";

      for (const item of dictionary) {
        if (item && item.$) {
          const name = item.$.name;
          const value = item.$.value;
          console.log("[DEBUG] Processing key:", name, "=", value);
          if (name === "recording") recording = value === "true";
          if (name === "timecode") timecode = value;
        }
      }

      console.log("[DEBUG] Final values - Recording:", recording, "Timecode:", timecode);
      res.json({ recording, timecode });
    } catch (error: any) {
      console.error("[ERROR] Proxy request failed:", error.message);
      if (error.response) {
        console.error("[ERROR] Response status:", error.response.status);
        console.error("[ERROR] Response data:", error.response.data?.substring(0, 100) + "...");
      }
      res.status(502).json({
        error: "Could not reach TriCaster",
        message: error.message,
        hint: "Ensure the TriCaster is on the same network and the IP is correct.",
        raw: error.response?.data?.substring(0, 200)
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Static / Vite middleware
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    // Hide the string from `pkg` static analysis by using a variable
    const viteModuleName = "vi" + "te";
    const { createServer: createViteServer } = await import(viteModuleName);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In a pkg binary, __dirname points to the virtual snapshot directory (e.g., /snapshot/project/dist-server)
    // So we need to go up one level to reach the bundled 'dist' folder.
    const baseDir = (process as any).pkg ? path.join(__dirname, "..") : process.cwd();
    const distPath = path.join(baseDir, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const url = `http://localhost:${PORT}`;
    console.log("");
    console.log("╔══════════════════════════════════════╗");
    console.log("║         MIN MARKERS — READY          ║");
    console.log(`║  ➜  ${url.padEnd(32)}║`);
    console.log("╠══════════════════════════════════════╣");
    console.log("║  Companion webhooks:                 ║");
    console.log(`║  POST ${url}/api/companion/rec-start  ║`);
    console.log(`║  POST ${url}/api/companion/rec-stop   ║`);
    console.log("╚══════════════════════════════════════╝");
    console.log("");

    // Auto-open the browser (safe to ignore errors)
    const startCmd = process.platform === 'win32' ? 'start "" "http://localhost:3000"' : 
                     process.platform === 'darwin' ? 'open "http://localhost:3000"' : 
                     'xdg-open "http://localhost:3000"';
    exec(startCmd, (err) => {
      if (err) console.warn("[INFO] Could not open browser automatically:", err.message);
    });
  });
}

startServer();