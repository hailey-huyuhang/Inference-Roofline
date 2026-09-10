import type { Gpu, Model } from "@workspace/db";

export type Precision = "fp16" | "bf16" | "fp8" | "int4";
export type KvPrecision = "fp16" | "bf16" | "fp8";

export interface EstimateConfig {
  precision: Precision;
  kvPrecision: KvPrecision;
  batchSize: number;
  inputTokens: number;
  outputTokens: number;
  mfu: number;
}

const PRECISION_BYTES: Record<Precision, number> = {
  fp16: 2,
  bf16: 2,
  fp8: 1,
  int4: 0.5,
};

const KV_PRECISION_BYTES: Record<KvPrecision, number> = {
  fp16: 2,
  bf16: 2,
  fp8: 1,
};

function calculatePoint(model: Model, gpu: Gpu, config: EstimateConfig) {
  const bytesPerParameter = PRECISION_BYTES[config.precision];
  const bytesPerKvElement = KV_PRECISION_BYTES[config.kvPrecision];
  const activeParams = (model.isMoe ? model.activeParamsBillions : model.paramsBillions) * 1e9;
  const totalParams = model.paramsBillions * 1e9;
  const weightBytesResident = totalParams * bytesPerParameter;
  const weightBytesPerStep = activeParams * bytesPerParameter;
  const headDim = model.hiddenSize / model.numAttentionHeads;
  const kvElementsPerToken =
    2 *
    model.numLayers *
    model.numKvHeads *
    headDim *
    config.batchSize;
  const kvCacheBytesPeak =
    kvElementsPerToken *
    bytesPerKvElement *
    (config.inputTokens + config.outputTokens);
  const avgKvTokens = config.inputTokens + config.outputTokens / 2;
  const kvCacheBytesAverage =
    kvElementsPerToken * bytesPerKvElement * avgKvTokens;
  const peakFlops = gpu.denseBf16Tflops * 1e12;
  const bandwidthBytesPerSecond = gpu.hbmBandwidthGbS * 1e9;
  const prefillFlops = 2 * activeParams * config.inputTokens * config.batchSize;
  const ttftSeconds = prefillFlops / (peakFlops * config.mfu);
  const decodeMemorySeconds =
    (weightBytesPerStep + kvCacheBytesAverage) / bandwidthBytesPerSecond;
  const decodeComputeSeconds = (2 * activeParams * config.batchSize) / (peakFlops * config.mfu);
  const tpotSeconds = Math.max(decodeMemorySeconds, decodeComputeSeconds);
  const arithmeticIntensity =
    (2 * activeParams * config.batchSize) /
    (weightBytesPerStep + kvCacheBytesAverage);
  const ridgePoint = peakFlops / bandwidthBytesPerSecond;
  const bottleneck = arithmeticIntensity < ridgePoint ? "memory" : "compute";
  const totalLatencySeconds = ttftSeconds + tpotSeconds * Math.max(0, config.outputTokens - 1);
  const throughputTokensPerSec =
    (config.batchSize * config.outputTokens) / totalLatencySeconds;
  const costPerMillionTokensUsd =
    ((gpu.hourlyCostUsd / 3600) / throughputTokensPerSec) * 1_000_000;
  const totalMemoryGb = (weightBytesResident + kvCacheBytesPeak) / 1e9;

  return {
    bytesPerParameter,
    activeParamsBillions: activeParams / 1e9,
    weightMemoryGb: weightBytesResident / 1e9,
    weightTrafficPerStepGb: weightBytesPerStep / 1e9,
    kvCacheGb: kvCacheBytesPeak / 1e9,
    kvCachePeakGb: kvCacheBytesPeak / 1e9,
    totalMemoryGb,
    freeMemoryGb: Math.max(0, gpu.memoryGb - totalMemoryGb),
    fitsInMemory: totalMemoryGb <= gpu.memoryGb,
    prefillFlops,
    ttftSeconds,
    decodeMemorySeconds,
    decodeComputeSeconds,
    tpotSeconds,
    totalLatencySeconds,
    throughputTokensPerSec,
    costPerMillionTokensUsd,
    arithmeticIntensity,
    ridgePoint,
    achievableTflops: Math.min(peakFlops, arithmeticIntensity * bandwidthBytesPerSecond) / 1e12,
    bottleneck,
  } as const;
}

export function estimateInference(model: Model, gpu: Gpu, config: EstimateConfig) {
  const current = calculatePoint(model, gpu, config);
  const sweep = Array.from({ length: 256 }, (_, index) => {
    const batchSize = index + 1;
    const point = calculatePoint(model, gpu, { ...config, batchSize });
    return {
      batchSize,
      throughputTokensPerSec: point.throughputTokensPerSec,
      costPerMillionTokensUsd: point.costPerMillionTokensUsd,
      arithmeticIntensity: point.arithmeticIntensity,
      bottleneck: point.bottleneck,
      fitsInMemory: point.fitsInMemory,
    };
  });
  const crossoverBatchSize =
    sweep.find((point) => point.bottleneck === "compute")?.batchSize ?? null;
  const explanation =
    current.bottleneck === "compute"
      ? `At batch size ${config.batchSize}, compute is the decode limit. More memory bandwidth alone will not make this workload faster.`
      : crossoverBatchSize
        ? `At batch size ${config.batchSize}, decode is waiting on HBM, not calculating. Raising batch size improves utilization until roughly batch ${crossoverBatchSize}.`
        : `At batch size ${config.batchSize}, decode is memory-bound, and stays memory-bound at every batch size up to 256 — the KV cache grows with the batch, so arithmetic intensity plateaus around ${current.arithmeticIntensity.toFixed(0)} FLOPs/byte, well below this GPU's ridge point of ${current.ridgePoint.toFixed(0)}.`;

  return {
    model,
    gpu,
    precision: config.precision,
    kvPrecision: config.kvPrecision,
    ...current,
    crossoverBatchSize,
    explanation,
    sweep,
  };
}