# Inference Roofline

Inference Roofline is an interactive calculator for estimating LLM serving latency, throughput, GPU memory use, and cost. Select a model, GPU, precision, batch size, sequence lengths, and model FLOPs utilization to see the prefill/decode split and the active roofline bottleneck.

## Run

Use the configured API Server and Inference Roofline web workflows. Run `pnpm run typecheck` for static checks and `pnpm --filter @workspace/api-server test` for estimator tests.

## Assumptions and limitations

This is an analytical roofline estimate, not a benchmark. It assumes dense BF16 peak compute scaled by a user-selected MFU, sustained headline HBM bandwidth, one active parameter read per decode step, and a simplified KV-cache model. It omits kernel launch overhead, communication and tensor-parallel costs, quantization metadata, allocator fragmentation, attention implementation details, speculative decoding, and serving scheduler effects; real systems may differ substantially.