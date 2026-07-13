import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "../lib/db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: "ID wajib disertakan!" });
  }

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
    if (!db.deletedUsers.includes(id as string)) {
      db.deletedUsers.push(id as string);
    }
    saveDb(db);

    logActivity(db, "admin", `Menghapus user: ${user.username}`);
    return res.json({ message: "User berhasil dihapus!" });
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
