import type { Gpu, Model } from "@workspace/db";

export type Precision = "fp16" | "bf16" | "fp8" | "int4";

export interface EstimateConfig {
  precision: Precision;
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

function calculatePoint(model: Model, gpu: Gpu, config: EstimateConfig) {
  const bytesPerParameter = PRECISION_BYTES[config.precision];
  const activeParams = (model.isMoe ? model.activeParamsBillions : model.paramsBillions) * 1e9;
  const weightBytes = activeParams * bytesPerParameter;
  const headDim = model.hiddenSize / model.numAttentionHeads;
  const kvCacheBytes =
    2 *
    model.numLayers *
    model.numKvHeads *
    headDim *
    bytesPerParameter *
    (config.inputTokens + config.outputTokens) *
    config.batchSize;
  const peakFlops = gpu.denseBf16Tflops * 1e12;
  const bandwidthBytesPerSecond = gpu.hbmBandwidthGbS * 1e9;
  const prefillFlops = 2 * activeParams * config.inputTokens * config.batchSize;
  const ttftSeconds = prefillFlops / (peakFlops * config.mfu);
  const decodeMemorySeconds = (weightBytes + kvCacheBytes) / bandwidthBytesPerSecond;
  const decodeComputeSeconds = (2 * activeParams * config.batchSize) / (peakFlops * config.mfu);
  const tpotSeconds = Math.max(decodeMemorySeconds, decodeComputeSeconds);
  const arithmeticIntensity =
    (2 * activeParams * config.batchSize) / (weightBytes + kvCacheBytes);
  const ridgePoint = peakFlops / bandwidthBytesPerSecond;
  const bottleneck = arithmeticIntensity < ridgePoint ? "memory" : "compute";
  const totalLatencySeconds = ttftSeconds + tpotSeconds * Math.max(0, config.outputTokens - 1);
  const throughputTokensPerSec =
    (config.batchSize * config.outputTokens) / totalLatencySeconds;
  const costPerMillionTokensUsd =
    ((gpu.hourlyCostUsd / 3600) / throughputTokensPerSec) * 1_000_000;
  const totalMemoryGb = (weightBytes + kvCacheBytes) / 1e9;

  return {
    bytesPerParameter,
    activeParamsBillions: activeParams / 1e9,
    weightMemoryGb: weightBytes / 1e9,
    kvCacheGb: kvCacheBytes / 1e9,
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
    sweep.find((point) => point.bottleneck === "compute")?.batchSize ?? 256;
  const explanation =
    current.bottleneck === "memory"
      ? `At batch size ${config.batchSize}, this GPU spends most of decode waiting on HBM, not calculating. Raising batch size improves utilization until roughly batch ${crossoverBatchSize}.`
      : `At batch size ${config.batchSize}, compute is the decode limit. More memory bandwidth alone will not make this workload faster.`;

  return {
    model,
    gpu,
    precision: config.precision,
    ...current,
    crossoverBatchSize,
    explanation,
    sweep,
  };
}