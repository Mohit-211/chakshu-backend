import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import sessionRoutes from "./routes/session.js";

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/api/session", sessionRoutes);

export default app;
