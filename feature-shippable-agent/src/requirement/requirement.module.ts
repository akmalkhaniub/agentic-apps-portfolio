import { Module } from '@nestjs/common';
import { RequirementController } from './requirement.controller';
import { AgentModule } from '../agent/agent.module';
import { RequirementService } from './requirement.service';

@Module({
  imports: [AgentModule],
  controllers: [RequirementController],
  providers: [RequirementService],
})
export class RequirementModule {}
