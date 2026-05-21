import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { GithubModule } from '../github/github.module';
import { SandboxModule } from '../sandbox/sandbox.module';

@Module({
  imports: [GithubModule, SandboxModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
