"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  userId: string;
  type: "message" | "join" | "leave" | "system";
  text: string;
  timestamp: number;
};

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [userId] = useState(() => randomId("anon"));
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const connect = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/api/socket`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      setConnected(true);
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ChatMessage;
        setMessages((prev) => [...prev, msg].slice(-500));
      } catch {}
    });

    ws.addEventListener("close", () => {
      setConnected(false);
      // attempt simple reconnect after delay
      setTimeout(() => {
        if (wsRef.current === ws) connect();
      }, 1500);
    });

    ws.addEventListener("error", () => {
      ws.close();
    });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const canSend = useMemo(() => input.trim().length > 0 && connected, [input, connected]);

  const handleSend = useCallback(() => {
    if (!canSend || !wsRef.current) return;
    const payload = {
      type: "message",
      text: input.trim().slice(0, 2000),
      userId,
    };
    wsRef.current.send(JSON.stringify(payload));
    setInput("");
  }, [canSend, input, userId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatCard">
      <div className="statusBar">
        <span className={`dot ${connected ? "on" : "off"}`} /> {connected ? "Connected" : "Disconnected"}
        <span className="spacer" />
        <span className="userId">You: {userId}</span>
      </div>
      <div className="messages" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.type}`}>
            {m.type === "message" ? (
              <>
                <span className="uid">{m.userId}</span>
                <span className="text">{m.text}</span>
                <span className="time">{new Date(m.timestamp).toLocaleTimeString()}</span>
              </>
            ) : (
              <span className="sys">{m.text}</span>
            )}
          </div>
        ))}
      </div>
      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message to everyone..."
          maxLength={2000}
        />
        <button disabled={!canSend} onClick={handleSend}>Send</button>
      </div>
      <p className="hint">Messages are anonymous and visible to all online users.</p>
    </div>
  );
}
