import React, { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useInspector, AgentTrace } from '../context/InspectorContext';

export default function DAGVisualizer() {
  const { traces } = useInspector();

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const seenSources = new Set<string>();

    let lastSource = '';
    let yOffset = 50;

    traces.forEach((trace: AgentTrace, idx: number) => {
      // Add node if we haven't seen this source yet
      if (!seenSources.has(trace.source)) {
        seenSources.add(trace.source);
        
        let bgColor = '#3b82f6'; // default blue
        if (trace.source.includes('Manager') || trace.source.includes('Moderator') || trace.source.includes('Coordinator')) {
          bgColor = '#8b5cf6'; // purple for orchestrators
        } else if (trace.source.includes('User')) {
          bgColor = '#10b981'; // green for user
        } else if (trace.source.includes('Node') || trace.source.includes('Subagent') || trace.source.includes('Agent')) {
          bgColor = '#f59e0b'; // orange for workers
        }

        nodes.push({
          id: trace.source,
          position: { x: 250 + (nodes.length % 2 === 0 ? -100 : 100), y: yOffset },
          data: { label: trace.source },
          style: {
            background: bgColor,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }
        });
        yOffset += 100;
      }

      // Add edge
      const target = (trace as any).target;
      const actualTarget = target ? target : trace.source;
      
      if (lastSource && lastSource !== actualTarget) {
        const edgeId = `e-${lastSource}-${actualTarget}-${idx}`;
        // Prevent duplicate immediate edges to avoid clutter
        if (!edges.find(e => e.source === lastSource && e.target === actualTarget)) {
          edges.push({
            id: edgeId,
            source: lastSource,
            target: actualTarget,
            animated: true,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
          });
        }
      }
      
      // If trace has explicit target, we move execution to that target. Else it stays at source.
      lastSource = target ? target : trace.source;
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [traces]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update when initial changes
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (nodes.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No traces available to graph.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg-main)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background color="var(--border-subtle)" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
