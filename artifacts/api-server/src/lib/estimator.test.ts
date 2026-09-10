import { describe, expect, it } from "vitest";
import { estimateInference } from "./estimator";

const a100 = {
  id: 1,
  name: "NVIDIA A100 80GB SXM",
  hbmBandwidthGbS: 2039,
  denseBf16Tflops: 312,
  memoryGb: 80,
  hourlyCostUsd: 1.8,
};

const llama8b = {
  id: 1,
  name: "Llama-3-8B",
  paramsBillions: 8,
  activeParamsBillions: 8,
  numLayers: 32,
  hiddenSize: 4096,
  numAttentionHeads: 32,
  numKvHeads: 8,
  isMoe: false,
};

const baseConfig = {
  precision: "bf16" as const,
  kvPrecision: "bf16" as const,
  batchSize: 1,
  inputTokens: 2048,
  outputTokens: 256,
  mfu: 0.4,
};

describe("estimateInference", () => {
  it("reports the independently known A100 ridge point", () => {
    const result = estimateInference(llama8b, a100, baseConfig);
    expect(result.ridgePoint).toBeCloseTo(153, 0);
  });

  it("keeps every Mixtral expert resident while reading active experts per step", () => {
    const mixtral = {
      ...llama8b,
      name: "Mixtral-8x7B",
      paramsBillions: 46.7,
      activeParamsBillions: 12.9,
      isMoe: true,
    };
    const result = estimateInference(mixtral, a100, baseConfig);
    expect(result.weightMemoryGb).toBeCloseTo(93.4, 5);
    expect(result.weightTrafficPerStepGb).toBeCloseTo(25.8, 5);
    expect(result.fitsInMemory).toBe(false);
  });

  it("reports that Llama-3-70B BF16 weights do not fit in 80 GB", () => {
    const llama70b = {
      ...llama8b,
      name: "Llama-3-70B",
      paramsBillions: 70.6,
      activeParamsBillions: 70.6,
      numLayers: 80,
      hiddenSize: 8192,
      numAttentionHeads: 64,
    };
    const result = estimateInference(llama70b, a100, baseConfig);
    expect(result.weightMemoryGb).toBeCloseTo(141.2, 5);
    expect(result.fitsInMemory).toBe(false);
  });

  it("returns null and explains the plateau when no crossover exists", () => {
    const result = estimateInference(llama8b, a100, baseConfig);
    expect(result.crossoverBatchSize).toBeNull();
    expect(result.explanation).toContain("plateaus");
  });

  it("quantizes weights independently from the KV cache", () => {
    const bf16 = estimateInference(llama8b, a100, baseConfig);
    const int4 = estimateInference(llama8b, a100, {
      ...baseConfig,
      precision: "int4",
    });
    expect(int4.weightMemoryGb).toBe(bf16.weightMemoryGb / 4);
    expect(int4.kvCachePeakGb).toBe(bf16.kvCachePeakGb);
  });
});