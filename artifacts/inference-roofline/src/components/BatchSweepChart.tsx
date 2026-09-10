import { useMemo } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { EstimateResult } from "@workspace/api-client-react";

interface BatchSweepChartProps {
  estimate: EstimateResult;
  currentBatchSize: number;
}

export function BatchSweepChart({ estimate, currentBatchSize }: BatchSweepChartProps) {
  const data = useMemo(() => {
    return estimate.sweep.map(p => ({
      batchSize: p.batchSize,
      throughput: p.throughputTokensPerSec,
      cost: p.costPerMillionTokensUsd,
      bottleneck: p.bottleneck,
      fitsInMemory: p.fitsInMemory
    })).filter(p => p.fitsInMemory);
  }, [estimate]);

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis 
            dataKey="batchSize" 
            type="category" 
            stroke="#666"
            label={{ value: 'Batch Size', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 12 }}
          />
          <YAxis 
            yAxisId="left"
            dataKey="throughput"
            stroke="#00E5FF"
            label={{ value: 'Tokens / Sec', angle: -90, position: 'insideLeft', offset: 10, fill: '#00E5FF', fontSize: 12 }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            dataKey="cost"
            stroke="#a855f7"
            label={{ value: 'Cost / 1M Tokens ($)', angle: 90, position: 'insideRight', offset: 10, fill: '#a855f7', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', fontSize: '12px' }}
            formatter={(val: number, name: string) => {
              if (name === "throughput") return [val.toFixed(0), "Tokens/s"];
              if (name === "cost") return [`$${val.toFixed(4)}`, "Cost/1M"];
              return [val, name];
            }}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="throughput" 
            stroke="#00E5FF" 
            strokeWidth={2} 
            dot={false}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="cost" 
            stroke="#a855f7" 
            strokeWidth={2} 
            dot={false}
          />
          <ReferenceLine 
            x={currentBatchSize} 
            stroke="#fff" 
            strokeDasharray="3 3" 
            yAxisId="left"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
