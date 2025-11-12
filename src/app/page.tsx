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
  const roleRef = useRef<"offer" | "answer" | null>(null);
  const secretRef = useRef<number | null>(null);

  useEffect(() => {
    const socket = new WebSocket("wss://cosmic-era5-shogi-server.tubeclip.win/ws");
    setWs(socket);

    socket.onopen = () => setStatus("🛰 接続成功。相手を待っています...");

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data) as Msg;

      if (msg.type === "pair") {
        setRole(msg.role);
        roleRef.current = msg.role;
        setStatus("🎲 対戦開始");

        if (msg.role === "offer") {
          // offer(親)は正解を設定して先手
          const s = Math.floor(Math.random() * 100);
          setSecret(s);
          secretRef.current = s;
          setLogs((l) => [...l, `🎯 あなたが正解を設定しました`, `✅ あなたの先攻です`]);
          socket.send(JSON.stringify({ type: "ready", secret: s }));
          setMyTurn(true); // 親が先攻
        } else {
          // answer(子)は待機
          setLogs((l) => [...l, `⏳ 親が正解を設定中...`]);
          setMyTurn(false);
        }
      }

      else if (msg.type === "ready") {
        // answer側が受け取る: 親の準備完了
        setSecret(msg.secret);
        secretRef.current = msg.secret;
        setLogs((l) => [...l, "🎯 正解が設定されました", "⏳ 親のターンです（待機中）"]);
        setMyTurn(false);
      }

      else if (msg.type === "guess") {
        const guessValue = msg.value;
        setLogs((l) => [...l, `📥 相手の推測: ${guessValue}`]);

        // 正解チェック
        const currentSecret = secretRef.current;
        const currentRole = roleRef.current;
        if (currentSecret !== null && guessValue === currentSecret) {
          // 相手が当てた
          const winner = currentRole === "offer" ? "answer" : "offer";
          socket.send(JSON.stringify({ type: "result", winner, correct: currentSecret }));
          setStatus(`💀 相手が当てました（正解: ${currentSecret}）`);
          setGameOver(true);
          setMyTurn(false);
        } else {
          // はずれ → nextTurnフラグで自分のターンに
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
    
    // 自分で正解を当てた場合
    if (secret !== null && value === secret) {
      ws.send(JSON.stringify({ type: "result", winner: role, correct: secret }));
      setStatus(`🏆 勝ち！ 正解: ${secret}`);
      setGameOver(true);
      setMyTurn(false);
    } else {
      // はずれ → 相手にターンを渡す（nextTurn: trueで通知）
      ws.send(JSON.stringify({ type: "guess", value, nextTurn: true }));
      setLogs((l) => [...l, "❌ はずれ", "⏳ 相手のターンです"]);
      setMyTurn(false);
    }
    
    setInput("");
  };

  const handleRematch = () => {
    window.location.reload();
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
      }}
    >
      <h3 style={{ margin: "0.5rem", fontSize: "1.5rem" }}>🎲 シンプル数当て</h3>
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

      {/* デバッグ用: 正解表示 */}
      {secret !== null && (
        <p style={{ margin: "0.5rem", fontSize: "1.2rem", color: "#ffcc00", fontWeight: "bold" }}>
          🔍 デバッグ: 正解 = {secret}
        </p>
      )}

      <div style={{ margin: "1rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleGuess()}
          placeholder="0〜99"
          disabled={gameOver || !myTurn}
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
          onClick={handleGuess}
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
          送信
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
        style={{
          background: "#16213e",
          border: "1px solid #0f3460",
          borderRadius: "8px",
          padding: "1rem",
          width: "300px",
          height: "200px",
          overflowY: "auto",
          fontSize: "0.85rem",
          marginTop: "1rem",
          lineHeight: "1.5",
        }}
      >
        {logs.join("\n")}
      </pre>
    </main>
  );
}