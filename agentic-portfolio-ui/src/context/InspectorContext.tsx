import { createContext, useContext, useState, ReactNode } from 'react';

export interface AgentTrace {
  id: string;
  timestamp: string;
  source: string;
  type: 'log' | 'llm' | 'tool' | 'graph_state';
  content: any;
}

interface InspectorContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  traces: AgentTrace[];
  addTrace: (trace: Omit<AgentTrace, 'id' | 'timestamp'>) => void;
  clearTraces: () => void;
}

const InspectorContext = createContext<InspectorContextType | undefined>(undefined);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [traces, setTraces] = useState<AgentTrace[]>([]);

  const addTrace = (trace: Omit<AgentTrace, 'id' | 'timestamp'>) => {
    setTraces((prev) => [
      ...prev,
      {
        ...trace,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const clearTraces = () => setTraces([]);

  return (
    <InspectorContext.Provider value={{ isOpen, setIsOpen, traces, addTrace, clearTraces }}>
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  const context = useContext(InspectorContext);
  if (context === undefined) {
    throw new Error('useInspector must be used within an InspectorProvider');
  }
  return context;
}
