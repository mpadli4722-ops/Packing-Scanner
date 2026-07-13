import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, getWIBDateTimeString, logActivity } from "../lib/db";
import { LoginHistory } from "../../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ message: "Username/Email dan Password wajib diisi!" });
  }

  const db = loadDb();
  const user = db.users.find(
    u => (u.username === usernameOrEmail || u.email === usernameOrEmail) && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Username/Email atau Password salah!" });
  }

  if (user.status === "Inactive") {
    return res.status(403).json({ message: "Akun Anda dinonaktifkan. Silakan hubungi Administrator!" });
  }

  const info = getWIBDateTimeString();
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

  const newHistory: LoginHistory = {
    id: `LH${Date.now()}`,
    userName: user.username,
    ip,
    browser: req.headers["user-agent"] || "Chrome/Firefox/Safari",
    waktu: info.full,
    action: "Login"
  };
  db.loginHistory.unshift(newHistory);
  
  logActivity(db, user.username, `Berhasil Login ke sistem`);
  
  return res.json({
    message: "Login Berhasil",
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
}
