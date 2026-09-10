import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, gpusTable, modelsTable, scenariosTable } from "@workspace/db";
import {
  CreateEstimateBody,
  CreateEstimateResponse,
  CreateScenarioBody,
  CreateScenarioResponse,
  DeleteScenarioParams,
  ListGpusResponse,
  ListModelsResponse,
  ListScenariosResponse,
} from "@workspace/api-zod";
import { estimateInference, type Precision } from "../lib/estimator";

const router: IRouter = Router();

router.get("/gpus", async (_req, res): Promise<void> => {
  const rows = await db.select().from(gpusTable).orderBy(asc(gpusTable.id));
  res.json(ListGpusResponse.parse(rows));
});

router.get("/models", async (_req, res): Promise<void> => {
  const rows = await db.select().from(modelsTable).orderBy(asc(modelsTable.id));
  res.json(ListModelsResponse.parse(rows));
});

router.post("/estimate", async (req, res): Promise<void> => {
  const parsed = CreateEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [[model], [gpu]] = await Promise.all([
    db.select().from(modelsTable).where(eq(modelsTable.id, parsed.data.modelId)),
    db.select().from(gpusTable).where(eq(gpusTable.id, parsed.data.gpuId)),
  ]);
  if (!model || !gpu) {
    res.status(400).json({ error: "Unknown model or GPU" });
    return;
  }
  const result = estimateInference(model, gpu, {
    ...parsed.data,
    precision: parsed.data.precision as Precision,
  });
  res.json(CreateEstimateResponse.parse(result));
});

router.get("/scenarios", async (_req, res): Promise<void> => {
  const rows = await db.select().from(scenariosTable).orderBy(asc(scenariosTable.createdAt));
  res.json(ListScenariosResponse.parse(rows));
});

router.post("/scenarios", async (req, res): Promise<void> => {
  const parsed = CreateScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db.insert(scenariosTable).values(parsed.data).returning();
  res.status(201).json(CreateScenarioResponse.parse(created));
});

router.delete("/scenarios/:id", async (req, res): Promise<void> => {
  const parsed = DeleteScenarioParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [deleted] = await db.delete(scenariosTable).where(eq(scenariosTable.id, parsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;