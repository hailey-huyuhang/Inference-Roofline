import { useState, useEffect, useMemo, useRef } from "react";
import { 
  useListGpus, 
  useListModels, 
  useCreateEstimate, 
  useListScenarios,
  useCreateScenario,
  useDeleteScenario,
  EstimateInputPrecision,
  getListScenariosQueryKey
} from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { MemoryBar } from "@/components/MemoryBar";
import { RooflineChart } from "@/components/RooflineChart";
import { BatchSweepChart } from "@/components/BatchSweepChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Trash2, ArrowRightLeft, Plus } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export default function Home() {
  const { data: gpus, isLoading: loadingGpus } = useListGpus();
  const { data: models, isLoading: loadingModels } = useListModels();
  
  const [modelId, setModelId] = useState<string>("");
  const [gpuId, setGpuId] = useState<string>("");
  const [precision, setPrecision] = useState<EstimateInputPrecision>("bf16");
  const [batchSize, setBatchSize] = useState<number>(32);
  const [inputTokens, setInputTokens] = useState<number>(2048);
  const [outputTokens, setOutputTokens] = useState<number>(512);
  const [mfu, setMfu] = useState<number>(0.3);

  // Set defaults when data loads
  useEffect(() => {
    if (gpus && gpus.length > 0 && !gpuId) setGpuId(gpus[0].id.toString());
  }, [gpus, gpuId]);
  
  useEffect(() => {
    if (models && models.length > 0 && !modelId) setModelId(models[0].id.toString());
  }, [models, modelId]);

  const debouncedBatchSize = useDebounce(batchSize, 500);
  const debouncedInputTokens = useDebounce(inputTokens, 500);
  const debouncedOutputTokens = useDebounce(outputTokens, 500);
  const debouncedMfu = useDebounce(mfu, 500);

  const { mutate: getEstimate, data: estimate, isPending: estimating } = useCreateEstimate();
  const getEstimateRef = useRef(getEstimate);
  getEstimateRef.current = getEstimate;

  const [compareScenarioId, setCompareScenarioId] = useState<number | null>(null);

  const { data: scenarios } = useListScenarios({ query: { queryKey: getListScenariosQueryKey() }});
  
  const compareScenario = useMemo(() => {
    if (!compareScenarioId || !scenarios) return null;
    return scenarios.find(s => s.id === compareScenarioId) || null;
  }, [compareScenarioId, scenarios]);

  const { mutate: getCompareEstimate, data: compareEstimate, isPending: estimatingCompare } = useCreateEstimate();
  const getCompareEstimateRef = useRef(getCompareEstimate);
  getCompareEstimateRef.current = getCompareEstimate;

  useEffect(() => {
    if (!compareScenario) return;
    getCompareEstimateRef.current({
      data: {
        modelId: compareScenario.modelId,
        gpuId: compareScenario.gpuId,
        precision: compareScenario.precision as EstimateInputPrecision,
        batchSize: compareScenario.batchSize,
        inputTokens: compareScenario.inputTokens,
        outputTokens: compareScenario.outputTokens,
        mfu: compareScenario.mfu
      }
    });
  }, [compareScenario]);


  useEffect(() => {
    if (!modelId || !gpuId) return;
    
    getEstimateRef.current({
      data: {
        modelId: parseInt(modelId),
        gpuId: parseInt(gpuId),
        precision,
        batchSize: debouncedBatchSize,
        inputTokens: debouncedInputTokens,
        outputTokens: debouncedOutputTokens,
        mfu: debouncedMfu
      }
    });
  }, [modelId, gpuId, precision, debouncedBatchSize, debouncedInputTokens, debouncedOutputTokens, debouncedMfu]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center gap-6 max-w-7xl mx-auto font-sans">
      
      <div className="w-full flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Inference Roofline</h1>
          <p className="text-muted-foreground mt-1">Analyze GPU serving bottlenecks.</p>
        </div>
        
        <ScenariosDialog 
          onLoad={(s) => {
            setModelId(s.modelId.toString());
            setGpuId(s.gpuId.toString());
            setPrecision(s.precision as EstimateInputPrecision);
            setBatchSize(s.batchSize);
            setInputTokens(s.inputTokens);
            setOutputTokens(s.outputTokens);
            setMfu(s.mfu);
          }}
          onCompare={(id) => setCompareScenarioId(id)}
          compareId={compareScenarioId}
          currentConfig={{
            modelId: parseInt(modelId),
            gpuId: parseInt(gpuId),
            precision,
            batchSize,
            inputTokens,
            outputTokens,
            mfu
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
        {/* LEFT COLUMN: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Workload Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <Label>Model</Label>
                {loadingModels ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models?.map(m => (
                        <SelectItem key={m.id} value={m.id.toString()} className="font-mono text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>GPU</Label>
                {loadingGpus ? <Skeleton className="h-10 w-full" /> : (
                  <Select value={gpuId} onValueChange={setGpuId}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select GPU" />
                    </SelectTrigger>
                    <SelectContent>
                      {gpus?.map(g => (
                        <SelectItem key={g.id} value={g.id.toString()} className="font-mono text-xs">
                          {g.name} ({g.memoryGb}GB)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Precision</Label>
                <Select value={precision} onValueChange={(v) => setPrecision(v as EstimateInputPrecision)}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fp16" className="font-mono text-xs">FP16</SelectItem>
                    <SelectItem value="bf16" className="font-mono text-xs">BF16</SelectItem>
                    <SelectItem value="fp8" className="font-mono text-xs">FP8</SelectItem>
                    <SelectItem value="int4" className="font-mono text-xs">INT4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Batch Size</Label>
                    <span className="font-mono text-xs text-muted-foreground">{batchSize}</span>
                  </div>
                  <Slider 
                    value={[batchSize]} 
                    onValueChange={(v) => setBatchSize(v[0])} 
                    min={1} 
                    max={256} 
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Input Tokens</Label>
                    <span className="font-mono text-xs text-muted-foreground">{inputTokens}</span>
                  </div>
                  <Slider 
                    value={[inputTokens]} 
                    onValueChange={(v) => setInputTokens(v[0])} 
                    min={1} 
                    max={32768} 
                    step={64}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Output Tokens</Label>
                    <span className="font-mono text-xs text-muted-foreground">{outputTokens}</span>
                  </div>
                  <Slider 
                    value={[outputTokens]} 
                    onValueChange={(v) => setOutputTokens(v[0])} 
                    min={1} 
                    max={8192} 
                    step={64}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="flex items-center gap-1.5">
                      Model Flop Utilization (MFU)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">The fraction of peak theoretical TFLOPS achieved. Real workloads typically hit 30% to 50%.</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <span className="font-mono text-xs text-muted-foreground">{(mfu * 100).toFixed(0)}%</span>
                  </div>
                  <Slider 
                    value={[mfu]} 
                    onValueChange={(v) => setMfu(v[0])} 
                    min={0.05} 
                    max={1} 
                    step={0.05}
                  />
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Output */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {!estimate ? (
            <Card className="h-[600px] flex items-center justify-center border-dashed">
              <span className="text-muted-foreground font-mono text-sm animate-pulse">
                {estimating ? "Calculating estimation..." : "Awaiting configuration..."}
              </span>
            </Card>
          ) : (
            <>
              {/* Top Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  title="Throughput" 
                  value={formatNumber(estimate.throughputTokensPerSec, 0)} 
                  unit="tok/s" 
                  loading={estimating}
                  highlight
                  compareValue={compareEstimate ? formatNumber(compareEstimate.throughputTokensPerSec, 0) : undefined}
                  tooltip="Total generation throughput. Higher is better."
                />
                <MetricCard 
                  title="Latency" 
                  value={formatNumber(estimate.totalLatencySeconds, 2)} 
                  unit="sec" 
                  loading={estimating}
                  compareValue={compareEstimate ? formatNumber(compareEstimate.totalLatencySeconds, 2) : undefined}
                  tooltip="End-to-end time to generate all requested output tokens."
                />
                <MetricCard 
                  title="Cost per 1M Tokens" 
                  value={formatCurrency(estimate.costPerMillionTokensUsd)} 
                  loading={estimating}
                  compareValue={compareEstimate ? formatCurrency(compareEstimate.costPerMillionTokensUsd) : undefined}
                  tooltip="Blended cost accounting for hourly GPU price and throughput."
                />
                <MetricCard 
                  title="Bottleneck" 
                  value={estimate.bottleneck === "memory" ? "Memory" : "Compute"} 
                  valueClass={estimate.bottleneck === "memory" ? "text-destructive" : "text-primary"}
                  loading={estimating}
                  compareValue={compareEstimate ? (compareEstimate.bottleneck === "memory" ? "Memory" : "Compute") : undefined}
                  compareValueClass={compareEstimate ? (compareEstimate.bottleneck === "memory" ? "text-destructive/70" : "text-primary/70") : undefined}
                  tooltip="Whether performance is limited by moving data (Memory) or calculating it (Compute)."
                />
              </div>

              {/* Memory Verdict */}
              <Card className="border-border">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Memory Footprint
                      {estimate.fitsInMemory ? (
                        <Badge variant="default" className="bg-chart-2/20 text-chart-2 hover:bg-chart-2/30">Fits in VRAM</Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-destructive/20 text-destructive hover:bg-destructive/30">OOM (Out of Memory)</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Weights and KV Cache utilization</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Current Configuration</div>
                    <MemoryBar 
                      weightsGb={estimate.weightMemoryGb} 
                      kvCacheGb={estimate.kvCacheGb} 
                      capacityGb={estimate.gpu.memoryGb}
                    />
                  </div>
                  
                  {compareEstimate && compareScenario && (
                    <div className="space-y-2 pt-4 border-t border-border/50">
                      <div className="text-xs font-medium text-muted-foreground flex justify-between">
                        <span>Comparison: {compareScenario.name}</span>
                        <div className="flex items-center gap-2">
                          {compareEstimate.fitsInMemory ? (
                            <span className="text-[10px] text-chart-2 uppercase font-semibold">Fits</span>
                          ) : (
                            <span className="text-[10px] text-destructive uppercase font-semibold">OOM</span>
                          )}
                        </div>
                      </div>
                      <MemoryBar 
                        weightsGb={compareEstimate.weightMemoryGb} 
                        kvCacheGb={compareEstimate.kvCacheGb} 
                        capacityGb={compareEstimate.gpu.memoryGb}
                        className="opacity-70 grayscale-[30%]"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Visualizations & Detail Tabs */}
              <Card className="border-border flex-1">
                <Tabs defaultValue="roofline" className="w-full h-full flex flex-col">
                  <CardHeader className="pb-0 border-b">
                    <TabsList className="w-full justify-start bg-transparent h-auto p-0 mb-4 gap-4">
                      <TabsTrigger value="roofline" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2">Roofline Analysis</TabsTrigger>
                      <TabsTrigger value="sweep" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2">Batch Sweep</TabsTrigger>
                      <TabsTrigger value="breakdown" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-2">Latency Breakdown</TabsTrigger>
                    </TabsList>
                  </CardHeader>
                  <CardContent className="p-6 pt-6 flex-1 flex flex-col">
                    <TabsContent value="roofline" className="flex-1 m-0 h-full">
                      <div className="h-[400px]">
                        <RooflineChart estimate={estimate} compareEstimate={compareEstimate || null} />
                      </div>
                      <div className="mt-4 text-sm text-muted-foreground bg-muted/30 p-4 rounded-md font-mono flex flex-col gap-2">
                        <p>{estimate.explanation}</p>
                        {compareEstimate && (
                          <p className="border-t border-border pt-2 text-muted-foreground/70">
                            <strong>Comparison:</strong> {compareEstimate.explanation}
                          </p>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="sweep" className="flex-1 m-0 h-full">
                      <div className="h-[400px]">
                        <BatchSweepChart estimate={estimate} currentBatchSize={batchSize} />
                      </div>
                      <div className="mt-4 text-sm text-muted-foreground bg-muted/30 p-4 rounded-md font-mono">
                        Crossover Batch Size (Mem to Compute): <strong className="text-foreground">{formatNumber(estimate.crossoverBatchSize, 0)}</strong>
                      </div>
                    </TabsContent>

                    <TabsContent value="breakdown" className="flex-1 m-0 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4 p-4 border rounded-md relative">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            Prefill Phase
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-70" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Processing the initial input prompt. Usually compute-bound.</p>
                              </TooltipContent>
                            </Tooltip>
                          </h4>
                          <div className="flex justify-between text-sm font-mono border-b border-border/50 pb-2">
                            <span className="text-muted-foreground">TTFT (Time to first token)</span>
                            <div className="text-right">
                              <div>{formatNumber(estimate.ttftSeconds, 4)} s</div>
                              {compareEstimate && (
                                <div className="text-[10px] text-muted-foreground">vs {formatNumber(compareEstimate.ttftSeconds, 4)} s</div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between text-sm font-mono">
                            <span className="text-muted-foreground">FLOPs</span>
                            <div className="text-right">
                              <div>{formatNumber(estimate.prefillFlops, 0)}</div>
                              {compareEstimate && (
                                <div className="text-[10px] text-muted-foreground">vs {formatNumber(compareEstimate.prefillFlops, 0)}</div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4 p-4 border rounded-md relative">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            Decode Phase
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground opacity-70" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Generating output tokens one-by-one. Usually memory-bound.</p>
                              </TooltipContent>
                            </Tooltip>
                          </h4>
                          <div className="flex justify-between text-sm font-mono border-b border-border/50 pb-2">
                            <span className="text-muted-foreground">TPOT (Time per output token)</span>
                            <div className="text-right">
                              <div>{formatNumber(estimate.tpotSeconds, 4)} s</div>
                              {compareEstimate && (
                                <div className="text-[10px] text-muted-foreground">vs {formatNumber(compareEstimate.tpotSeconds, 4)} s</div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between text-sm font-mono border-b border-border/50 pb-2">
                            <span className="text-muted-foreground">Memory Latency</span>
                            <div className="text-right">
                              <div>{formatNumber(estimate.decodeMemorySeconds, 4)} s</div>
                              {compareEstimate && (
                                <div className="text-[10px] text-muted-foreground">vs {formatNumber(compareEstimate.decodeMemorySeconds, 4)} s</div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between text-sm font-mono">
                            <span className="text-muted-foreground">Compute Latency</span>
                            <div className="text-right">
                              <div>{formatNumber(estimate.decodeComputeSeconds, 4)} s</div>
                              {compareEstimate && (
                                <div className="text-[10px] text-muted-foreground">vs {formatNumber(compareEstimate.decodeComputeSeconds, 4)} s</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, unit, highlight, loading, valueClass, compareValue, compareValueClass, tooltip }: { title: string, value: string, unit?: string, highlight?: boolean, loading?: boolean, valueClass?: string, compareValue?: string, compareValueClass?: string, tooltip?: string }) {
  return (
    <Card className={`border-border relative overflow-hidden ${highlight ? 'border-primary/50 bg-primary/5' : ''}`}>
      <CardContent className="p-4 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground opacity-70" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1 font-mono">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className={`text-2xl font-bold tracking-tight ${valueClass || 'text-foreground'}`}>{value}</span>
            )}
            {unit && !loading && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
          
          {compareValue && (
            <div className="flex items-baseline gap-1 font-mono mt-1 pt-1 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground uppercase mr-1">vs</span>
              <span className={`text-sm font-semibold ${compareValueClass || 'text-muted-foreground'}`}>{compareValue}</span>
              {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScenariosDialog({ onLoad, onCompare, compareId, currentConfig }: { onLoad: (s: any) => void, onCompare: (id: number | null) => void, compareId: number | null, currentConfig: any }) {
  const [open, setOpen] = useState(false);
  const { data: scenarios, refetch } = useListScenarios({ query: { enabled: open, queryKey: getListScenariosQueryKey() }});
  const createScenario = useCreateScenario();
  const deleteScenario = useDeleteScenario();
  
  const [newScenarioName, setNewScenarioName] = useState("");

  const handleSave = () => {
    if (!newScenarioName.trim()) return;
    createScenario.mutate({
      data: {
        name: newScenarioName,
        ...currentConfig
      }
    }, {
      onSuccess: () => {
        setNewScenarioName("");
        refetch();
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteScenario.mutate({ id }, {
      onSuccess: () => refetch()
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          Scenarios
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Saved Scenarios</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-2 my-4">
          <Input 
            placeholder="New scenario name..." 
            value={newScenarioName} 
            onChange={(e) => setNewScenarioName(e.target.value)} 
          />
          <Button onClick={handleSave} disabled={createScenario.isPending || !newScenarioName.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Save Current
          </Button>
        </div>

        <Separator />

        <div className="space-y-4 mt-4 max-h-[300px] overflow-y-auto pr-2">
          {scenarios?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No saved scenarios.</p>
          )}
          {scenarios?.map(s => (
            <div key={s.id} className="flex flex-col gap-2 p-3 border rounded-md bg-muted/20">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{s.name}</h4>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={compareId === s.id ? "default" : "secondary"}
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={() => {
                      if (compareId === s.id) {
                        onCompare(null);
                      } else {
                        onCompare(s.id);
                        setOpen(false);
                      }
                    }}
                  >
                    {compareId === s.id ? "Comparing" : "Compare"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={() => {
                      onLoad(s);
                      setOpen(false);
                    }}
                  >
                    Load
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 text-xs font-mono text-muted-foreground flex-wrap">
                <Badge variant="outline">Batch: {s.batchSize}</Badge>
                <Badge variant="outline">Prec: {s.precision}</Badge>
                <Badge variant="outline">Tokens: {s.inputTokens}/{s.outputTokens}</Badge>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
