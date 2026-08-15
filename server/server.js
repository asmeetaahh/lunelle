import dotenv from "dotenv";

dotenv.config();

const { default: express } = await import("express");
const { default: cors } = await import("cors");

const { default: healthRouter } = await import("./routes/health.js");
const { default: journalRouter } = await import("./routes/journal.js");
const { default: aiRouter } = await import("./routes/ai.js");

const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/journal", journalRouter);
app.use("/api/ai", aiRouter);

app.get("/", (req, res) => {
  res.json({
    service: "Lunelle Backend",
    status: "running",
  });
});

app.listen(PORT, () => {
  console.log(`🌙 Lunelle backend running on http://localhost:${PORT}`);
});