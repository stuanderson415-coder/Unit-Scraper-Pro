import { Router, type IRouter } from "express";
import multer from "multer";
import { desc, eq } from "drizzle-orm";
import { db, unitHistoryTable } from "@workspace/db";
import {
  LookupUnitBody,
  GetUnitHistoryResponse,
  DeleteHistoryEntryParams,
} from "@workspace/api-zod";
import { scrapeUnit } from "../lib/scraper";
import { parseUnitPdf } from "../lib/pdfParser";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

// POST /api/units/lookup — look up by unit code
router.post("/units/lookup", async (req, res): Promise<void> => {
  const parsed = LookupUnitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { unitCode } = parsed.data;

  try {
    const unit = await scrapeUnit(unitCode);

    // Save to history
    await db.insert(unitHistoryTable).values({
      unitCode: unit.code,
      unitTitle: unit.title,
      source: "code",
    });

    res.json(unit);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    req.log.warn({ unitCode, err }, "Unit lookup failed");
    const status = error.statusCode ?? 500;
    res.status(status).json({ error: error.message ?? "Lookup failed" });
  }
});

// POST /api/units/upload — extract unit from PDF
router.post(
  "/units/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No PDF file uploaded" });
      return;
    }

    try {
      const unit = await parseUnitPdf(req.file.buffer);

      // Save to history
      await db.insert(unitHistoryTable).values({
        unitCode: unit.code,
        unitTitle: unit.title,
        source: "pdf",
      });

      res.json(unit);
    } catch (err: unknown) {
      const error = err as Error;
      req.log.warn({ err }, "PDF parsing failed");
      res.status(400).json({ error: error.message ?? "PDF parsing failed" });
    }
  },
);

// GET /api/units/history — recent lookups
router.get("/units/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(unitHistoryTable)
    .orderBy(desc(unitHistoryTable.lookedUpAt))
    .limit(50);

  const history = rows.map((row) => ({
    id: row.id,
    unitCode: row.unitCode,
    unitTitle: row.unitTitle,
    source: row.source,
    lookedUpAt: row.lookedUpAt.toISOString(),
  }));

  res.json(GetUnitHistoryResponse.parse(history));
});

// DELETE /api/units/history — clear all history
router.delete("/units/history", async (_req, res): Promise<void> => {
  await db.delete(unitHistoryTable);
  res.sendStatus(204);
});

// DELETE /api/units/history/:id — delete single entry
router.delete("/units/history/:id", async (req, res): Promise<void> => {
  const params = DeleteHistoryEntryParams.safeParse({
    id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(unitHistoryTable)
    .where(eq(unitHistoryTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "History entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
