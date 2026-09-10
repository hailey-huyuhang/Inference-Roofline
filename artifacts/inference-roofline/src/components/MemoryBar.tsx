import { cn } from "@/lib/utils";

interface MemoryBarProps {
  weightsGb: number;
  kvCacheGb: number;
  capacityGb: number;
  className?: string;
}

export function MemoryBar({ weightsGb, kvCacheGb, capacityGb, className }: MemoryBarProps) {
  const freeGb = Math.max(0, capacityGb - weightsGb - kvCacheGb);
  const weightsPct = (weightsGb / capacityGb) * 100;
  const kvPct = (kvCacheGb / capacityGb) * 100;
  
  const fits = weightsGb + kvCacheGb <= capacityGb;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>0GB</span>
        <span>{capacityGb}GB</span>
      </div>
      
      <div className="h-4 w-full rounded-full bg-secondary overflow-hidden flex relative">
        <div 
          className="bg-primary h-full transition-all duration-500"
          style={{ width: `${Math.min(100, weightsPct)}%` }}
          title={`Weights: ${weightsGb.toFixed(2)} GB`}
        />
        <div 
          className={cn("h-full transition-all duration-500", fits ? "bg-chart-2" : "bg-destructive")}
          style={{ width: `${Math.min(100 - weightsPct, kvPct)}%` }}
          title={`KV Cache: ${kvCacheGb.toFixed(2)} GB`}
        />
        {/* If exceeded, we could show a dashed red line or something, but clipping to 100% works */}
      </div>
      
      <div className="flex gap-4 text-xs font-mono mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Weights ({weightsGb.toFixed(1)}GB)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", fits ? "bg-chart-2" : "bg-destructive")} />
          <span className="text-muted-foreground">KV Cache ({kvCacheGb.toFixed(1)}GB)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-secondary border border-border" />
          <span className="text-muted-foreground">Free ({freeGb.toFixed(1)}GB)</span>
        </div>
      </div>
    </div>
  )
}
