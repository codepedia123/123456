/*  Exotel ⇄ Retell bi-directional audio bridge
 *  Author:  ChatGPT demo – 2025-05
 *  ------------------------------------------------------------------
 *  • Listens for WebSocket connections from Exotel’s Voicebot Applet
 *  • Receives ← caller audio chunks (base64-encoded 16-bit-PCM 8 kHz)
 *  • Forwards chunks to Retell AI → gets back response audio
 *  • Sends response audio back to Exotel  → caller hears the agent
 *
 *  DEPLOY:  npm i  &&  npm start
 *  ------------------------------------------------------------------
 */

import { WebSocketServer } from "ws";
import axios from "axios";

// ── CONFIG ──────────────────────────────────────────────────────────
const PORT             = process.env.PORT || 8080;      // Replit listens on env.PORT
const RETELL_API_KEY   = "key_823fb6ed4ca15a1ddd02271f23e7";         // ← PUT YOURS HERE
const RETELL_AGENT_ID  = "agent_3a9288beac4da8ca077021cc9e";               // ← PUT YOURS HERE
// ────────────────────────────────────────────────────────────────────

// Simple logger
const log = (...m) => console.log(new Date().toISOString(), ...m);

// Create WS server
const wss = new WebSocketServer({ port: PORT }, () =>
  log(`🚀  WebSocket bridge running on :${PORT}`)
);

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  log(`📞  Exotel connected  (${ip})`);

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return log("⚠️  Non-JSON frame ignored");
    }

    // We only care about media events coming from Exotel
    if (msg.event !== "media" || !msg.media?.payload) return;

    try {
      // ── 1. Forward caller’s audio chunk to Retell
      const { data: retellRes } = await axios.post(
        "https://api.retellai.com/v2/send-audio",
        {
          agent_id: RETELL_AGENT_ID,
          // Exotel payload is already base64-encoded slin16@8 kHz mono
          audio: msg.media.payload
        },
        {
          headers: {
            Authorization: `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 8000
        }
      );

      // retellRes.audio  → base64-encoded PCM for playback
      if (retellRes?.audio) {
        const reply = {
          event: "media",
          media: { payload: retellRes.audio }
        };
        ws.send(JSON.stringify(reply));
        log("🔊  Sent agent response chunk");
      }
    } catch (err) {
      log("❌  Retell API error:", err.response?.data || err.message);
    }
  });

  ws.on("close", () => log("🔚  Exotel disconnected"));
});
