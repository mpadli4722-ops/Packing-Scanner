import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "../lib/db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: "ID wajib disertakan!" });
  }

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
    if (!db.deletedLayanan.includes(id as string)) {
      db.deletedLayanan.push(id as string);
    }
    saveDb(db);

    logActivity(db, "admin", `Menghapus jenis layanan: ${lay.name}`);
    return res.json({ message: "Layanan berhasil dihapus" });
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
