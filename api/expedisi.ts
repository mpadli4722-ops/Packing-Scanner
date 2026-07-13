import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, saveDb, logActivity } from "./lib/db";
import { Expedisi } from "../src/db_seeder";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string | undefined;

  if (id) {
    if (req.method === "PUT") {
      const { name, status } = req.body;
      const db = loadDb();

      const idx = db.expedisi.findIndex(e => e.id === id);
      if (idx === -1) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });

      db.expedisi[idx] = {
        ...db.expedisi[idx],
        name: name ?? db.expedisi[idx].name,
        status: status ?? db.expedisi[idx].status
      };
      saveDb(db);

      logActivity(db, "admin", `Mengupdate expedisi: ${db.expedisi[idx].name}`);
      return res.json(db.expedisi[idx]);
    }

    if (req.method === "DELETE") {
      const db = loadDb();
      const exp = db.expedisi.find(e => e.id === id);
      if (!exp) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });

      db.expedisi = db.expedisi.filter(e => e.id !== id);
      if (!db.deletedExpedisi) db.deletedExpedisi = [];
      if (!db.deletedExpedisi.includes(id)) {
        db.deletedExpedisi.push(id);
      }
      saveDb(db);

      logActivity(db, "admin", `Menghapus expedisi: ${exp.name}`);
      return res.json({ message: "Expedisi berhasil dihapus" });
    }

    if (req.method === "GET") {
      const db = loadDb();
      const exp = db.expedisi.find(e => e.id === id);
      if (!exp) return res.status(404).json({ message: "Expedisi tidak ditemukan!" });
      return res.json(exp);
    }

    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (req.method === "GET") {
    const db = loadDb();
    return res.json(db.expedisi);
  }

  if (req.method === "POST") {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Nama Expedisi wajib diisi!" });

    const db = loadDb();
    const newExp: Expedisi = {
      id: `E${(db.expedisi.length + 1).toString().padStart(3, "0")}`,
      name,
      status: "Active"
    };
    db.expedisi.push(newExp);
    saveDb(db);

    logActivity(db, "admin", `Menambahkan expedisi baru: ${name}`);
    return res.status(201).json(newExp);
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}
