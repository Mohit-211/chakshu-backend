import db from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

export const startSession = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const token = uuidv4();

    const [result] = await db.query(
      "INSERT INTO sessions (name, email, phone, token, status, created_at) VALUES (?, ?, ?, ?, 'active', NOW())",
      [name, email, phone, token]
    );

    res.json({ sessionId: result.insertId, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start session" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { token, message } = req.body;

    // Validate session
    const [rows] = await db.query(
      "SELECT * FROM sessions WHERE id = ? AND token = ? AND status = 'active'",
      [id, token]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: "Invalid session" });

    // Save user message
    await db.query(
      "INSERT INTO messages (session_id, role, message_text, created_at) VALUES (?, 'user', ?, NOW())",
      [id, message]
    );

    // Call GPT-4o-mini
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Petal & Promise's AI assistant. Be polite, warm, and professional.",
          },
          { role: "user", content: message },
        ],
      }),
    }).then((r) => r.json());

    const aiReply = response.choices[0].message.content;

    // Save AI reply
    await db.query(
      "INSERT INTO messages (session_id, role, message_text, created_at) VALUES (?, 'ai', ?, NOW())",
      [id, aiReply]
    );

    res.json({ reply: aiReply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

export const endSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.body;

    await db.query(
      "UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = ? AND token = ?",
      [id, token]
    );

    res.json({ status: "ended" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to end session" });
  }
};
