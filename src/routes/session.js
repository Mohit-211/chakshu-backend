import express from "express";
import {
  startSession,
  sendMessage,
  endSession,
} from "../controllers/sessionController.js";

const router = express.Router();

router.post("/start", startSession);
router.post("/:id/message", sendMessage);
router.post("/:id/end", endSession);

export default router;
