import { VercelRequest, VercelResponse } from "@vercel/node";
import { loadDb } from "../lib/db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const db = loadDb();
  return res.json(db.loginHistory);
}
