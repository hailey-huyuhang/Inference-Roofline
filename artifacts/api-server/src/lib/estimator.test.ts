import { describe, expect, it } from "vitest";
import { estimateInference } from "./estimator";

const model = { id: 1, name: "Test 8B", paramsBillions: 8, activeParamsBillions: 8, numLayers: 32, hiddenSize: 4096, numAttentionHeads: 32, numKvHeads: 8, isMoe: false };
const gpu = { id: 1, name: "Test GPU", hbmBandwidthGbS: 2000, denseBf16Tflops: 300, memoryGb: 80, hourlyCostUsd: 2 };

describe("estimateInference", () => {
  it("computes weight and KV memory independently", () => {
    const result = estimateInference(model, gpu, { precision: "bf16", batchSize: 1, inputTokens: 2048, outputTokens: 256, mfu: 0.4 });
    expect(result.weightMemoryGb).toBe(16);
    expect(result.kvCacheGb).toBeGreaterThan(0);
    expect(result.totalMemoryGb).toBeCloseTo(result.weightMemoryGb + result.kvCacheGb);
  });

  it("takes the max of memory and compute decode times", () => {
    const result = estimateInference(model, gpu, { precision: "bf16", batchSize: 4, inputTokens: 1024, outputTokens: 128, mfu: 0.4 });
    expect(result.tpotSeconds).toBe(Math.max(result.decodeMemorySeconds, result.decodeComputeSeconds));
  });

  it("reduces weight memory with int4", () => {
    const fp16 = estimateInference(model, gpu, { precision: "fp16", batchSize: 1, inputTokens: 1, outputTokens: 1, mfu: 0.4 });
    const int4 = estimateInference(model, gpu, { precision: "int4", batchSize: 1, inputTokens: 1, outputTokens: 1, mfu: 0.4 });
    expect(int4.weightMemoryGb).toBe(fp16.weightMemoryGb / 4);
  });
});