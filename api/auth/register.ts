import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity, pad3 } from "../lib/db";
import { User } from "../../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, username, email, password, confirmPassword } = req.body;
  
  if (!name || !username || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: "Semua kolom wajib diisi!" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Konfirmasi password tidak cocok!" });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password minimal harus 8 karakter!" });
  }

  const db = loadDb();

  // Validasi Unik
  const existUsername = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
  const existEmail = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());

  if (existUsername) {
    return res.status(400).json({ message: "Username sudah digunakan!" });
  }
  if (existEmail) {
    return res.status(400).json({ message: "Email sudah digunakan!" });
  }

  const newUser: User = {
    id: `U${pad3(db.users.length + 1)}`,
    name,
    username,
    email,
    password, // Plain text!
    role: "Packing", // Default role
    status: "Active"
  };

  db.users.push(newUser);
  saveDb(db);

  logActivity(db, username, `Mendaftar akun baru dengan Username: ${username}`);

  return res.status(201).json({ message: "Registrasi Berhasil! Silakan login." });
}
