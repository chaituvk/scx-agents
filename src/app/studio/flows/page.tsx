"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  MessageSquare,
  Keyboard,
  GitBranch,
  Zap,
  Globe,
  PhoneForwarded,
  Flag,
  Plus,
  Save,
  Trash2,
  Move,
  X,
  ChevronRight,
  MousePointer2,
  Undo2,
  Redo2,
  Download,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NodeType = "start" | "message" | "input" | "condition" | "action" | "api" | "transfer" | "end";

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  data: Record<string, string>;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const NODE_TYPES: { type: NodeType; label: string; icon: typeof Play; color: string; desc: string }[] = [
  { type: "start", label: "Start", icon: Play, color: "#22c55e", desc: "Entry point" },
  { type: "message", label: "Message", icon: MessageSquare, color: "#3b82f6", desc: "Send text" },
  { type: "input", label: "Input", icon: Keyboard, color: "#8b5cf6", desc: "Collect data" },
  { type: "condition", label: "Condition", icon: GitBranch, color: "#f59e0b", desc: "Branch logic" },
  { type: "action", label: "Action", icon: Zap, color: "#ec4899", desc: "Set variable" },
  { type: "api", label: "API Call", icon: Globe, color: "#06b6d4", desc: "External API" },
  { type: "transfer", label: "Transfer", icon: PhoneForwarded, color: "#ef4444", desc: "Handoff" },
  { type: "end", label: "End", icon: Flag, color: "#6b7280", desc: "Exit point" },
];

const GRID_SIZE = 40;

function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function FlowBuilderPage() {
  const [nodes, setNodes] = useState<FlowNode[]>([
    { id: "start-1", type: "start", label: "Start", x: 400, y: 50, data: {} },
    { id: "msg-1", type: "message", label: "Greeting", x: 400, y: 150, data: { text: "Hi! How can I help?" } },
    { id: "input-1", type: "input", label: "Get Order", x: 400, y: 250, data: { prompt: "Order #?", variable: "order_id" } },
    { id: "cond-1", type: "condition", label: "Valid?", x: 400, y: 350, data: { variable: "order_id", condition: "neq empty" } },
    { id: "msg-ok", type: "message", label: "Found", x: 200, y: 450, data: { text: "Order found!" } },
    { id: "msg-fail", type: "message", label: "Not Found", x: 600, y: 450, data: { text: "Invalid order." } },
    { id: "end-1", type: "end", label: "End", x: 200, y: 550, data: {} },
  ]);

  const [edges, setEdges] = useState<FlowEdge[]>([
    { id: "e1", source: "start-1", target: "msg-1" },
    { id: "e2", source: "msg-1", target: "input-1" },
    { id: "e3", source: "input-1", target: "cond-1" },
    { id: "e4", source: "cond-1", target: "msg-ok", label: "Yes" },
    { id: "e5", source: "cond-1", target: "msg-fail", label: "No" },
    { id: "e6", source: "msg-ok", target: "end-1" },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [journeyName, setJourneyName] = useState("Untitled Journey");

  useEffect(() => {
    fetch("/api/journeys")
      .then((r) => r.json())
      .then((data) => {
        if (data.journeys) setJourneys(data.journeys);
      })
      .catch(() => {});
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });

      if (draggingNodeId) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggingNodeId
              ? { ...n, x: snapToGrid(x - dragOffset.x), y: snapToGrid(y - dragOffset.y) }
              : n
          )
        );
      }
    },
    [draggingNodeId, dragOffset]
  );

  const handleNodeMouseDown = (e: React.MouseEvent, node: FlowNode) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    setDragOffset({
      x: e.clientX - rect.left - node.x,
      y: e.clientY - rect.top - node.y,
    });
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset?.canvas) {
      setSelectedNodeId(null);
      setConnectingFrom(null);
    }
  };

  const addNode = (type: NodeType) => {
    const def = NODE_TYPES.find((n) => n.type === type)!;
    const newNode: FlowNode = {
      id: `${type}-${generateId()}`,
      type,
      label: def.label,
      x: snapToGrid(400 + Math.random() * 100),
      y: snapToGrid(200 + Math.random() * 100),
      data: type === "message" ? { text: "" } : type === "input" ? { prompt: "", variable: "" } : type === "condition" ? { variable: "", condition: "" } : type === "action" ? { action: "set_variable", variable: "", value: "" } : type === "api" ? { endpoint: "", method: "POST" } : type === "transfer" ? { reason: "", department: "" } : {},
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleNodePortClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectingFrom === null) {
      setConnectingFrom(nodeId);
    } else if (connectingFrom !== nodeId) {
      const exists = edges.find((e) => e.source === connectingFrom && e.target === nodeId);
      if (!exists) {
        setEdges((prev) => [
          ...prev,
          { id: `e-${generateId()}`, source: connectingFrom, target: nodeId },
        ]);
      }
      setConnectingFrom(null);
    } else {
      setConnectingFrom(null);
    }
  };

  const updateNodeData = (key: string, value: string) => {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n))
    );
  };

  const updateNodeLabel = (label: string) => {
    if (!selectedNode) return;
    setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, label } : n)));
  };

  const getNodeColor = (type: NodeType) => NODE_TYPES.find((n) => n.type === type)?.color || "#888";

  const getNodeIcon = (type: NodeType) => NODE_TYPES.find((n) => n.type === type)?.icon || Play;

  // Edge path calculation
  const getEdgePath = (source: FlowNode, target: FlowNode) => {
    const sx = source.x + 80;
    const sy = source.y + 28;
    const tx = target.x + 80;
    const ty = target.y + 28;
    const midY = (sy + ty) / 2;
    return `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
  };

  const saveJourney = async () => {
    const payload = {
      name: journeyName,
      description: "Created in flow builder",
      status: "draft",
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        position: { x: n.x, y: n.y },
        data: n.data,
      })),
      edges,
      variables: [...new Set(nodes.filter((n) => n.data.variable).map((n) => n.data.variable))],
    };

    const res = await fetch("/api/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setJourneys((prev) => [...prev, data.journey]);
      alert(`Journey "${journeyName}" saved!`);
    }
  };

  const loadJourney = (journey: any) => {
    setActiveJourney(journey);
    setJourneyName(journey.name);
    setNodes(
      journey.nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        x: n.position?.x || 200,
        y: n.position?.y || 200,
        data: n.data || {},
      }))
    );
    setEdges(
      journey.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      }))
    );
    setSelectedNodeId(null);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#f5f0eb] pt-16">
      {/* Left Sidebar - Node Palette */}
      <div className="w-64 border-r border-white/5 bg-[#0f0f0f] flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-5 w-5 text-[#c4a574]" />
            <h2 className="font-semibold">Node Palette</h2>
          </div>
          <p className="text-xs text-muted-foreground">Click to add nodes</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {NODE_TYPES.map((nt) => (
            <button
              key={nt.type}
              onClick={() => addNode(nt.type)}
              className="w-full flex items-center gap-3 rounded-lg border border-white/5 bg-[#141414] p-3 hover:border-[#c4a574]/30 transition-colors text-left group"
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${nt.color}20` }}
              >
                <nt.icon className="h-4 w-4" style={{ color: nt.color }} />
              </div>
              <div>
                <div className="text-sm font-medium group-hover:text-[#c4a574] transition-colors">{nt.label}</div>
                <div className="text-xs text-muted-foreground">{nt.desc}</div>
              </div>
              <Plus className="h-3.5 w-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>

        {/* Saved Journeys */}
        <div className="border-t border-white/5 p-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Saved Journeys</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {journeys.map((j) => (
              <button
                key={j.id}
                onClick={() => loadJourney(j)}
                className={`w-full text-left text-xs rounded-md px-2 py-1.5 transition-colors ${
                  activeJourney?.id === j.id ? "bg-[#c4a574]/20 text-[#c4a574]" : "hover:bg-white/5"
                }`}
              >
                {j.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-14 border-b border-white/5 bg-[#0f0f0f] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Input
              value={journeyName}
              onChange={(e) => setJourneyName(e.target.value)}
              className="w-64 bg-[#141414] border-white/10 h-8 text-sm"
            />
            <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">
              Draft
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              Undo
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
              <Redo2 className="h-3.5 w-3.5 mr-1" />
              Redo
            </Button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              className="h-8 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] text-xs"
              onClick={saveJourney}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={canvasRef}
            data-canvas="true"
            className="absolute inset-0 cursor-crosshair"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            }}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
          >
            {/* Edges */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
              {edges.map((edge) => {
                const source = nodes.find((n) => n.id === edge.source);
                const target = nodes.find((n) => n.id === edge.target);
                if (!source || !target) return null;
                return (
                  <g key={edge.id}>
                    <path
                      d={getEdgePath(source, target)}
                      fill="none"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={2}
                    />
                    <path
                      d={getEdgePath(source, target)}
                      fill="none"
                      stroke={connectingFrom === edge.source ? "#c4a574" : "transparent"}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      className="animate-pulse"
                    />
                    {/* Arrowhead */}
                    <polygon
                      points={`${target.x + 80},${target.y + 20} ${target.x + 72},${target.y + 16} ${target.x + 72},${target.y + 24}`}
                      fill="rgba(255,255,255,0.3)"
                    />
                    {edge.label && (
                      <text
                        x={(source.x + target.x) / 2 + 80}
                        y={(source.y + target.y) / 2 + 20}
                        fill="#a89f94"
                        fontSize={10}
                        textAnchor="middle"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Connecting line */}
              {connectingFrom && (
                <line
                  x1={(nodes.find((n) => n.id === connectingFrom)?.x || 0) + 80}
                  y1={(nodes.find((n) => n.id === connectingFrom)?.y || 0) + 28}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="#c4a574"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const Icon = getNodeIcon(node.type);
              const color = getNodeColor(node.type);
              const isSelected = selectedNodeId === node.id;
              const isConnecting = connectingFrom === node.id;

              return (
                <motion.div
                  key={node.id}
                  className={`absolute select-none ${draggingNodeId === node.id ? "cursor-grabbing" : "cursor-grab"}`}
                  style={{ left: node.x, top: node.y, width: 160 }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`rounded-xl border bg-[#141414] p-3 transition-all ${
                      isSelected
                        ? "border-[#c4a574] shadow-lg shadow-[#c4a574]/10"
                        : isConnecting
                        ? "border-[#c4a574]/50"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <Icon className="h-3 w-3" style={{ color }} />
                      </div>
                      <span className="text-xs font-medium truncate">{node.label}</span>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNode(node.id);
                          }}
                          className="ml-auto text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Preview */}
                    {node.data.text && (
                      <p className="text-[10px] text-muted-foreground truncate">{node.data.text}</p>
                    )}
                    {node.data.prompt && (
                      <p className="text-[10px] text-muted-foreground truncate">{node.data.prompt}</p>
                    )}
                    {node.data.variable && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-white/10">
                        {node.data.variable}
                      </Badge>
                    )}

                    {/* Connection port */}
                    <button
                      className={`absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 transition-colors ${
                        isConnecting ? "bg-[#c4a574] border-[#c4a574]" : "bg-[#0a0a0a] border-white/30 hover:border-[#c4a574]"
                      }`}
                      onClick={(e) => handleNodePortClick(e, node.id)}
                      title="Click to connect"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Canvas hint */}
          {nodes.length <= 1 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-muted-foreground">
                <MousePointer2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Click a node type on the left to get started</p>
                <p className="text-xs mt-1 opacity-50">Drag to move • Click port to connect</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Properties */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-80 border-l border-white/5 bg-[#0f0f0f] flex flex-col"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = getNodeIcon(selectedNode.type);
                  const color = getNodeColor(selectedNode.type);
                  return (
                    <>
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{selectedNode.label}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{selectedNode.type} Node</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button onClick={() => setSelectedNodeId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Label */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Label</label>
                <Input
                  value={selectedNode.label}
                  onChange={(e) => updateNodeLabel(e.target.value)}
                  className="bg-[#141414] border-white/10 h-8 text-sm"
                />
              </div>

              {/* Node-specific properties */}
              {selectedNode.type === "message" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Message Text</label>
                  <textarea
                    value={selectedNode.data.text || ""}
                    onChange={(e) => updateNodeData("text", e.target.value)}
                    className="w-full h-24 bg-[#141414] border border-white/10 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-[#c4a574]/50"
                    placeholder="Enter message text..."
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Use {"{{variable}}"} for interpolation</p>
                </div>
              )}

              {selectedNode.type === "input" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Prompt</label>
                    <Input
                      value={selectedNode.data.prompt || ""}
                      onChange={(e) => updateNodeData("prompt", e.target.value)}
                      className="bg-[#141414] border-white/10 h-8 text-sm"
                      placeholder="Ask the user..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Variable Name</label>
                    <Input
                      value={selectedNode.data.variable || ""}
                      onChange={(e) => updateNodeData("variable", e.target.value)}
                      className="bg-[#141414] border-white/10 h-8 text-sm"
                      placeholder="e.g., order_number"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === "condition" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Variable</label>
                    <Input
                      value={selectedNode.data.variable || ""}
                      onChange={(e) => updateNodeData("variable", e.target.value)}
                      className="bg-[#141414] border-white/10 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Condition</label>
                    <select
                      value={selectedNode.data.condition || ""}
                      onChange={(e) => updateNodeData("condition", e.target.value)}
                      className="w-full h-8 bg-[#141414] border border-white/10 rounded-md px-2 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="eq">Equals</option>
                      <option value="neq">Not Equals</option>
                      <option value="gt">Greater Than</option>
                      <option value="lt">Less Than</option>
                      <option value="contains">Contains</option>
                      <option value="empty">Is Empty</option>
                      <option value="not_empty">Is Not Empty</option>
                    </select>
                  </div>
                </>
              )}

              {selectedNode.type === "action" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Action Type</label>
                    <select
                      value={selectedNode.data.action || "set_variable"}
                      onChange={(e) => updateNodeData("action", e.target.value)}
                      className="w-full h-8 bg-[#141414] border border-white/10 rounded-md px-2 text-sm"
                    >
                      <option value="set_variable">Set Variable</option>
                      <option value="clear_variable">Clear Variable</option>
                      <option value="increment">Increment</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Variable</label>
                    <Input
                      value={selectedNode.data.variable || ""}
                      onChange={(e) => updateNodeData("variable", e.target.value)}
                      className="bg-[#141414] border-white/10 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Value</label>
                    <Input
                      value={selectedNode.data.value || ""}
                      onChange={(e) => updateNodeData("value", e.target.value)}
                      className="bg-[#141414] border-white/10 h-8 text-sm"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === "api" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Endpoint</label>
                    <Input
                      value={selectedNode.data.endpoint || ""}
                      onChange={(e) => updateNodeData("endpoint", e.target.value)}
                      className="bg-[#141414] border-white/10 h-8 text-sm"
                      placeholder="/api/kyc/verify"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Method</label>
                    <select
                      value={selectedNode.data.method || "POST"}
                      onChange={(e) => updateNodeData("method", e.target.value)}
                      className="w-full h-8 bg-[#141414] border border-white/10 rounded-md px-2 text-sm"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                </>
              )}

              {selectedNode.type === "transfer" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Department</label>
                    <select
                      value={selectedNode.data.department || ""}
                      onChange={(e) => updateNodeData("department", e.target.value)}
                      className="w-full h-8 bg-[#141414] border border-white/10 rounded-md px-2 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="support">Support</option>
                      <option value="sales">Sales</option>
                      <option value="risk">Risk/Compliance</option>
                      <option value="billing">Billing</option>
                      <option value="technical">Technical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Reason</label>
                    <Input
                      value={selectedNode.data.reason || ""}
                      onChange={(e) => updateNodeData("reason", e.target.value)}
                      className="bg-[#141414] border-white/10 h-8 text-sm"
                      placeholder="Why transfer?"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === "end" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">End Message</label>
                  <textarea
                    value={selectedNode.data.text || ""}
                    onChange={(e) => updateNodeData("text", e.target.value)}
                    className="w-full h-20 bg-[#141414] border border-white/10 rounded-md p-2 text-sm resize-none focus:outline-none focus:border-[#c4a574]/50"
                    placeholder="Thank you for chatting..."
                  />
                </div>
              )}

              {/* Node Info */}
              <div className="pt-4 border-t border-white/5">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Connections</h4>
                {edges.filter((e) => e.source === selectedNode.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No outgoing connections</p>
                ) : (
                  <div className="space-y-1">
                    {edges
                      .filter((e) => e.source === selectedNode.id)
                      .map((e) => {
                        const target = nodes.find((n) => n.id === e.target);
                        return (
                          <div key={e.id} className="flex items-center gap-2 text-xs">
                            <ChevronRight className="h-3 w-3 text-[#c4a574]" />
                            <span>{e.label || "default"}</span>
                            <span className="text-muted-foreground">→ {target?.label || "?"}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                  onClick={() => deleteNode(selectedNode.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete Node
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
