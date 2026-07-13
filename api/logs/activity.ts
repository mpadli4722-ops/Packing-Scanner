import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb, logActivity } from "../lib/db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userName, action } = req.body;
  if (!userName || !action) {
    return res.status(400).json({ message: "Username dan Action wajib diisi" });
  }
  
  const db = loadDb();
  logActivity(db, userName, action);
  return res.json({ status: "success" });
}
