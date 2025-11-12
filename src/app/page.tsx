"use client";
import { useEffect, useState, useRef } from "react";

type Msg =
  | { type: "pair"; role: "offer" | "answer" }
  | { type: "ready"; secret: number }
  | { type: "guess"; value: number; nextTurn: boolean }
  | { type: "result"; winner: "offer" | "answer"; correct: number };

export default function Page() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [role, setRole] = useState<"offer" | "answer" | null>(null);
  const [status, setStatus] = useState("接続中...");
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [secret, setSecret] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [myTurn, setMyTurn] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const roleRef = useRef<"offer" | "answer" | null>(null);
  const secretRef = useRef<number | null>(null);
  const logContainerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const socket = new WebSocket("wss://simple-guess-p2p-server.riotamoriya.workers.dev/ws");
    setWs(socket);

    socket.onopen = () => setStatus("🛰 接続成功。相手を待っています...");

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data) as Msg;

      if (msg.type === "pair") {
        setRole(msg.role);
        roleRef.current = msg.role;
        setStatus("🎲 対戦開始");

        if (msg.role === "offer") {
          const s = Math.floor(Math.random() * 100);
          setSecret(s);
          secretRef.current = s;
          setLogs((l) => [...l, `🎯 あなたが正解を設定しました`, `✅ あなたの先攻です`]);
          socket.send(JSON.stringify({ type: "ready", secret: s }));
          setMyTurn(true);
        } else {
          setLogs((l) => [...l, `⏳ 親が正解を設定中...`]);
          setMyTurn(false);
        }
      }

      else if (msg.type === "ready") {
        setSecret(msg.secret);
        secretRef.current = msg.secret;
        setLogs((l) => [...l, "🎯 正解が設定されました", "⏳ 親のターンです（待機中）"]);
        setMyTurn(false);
      }

      else if (msg.type === "guess") {
        const guessValue = msg.value;
        setLogs((l) => [...l, `📥 相手の推測: ${guessValue}`]);

        const currentSecret = secretRef.current;
        const currentRole = roleRef.current;
        if (currentSecret !== null && guessValue === currentSecret) {
          const winner = currentRole === "offer" ? "answer" : "offer";
          socket.send(JSON.stringify({ type: "result", winner, correct: currentSecret }));
          setStatus(`💀 相手が当てました（正解: ${currentSecret}）`);
          setGameOver(true);
          setMyTurn(false);
        } else {
          setLogs((l) => [...l, "❌ はずれ"]);
          if (msg.nextTurn) {
            setMyTurn(true);
            setLogs((l) => [...l, "🔄 あなたのターンです"]);
          }
        }
      }

      else if (msg.type === "result") {
        setGameOver(true);
        const youWin = msg.winner === role;
        if (youWin) {
          setStatus(`🏆 勝ち！ 正解: ${msg.correct}`);
        } else {
          setStatus(`💀 負け。正解: ${msg.correct}`);
        }
        setMyTurn(false);
      }
    };

    socket.onerror = () => setStatus("❌ 接続エラー");
    socket.onclose = () => setStatus("🔌 切断されました");

    return () => socket.close();
  }, []);

  const handleGuess = () => {
    if (!ws || gameOver || !myTurn) return;
    const value = parseInt(input);
    if (isNaN(value) || value < 0 || value > 99) {
      alert("0〜99の数字を入力してください");
      return;
    }

    setLogs((l) => [...l, `📤 自分の推測: ${value}`]);
    
    if (secret !== null && value === secret) {
      ws.send(JSON.stringify({ type: "result", winner: role, correct: secret }));
      setStatus(`🏆 勝ち！ 正解: ${secret}`);
      setGameOver(true);
      setMyTurn(false);
    } else {
      ws.send(JSON.stringify({ type: "guess", value, nextTurn: true }));
      setLogs((l) => [...l, "❌ はずれ", "⏳ 相手のターンです"]);
      setMyTurn(false);
    }
    
    setInput("");
    setShowKeyboard(false);
  };

  const handleRematch = () => {
    window.location.reload();
  };

  const showSecret = () => {
    if (secret !== null) {
      alert(`正解: ${secret}`);
    } else {
      alert("正解はまだ設定されていません");
    }
  };

  const handleNumberClick = (num: string) => {
    if (gameOver || !myTurn) return;
    setInput((prev) => prev + num);
  };

  const handleClear = () => {
    setInput("");
  };

  const handleDelete = () => {
    setInput((prev) => prev.slice(0, -1));
  };

  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#1a1a2e",
        color: "#eee",
        fontFamily: "monospace",
        position: "relative",
      }}
    >
      <button
        onClick={showSecret}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          width: "20px",
          height: "20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          opacity: 0.1,
        }}
        title="正解を表示"
      />
      
      <h3 style={{ margin: "0.5rem", fontSize: "1.5rem" }}>🎲 simple-guess</h3>
      <p style={{ margin: "0.5rem", fontSize: "1rem" }}>{status}</p>
      
      {role && (
        <p style={{ margin: "0.25rem", fontSize: "0.9rem", color: "#aaa" }}>
          あなたは: {role === "offer" ? "親（正解設定側）" : "子（推測側）"}
        </p>
      )}

      {!gameOver && (
        <p
          style={{
            margin: "0.5rem",
            fontSize: "1.1rem",
            fontWeight: "bold",
            color: myTurn ? "#4ecca3" : "#ff6b6b",
          }}
        >
          {myTurn ? "✅ あなたのターン" : "⏳ 相手のターン"}
        </p>
      )}

      <div style={{ margin: "1rem" }}>
        <input
          value={input}
          readOnly
          placeholder="0〜99"
          style={{
            width: "6rem",
            padding: "0.5rem",
            textAlign: "center",
            fontSize: "1.2rem",
            background: myTurn ? "#2d2d44" : "#1a1a2e",
            color: "#fff",
            border: myTurn ? "2px solid #4ecca3" : "2px solid #555",
            borderRadius: "4px",
          }}
        />
        <button
          onClick={() => setShowKeyboard(true)}
          disabled={gameOver || !myTurn}
          style={{
            marginLeft: "1rem",
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            background: myTurn ? "#4ecca3" : "#555",
            border: "none",
            color: myTurn ? "#000" : "#888",
            borderRadius: "4px",
            cursor: myTurn ? "pointer" : "not-allowed",
            fontWeight: "bold",
          }}
        >
          キーボード
        </button>
      </div>

      {gameOver && (
        <button
          onClick={handleRematch}
          style={{
            margin: "1rem",
            padding: "0.75rem 1.5rem",
            fontSize: "1.1rem",
            background: "#4ecca3",
            border: "none",
            color: "#000",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          🔄 再戦
        </button>
      )}

      <pre
        ref={logContainerRef}
        style={{
          background: "#16213e",
          border: "1px solid #0f3460",
          borderRadius: "8px",
          padding: "1rem",
          width: "300px",
          height: "120px",
          overflowY: "auto",
          fontSize: "0.85rem",
          marginTop: "0.5rem",
          lineHeight: "1.5",
        }}
      >
        {logs.join("\n")}
      </pre>

      {showKeyboard && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#16213e",
          borderTop: "2px solid #4ecca3",
          padding: "1rem",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          <button
            onClick={() => setShowKeyboard(false)}
            style={{
              alignSelf: "flex-end",
              padding: "0.25rem 0.75rem",
              fontSize: "0.9rem",
              background: "#ff6b6b",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ✕ 閉じる
          </button>
          
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(3, 1fr)", 
            gap: "0.5rem",
            width: "240px",
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                style={{
                  padding: "1rem",
                  fontSize: "1.2rem",
                  background: "#2d2d44",
                  color: "#4ecca3",
                  border: "1px solid #4ecca3",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  width: "100%",
                }}
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              style={{
                padding: "1rem",
                fontSize: "0.9rem",
                background: "#ff6b6b",
                color: "#fff",
                border: "1px solid #ff6b6b",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                width: "100%",
              }}
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick("0")}
              style={{
                padding: "1rem",
                fontSize: "1.2rem",
                background: "#2d2d44",
                color: "#4ecca3",
                border: "1px solid #4ecca3",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                width: "100%",
              }}
            >
              0
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: "1rem",
                fontSize: "0.9rem",
                background: "#ffa500",
                color: "#fff",
                border: "1px solid #ffa500",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                width: "100%",
              }}
            >
              Del
            </button>
          </div>

          <button
            onClick={handleGuess}
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem 2rem",
              fontSize: "1.1rem",
              background: "#4ecca3",
              border: "none",
              color: "#000",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            送信
          </button>
        </div>
      )}
    </main>
  );
}