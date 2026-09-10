import { db, gpusTable, modelsTable } from "@workspace/db";

export async function seedCatalog(): Promise<void> {
  await db.insert(gpusTable).values([
    { name: "NVIDIA A100 80GB SXM", hbmBandwidthGbS: 2039, denseBf16Tflops: 312, memoryGb: 80, hourlyCostUsd: 1.8 },
    { name: "NVIDIA H100 SXM", hbmBandwidthGbS: 3350, denseBf16Tflops: 989, memoryGb: 80, hourlyCostUsd: 2.99 },
    { name: "NVIDIA H200 SXM", hbmBandwidthGbS: 4800, denseBf16Tflops: 989, memoryGb: 141, hourlyCostUsd: 3.99 },
    { name: "NVIDIA L40S", hbmBandwidthGbS: 864, denseBf16Tflops: 181, memoryGb: 48, hourlyCostUsd: 1.1 },
  ]).onConflictDoNothing();

  await db.insert(modelsTable).values([
    { name: "Llama-3-8B", paramsBillions: 8, numLayers: 32, hiddenSize: 4096, numAttentionHeads: 32, numKvHeads: 8, isMoe: false, activeParamsBillions: 8 },
    { name: "Llama-3-70B", paramsBillions: 70.6, numLayers: 80, hiddenSize: 8192, numAttentionHeads: 64, numKvHeads: 8, isMoe: false, activeParamsBillions: 70.6 },
    { name: "Qwen2.5-7B", paramsBillions: 7.6, numLayers: 28, hiddenSize: 3584, numAttentionHeads: 28, numKvHeads: 4, isMoe: false, activeParamsBillions: 7.6 },
    { name: "Qwen2.5-32B", paramsBillions: 32.5, numLayers: 64, hiddenSize: 5120, numAttentionHeads: 40, numKvHeads: 8, isMoe: false, activeParamsBillions: 32.5 },
    { name: "Mixtral-8x7B", paramsBillions: 46.7, numLayers: 32, hiddenSize: 4096, numAttentionHeads: 32, numKvHeads: 8, isMoe: true, activeParamsBillions: 12.9 },
  ]).onConflictDoNothing();
}