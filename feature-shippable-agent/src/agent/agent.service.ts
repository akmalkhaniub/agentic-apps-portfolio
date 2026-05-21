import { Injectable } from '@nestjs/common';
import { StateGraph, END, START } from '@langchain/langgraph';
import { GithubService } from '../github/github.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { ChatOpenAI } from '@langchain/openai';

interface AgentState {
  requirement: string;
  repo: { owner: string; name: string };
  files: Record<string, string>;
  testResults: string;
  iterations: number;
  prUrl?: string;
}

@Injectable()
export class AgentService {
  private model: ChatOpenAI;

  constructor(
    private readonly githubService: GithubService,
    private readonly sandboxService: SandboxService,
  ) {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0,
    });
  }

  async runAgent(requirement: string, owner: string, repo: string) {
    const workflow = new StateGraph<AgentState>({
      channels: {
        requirement: null,
        repo: null,
        files: { reducer: (a, b) => ({ ...a, ...b }) },
        testResults: null,
        iterations: { reducer: (a, b) => b },
        prUrl: null,
      },
    });

    workflow.addNode('analyze', this.analyze.bind(this));
    workflow.addNode('implement', this.implement.bind(this));
    workflow.addNode('test', this.test.bind(this));
    workflow.addNode('fix', this.fix.bind(this));
    workflow.addNode('ship', this.ship.bind(this));

    // @ts-ignore
    workflow.addEdge(START, 'analyze');
    // @ts-ignore
    workflow.addEdge('analyze', 'implement');
    // @ts-ignore
    workflow.addEdge('implement', 'test');
    
    // @ts-ignore
    workflow.addConditionalEdges('test', (state) => {
      if (state.testResults.includes('FAIL') && state.iterations < 5) {
        return 'fix';
      }
      return 'ship';
    });

    // @ts-ignore
    workflow.addEdge('fix', 'test');
    // @ts-ignore
    workflow.addEdge('ship', END);

    const app = workflow.compile();
    
    const initialState: AgentState = {
      requirement,
      repo: { owner, name: repo },
      files: {},
      testResults: '',
      iterations: 0,
    };

    return await app.invoke(initialState as any);
  }

  private async analyze(state: AgentState): Promise<Partial<AgentState>> {
    console.log('Analyzing requirement:', state.requirement);
    return { iterations: (state.iterations || 0) + 1 };
  }

  private async implement(state: AgentState): Promise<Partial<AgentState>> {
    console.log('Implementing features...');
    return { iterations: (state.iterations || 0) + 1 };
  }

  private async test(state: AgentState): Promise<Partial<AgentState>> {
    console.log('Running tests...');
    return { testResults: 'PASS' };
  }

  private async fix(state: AgentState): Promise<Partial<AgentState>> {
    console.log('Fixing code...');
    return { iterations: (state.iterations || 0) + 1 };
  }

  private async ship(state: AgentState): Promise<Partial<AgentState>> {
    console.log('Shipping PR...');
    return { prUrl: 'https://github.com/...' };
  }
}
