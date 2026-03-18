const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();

const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== CONFIG AGORA =====
const APP_ID = "01e63fbd26664ff6a9477931a524c6f5";
const APP_CERTIFICATE = "e7d9e3dfebff4dddb2cdde30534d8784";

// ===== DATABASE =====
const db = new sqlite3.Database("users.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  password TEXT,
  expired_at INTEGER
)
`);

// ===== LOGIN =====
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username=? AND password=?",
    [username, password],
    (err, user) => {
      if (!user) return res.json({ error: "Sai tài khoản" });

      if (Date.now() > user.expired_at) {
        return res.json({ error: "Hết hạn" });
      }

      const channel = "room1";
      const uid = Math.floor(Math.random() * 10000);

      const expireTime = 3600;
      const currentTime = Math.floor(Date.now() / 1000);
      const privilegeExpireTime = currentTime + expireTime;

      const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channel,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpireTime
      );

      res.json({ token, channel, uid });
    }
  );
});

// ===== CREATE USER =====
app.post("/create-user", (req, res) => {
  const { username, password, days } = req.body;

  const expired = Date.now() + days * 86400000;

  db.run(
    "INSERT INTO users (username, password, expired_at) VALUES (?, ?, ?)",
    [username, password, expired]
  );

  res.json({ message: "Đã tạo user" });
});

// ===== EXTEND =====
app.post("/extend", (req, res) => {
  const { username, days } = req.body;

  const add = days * 86400000;

  db.get("SELECT * FROM users WHERE username=?", [username], (err, user) => {
    if (!user) return res.json({ error: "Không tồn tại" });

    const newTime = user.expired_at + add;

    db.run(
      "UPDATE users SET expired_at=? WHERE username=?",
      [newTime, username]
    );

    res.json({ message: "Gia hạn OK" });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server chạy cổng " + PORT);
});