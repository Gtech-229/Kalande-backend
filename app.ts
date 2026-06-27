import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { AppError } from "./lib/AppError";
import { errorHandler } from "./middlewares/error";
import authRoutes from "./routes/auth.route";
import classRoutes from "./routes/class.route";
import userRoutes from "./routes/user.route";
import studentRoutes from "./routes/student.route";
import operatorClassRoutes from "./routes/operator-class.route";
import attendanceRoutes from "./routes/attendance.route";
import dashboardRoutes from "./routes/dashboard.route";
import messageRoutes from "./routes/message.route";
import docsRoutes from "./routes/docs.route";

const app = express();

// 1. Parse JSON request bodies.
app.use(express.json());

// 2. Parse URL-encoded bodies (form posts).
app.use(express.urlencoded({ extended: true }));

// 3. CORS. "*" allows any origin; otherwise a comma-separated allowlist.
const corsOrigin =
  env.CORS_ORIGIN === "*"
    ? "*"
    : env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
app.use(cors({ origin: corsOrigin }));

// 4. Health check. Infrastructure endpoint — intentionally NOT the standard
//    { success, data } shape (used by load balancers / uptime probes).
app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV });
});

// 5. API router. Domain routes are mounted under /api.
const apiRouter = express.Router();
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/classes", classRoutes);
apiRouter.use("/students", studentRoutes);
apiRouter.use("/operators", operatorClassRoutes);
apiRouter.use("/attendance", attendanceRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/messages", messageRoutes);
app.use("/api", apiRouter);

// 6. API documentation (Swagger UI at /docs, raw spec at /docs/swagger.json).
app.use("/docs", docsRoutes);

// 7. 404 for anything unmatched — forwarded to the error handler so the
//    response keeps the standard error shape.
app.use((_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Route not found"));
});

// 8. Centralized error handler — ALWAYS last.
app.use(errorHandler);

export default app;
