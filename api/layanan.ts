import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "./lib/db";
import { Layanan } from "../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string | undefined;

  if (id) {
    if (req.method === "PUT") {
      const { name, status } = req.body;
      const db = loadDb();

      const idx = db.layanan.findIndex(l => l.id === id);
      if (idx === -1) return res.status(404).json({ message: "Layanan tidak ditemukan!" });

      db.layanan[idx] = {
        ...db.layanan[idx],
        name: name ?? db.layanan[idx].name,
        status: status ?? db.layanan[idx].status
      };
      saveDb(db);

      logActivity(db, "admin", `Mengupdate layanan: ${db.layanan[idx].name}`);
      return res.json(db.layanan[idx]);
    }

    if (req.method === "DELETE") {
      const db = loadDb();
      const lay = db.layanan.find(l => l.id === id);
      if (!lay) return res.status(404).json({ message: "Layanan tidak ditemukan!" });

      db.layanan = db.layanan.filter(l => l.id !== id);
      if (!db.deletedLayanan) db.deletedLayanan = [];
      if (!db.deletedLayanan.includes(id)) {
        db.deletedLayanan.push(id);
      }
      saveDb(db);

      logActivity(db, "admin", `Menghapus jenis layanan: ${lay.name}`);
      return res.json({ message: "Layanan berhasil dihapus" });
    }

    if (req.method === "GET") {
      const db = loadDb();
      const lay = db.layanan.find(l => l.id === id);
      if (!lay) return res.status(404).json({ message: "Layanan tidak ditemukan!" });
      return res.json(lay);
    }

    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (req.method === "GET") {
    const db = loadDb();
    return res.json(db.layanan);
  }

  if (req.method === "POST") {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Nama Layanan wajib diisi!" });

    const db = loadDb();
    const newLay: Layanan = {
      id: `L${(db.layanan.length + 1).toString().padStart(3, "0")}`,
      name,
      status: "Active"
    };
    db.layanan.push(newLay);
    saveDb(db);

    logActivity(db, "admin", `Menambahkan jenis layanan baru: ${name}`);
    return res.status(201).json(newLay);
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
