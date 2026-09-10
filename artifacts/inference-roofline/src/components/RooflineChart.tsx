import { useMemo } from "react";
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceDot,
  Line,
  ComposedChart
} from "recharts";
import { EstimateResult } from "@workspace/api-client-react";

interface RooflineChartProps {
  estimate: EstimateResult;
  compareEstimate?: EstimateResult | null;
}

export function RooflineChart({ estimate, compareEstimate }: RooflineChartProps) {
  const { 
    gpu, 
    arithmeticIntensity, 
    achievableTflops, 
    ridgePoint, 
    bottleneck 
  } = estimate;

  const data = useMemo(() => {
    // We want to draw the roofline. 
    // Y = min(Max_TFLOPS, X * Bandwidth)
    // Max X can be say 1000, Min X 1.
    const bw = gpu.hbmBandwidthGbS / 1000; // TBytes/s
    const maxTflops = gpu.denseBf16Tflops; // We use dense bf16

    const points = [
      { x: 1, y: bw }, // Y = 1 * bw
      { x: ridgePoint, y: maxTflops },
      { x: 1000, y: maxTflops }
    ];
    
    return points;
  }, [gpu, ridgePoint]);

  const compareData = useMemo(() => {
    if (!compareEstimate) return null;
    const bw = compareEstimate.gpu.hbmBandwidthGbS / 1000;
    const maxTflops = compareEstimate.gpu.denseBf16Tflops;
    return [
      { x: 1, y: bw },
      { x: compareEstimate.ridgePoint, y: maxTflops },
      { x: 1000, y: maxTflops }
    ];
  }, [compareEstimate]);

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis 
            dataKey="x" 
            type="number" 
            scale="log" 
            domain={[1, 1000]} 
            tickFormatter={(val) => val.toString()}
            stroke="#666"
            label={{ value: 'Arithmetic Intensity (FLOPs/Byte)', position: 'insideBottom', offset: -10, fill: '#888', fontSize: 12 }}
          />
          <YAxis 
            dataKey="y" 
            type="number" 
            scale="log" 
            domain={[1, 10000]} 
            stroke="#666"
            label={{ value: 'Performance (TFLOPS)', angle: -90, position: 'insideLeft', offset: 10, fill: '#888', fontSize: 12 }}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
            formatter={(value: number) => value.toFixed(1)}
          />
          <Line 
            type="monotone" 
            dataKey="y" 
            stroke="#00E5FF" 
            strokeWidth={2} 
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {compareData && (
            <Line
              data={compareData}
              type="monotone"
              dataKey="y"
              stroke="#666"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          {compareEstimate && (
            <ReferenceDot
              x={compareEstimate.arithmeticIntensity}
              y={compareEstimate.achievableTflops}
              r={5}
              fill="#444"
              stroke="#888"
              strokeWidth={2}
            />
          )}
          <ReferenceDot 
            x={arithmeticIntensity} 
            y={achievableTflops} 
            r={6} 
            fill={bottleneck === 'memory' ? "#FF0055" : "#00E5FF"} 
            stroke="#fff"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
