import db from "../config/db.js";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

// ✅ Start a new session
export const startSession = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ error: "Name, email, and phone are required" });
    }

    const token = uuidv4();

    const [result] = await db.query(
      "INSERT INTO sessions (name, email, phone, token, status, created_at) VALUES (?, ?, ?, ?, 'active', NOW())",
      [name, email, phone, token]
    );

    res.json({ sessionId: result.insertId, token });
  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ error: "Failed to start session" });
  }
};

// ✅ Send a message + get AI response
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params; // session ID
    const { token, message } = req.body;

    if (!token || !message) {
      return res.status(400).json({ error: "Token and message are required" });
    }

    // Validate session
    const [rows] = await db.query(
      "SELECT * FROM sessions WHERE id = ? AND token = ? AND status = 'active'",
      [id, token]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: "Invalid or inactive session" });
    }

    // Save user message
    await db.query(
      "INSERT INTO messages (session_id, role, message_text, created_at) VALUES (?, 'user', ?, NOW())",
      [id, message]
    );

    // Fetch all previous messages
    const [allMessages] = await db.query(
      "SELECT role, message_text FROM messages WHERE session_id = ? ORDER BY created_at ASC",
      [id]
    );

    const formattedMessages = [
      {
        role: "system",
        content:
          "You are Petal & Promise's matchmaking assistant. Guide applicants step by step. Ask one question at a time, be warm, empathetic, and professional. Keep replies concise.",
      },
      ...allMessages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.message_text,
      })),
    ];

    // Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: formattedMessages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return res.status(500).json({ error: "AI service error" });
    }

    const data = await response.json();
    const aiReply =
      data.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn’t process that. Please try again.";

    // Save AI reply
    await db.query(
      "INSERT INTO messages (session_id, role, message_text, created_at) VALUES (?, 'ai', ?, NOW())",
      [id, aiReply]
    );

    return res.json({ reply: aiReply });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
};

// ✅ End a session
export const endSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const [rows] = await db.query(
      "SELECT * FROM sessions WHERE id = ? AND token = ? AND status = 'active'",
      [id, token]
    );

    if (rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Invalid or already ended session" });
    }

    await db.query(
      "UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = ? AND token = ?",
      [id, token]
    );

    res.json({ status: "ended" });
  } catch (err) {
    console.error("End session error:", err);
    res.status(500).json({ error: "Failed to end session" });
  }
};
