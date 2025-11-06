export const runtime = "edge";

// Keep a global set of WebSocket connections per edge instance
const globalAny = globalThis as unknown as {
  __chatClients?: Set<WebSocket>;
};

if (!globalAny.__chatClients) {
  globalAny.__chatClients = new Set<WebSocket>();
}

let nextIdCounter = 1;

function makeMessage(payload: { id?: string; userId: string; type: "message" | "join" | "leave" | "system"; text: string }) {
  return JSON.stringify({ id: payload.id ?? `${Date.now()}_${nextIdCounter++}`, userId: payload.userId, type: payload.type, text: payload.text, timestamp: Date.now() });
}

function sanitize(input: string) {
  const trimmed = input.trim();
  const noCtl = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return noCtl.slice(0, 2000);
}

export async function GET(request: Request) {
  const upgradeHeader = request.headers.get("upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket", { status: 400 });
  }

  // @ts-ignore WebSocketPair is available on edge runtime
  const { 0: client, 1: server } = new WebSocketPair();

  const clients = globalAny.__chatClients!;

  // @ts-ignore
  server.accept();

  // Per-connection simple rate limiter (token bucket)
  let tokens = 8; // burst
  const refillRatePerSec = 1.5; // steady
  let lastRefill = Date.now();

  const userId = `anon_${Math.random().toString(36).slice(2, 8)}`;

  function broadcast(raw: string, except?: WebSocket) {
    for (const ws of clients) {
      if (ws !== except) {
        try {
          // @ts-ignore
          ws.send(raw);
        } catch {}
      }
    }
  }

  clients.add(server);

  // announce join
  broadcast(makeMessage({ userId, type: "join", text: `${userId} joined` }));

  // Message handler
  // @ts-ignore
  server.addEventListener("message", (event: MessageEvent) => {
    try {
      // refill tokens
      const now = Date.now();
      const elapsed = (now - lastRefill) / 1000;
      lastRefill = now;
      tokens = Math.min(12, tokens + elapsed * refillRatePerSec);

      if (tokens < 1) {
        // silently drop to avoid abuse
        return;
      }
      tokens -= 1;

      const data = JSON.parse(String(event.data) || "{}");
      const type = data.type;
      const text = sanitize(String(data.text ?? ""));

      if (type !== "message" || !text) return;

      const msgJson = makeMessage({ userId, type: "message", text });
      broadcast(msgJson);
    } catch {
      // ignore malformed
    }
  });

  // Close handler
  // @ts-ignore
  server.addEventListener("close", () => {
    clients.delete(server);
    broadcast(makeMessage({ userId, type: "leave", text: `${userId} left` }));
  });

  // Heartbeat ping to keep some platforms happy
  const pingInterval = setInterval(() => {
    try {
      // @ts-ignore
      server.send(makeMessage({ userId: "system", type: "system", text: "ping" }));
    } catch {
      clearInterval(pingInterval);
      clients.delete(server);
    }
  }, 30000);

  return new Response(null, { status: 101, webSocket: client });
}
