import { Controller, Post, Body } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';

@Controller('requirement')
export class RequirementController {
  constructor(private readonly agentService: AgentService) {}

  @Post('process')
  async processRequirement(@Body() body: { requirement: string; owner: string; repo: string }) {
    const result = await this.agentService.runAgent(body.requirement, body.owner, body.repo);
    return result;
  }
}
