import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity, pad3 } from "./lib/db";
import { User } from "../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string | undefined;

  if (id) {
    if (req.method === "PUT") {
      const { name, username, email, password, role, status } = req.body;
      const db = loadDb();

      const userIndex = db.users.findIndex(u => u.id === id);
      if (userIndex === -1) {
        return res.status(404).json({ message: "User tidak ditemukan!" });
      }

      const oldUser = db.users[userIndex];
      db.users[userIndex] = {
        ...oldUser,
        name: name ?? oldUser.name,
        username: username ?? oldUser.username,
        email: email ?? oldUser.email,
        password: password ?? oldUser.password,
        role: role ?? oldUser.role,
        status: status ?? oldUser.status
      };

      saveDb(db);
      logActivity(db, "admin", `Mengupdate profil/status user: ${db.users[userIndex].username}`);
      return res.json(db.users[userIndex]);
    }

    if (req.method === "DELETE") {
      const db = loadDb();
      
      const user = db.users.find(u => u.id === id);
      if (!user) return res.status(404).json({ message: "User tidak ditemukan!" });

      db.users = db.users.filter(u => u.id !== id);
      if (!db.deletedUsers) db.deletedUsers = [];
      if (!db.deletedUsers.includes(id)) {
        db.deletedUsers.push(id);
      }
      saveDb(db);

      logActivity(db, "admin", `Menghapus user: ${user.username}`);
      return res.json({ message: "User berhasil dihapus!" });
    }

    if (req.method === "GET") {
      const db = loadDb();
      const user = db.users.find(u => u.id === id);
      if (!user) return res.status(404).json({ message: "User tidak ditemukan!" });
      return res.json(user);
    }

    return res.status(405).json({ message: "Method Not Allowed" });
  }

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
