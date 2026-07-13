import express from "express";
import path from "path";
import loginHandler from "./api/auth/login";
import registerHandler from "./api/auth/register";
import syncHandler from "./api/db/sync";
import statsHandler from "./api/dashboard/stats";
import scansHandler from "./api/scans";
import scansIdHandler from "./api/scans/[id]";
import usersHandler from "./api/users";
import usersIdHandler from "./api/users/[id]";
import expedisiHandler from "./api/expedisi";
import expedisiIdHandler from "./api/expedisi/[id]";
import layananHandler from "./api/layanan";
import layananIdHandler from "./api/layanan/[id]";
import loginHistoryHandler from "./api/logs/login_history";
import activityLogHandler from "./api/logs/activity_log";
import activityHandler from "./api/logs/activity";

const app = express();
const PORT = 3000;

app.use(express.json());

function handle(handler: any) {
  return async (req: any, res: any) => {
    try {
      req.query = { ...req.query, ...req.params };
      await handler(req, res);
    } catch (error) {
      console.error("Error in handler:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
}

// Map endpoints to our Single-Source-of-Truth Vercel handlers
app.post("/api/auth/login", handle(loginHandler));
app.post("/api/auth/register", handle(registerHandler));
app.post("/api/db/sync", handle(syncHandler));
app.get("/api/dashboard/stats", handle(statsHandler));

app.get("/api/scans", handle(scansHandler));
app.post("/api/scans", handle(scansHandler));
app.delete("/api/scans/:id", handle(scansIdHandler));

app.get("/api/users", handle(usersHandler));
app.post("/api/users", handle(usersHandler));
app.put("/api/users/:id", handle(usersIdHandler));
app.delete("/api/users/:id", handle(usersIdHandler));

app.get("/api/expedisi", handle(expedisiHandler));
app.post("/api/expedisi", handle(expedisiHandler));
app.put("/api/expedisi/:id", handle(expedisiIdHandler));
app.delete("/api/expedisi/:id", handle(expedisiIdHandler));

app.get("/api/layanan", handle(layananHandler));
app.post("/api/layanan", handle(layananHandler));
app.put("/api/layanan/:id", handle(layananIdHandler));
app.delete("/api/layanan/:id", handle(layananIdHandler));

app.get("/api/logs/login_history", handle(loginHistoryHandler));
app.get("/api/logs/activity_log", handle(activityLogHandler));
app.post("/api/logs/activity", handle(activityHandler));

// Setup Vite Development Middleware or Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
