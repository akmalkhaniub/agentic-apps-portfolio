import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from './agent/agent.module';
import { GithubModule } from './github/github.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { RequirementModule } from './requirement/requirement.module';

@Module({
  imports: [AgentModule, GithubModule, SandboxModule, RequirementModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
