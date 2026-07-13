import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity, pad3 } from "./lib/db";
import { User } from "../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const db = loadDb();
    return res.json(db.users);
  }

  if (req.method === "POST") {
    const { name, username, email, password, role } = req.body;
    if (!name || !username || !email || !password || !role) {
      return res.status(400).json({ message: "Semua kolom wajib diisi!" });
    }

    const db = loadDb();
    // Validasi unik
    const existU = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
    const existE = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());

    if (existU) return res.status(400).json({ message: "Username sudah digunakan!" });
    if (existE) return res.status(400).json({ message: "Email sudah digunakan!" });

    const newUser: User = {
      id: `U${pad3(db.users.length + 1)}`,
      name,
      username,
      email,
      password, // Plain Text!
      role,
      status: "Active"
    };

    db.users.push(newUser);
    saveDb(db);

    logActivity(db, "admin", `Membuat user baru: ${username} (${role})`);
    return res.status(201).json(newUser);
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
