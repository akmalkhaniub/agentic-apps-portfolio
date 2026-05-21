import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AgentService } from './src/agent/agent.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const agentService = app.get(AgentService);

  const requirement = "Add a simple /health endpoint to a new express app";
  const owner = "test-owner";
  const repo = "test-repo";

  console.log("🚀 Starting Agent Dry Run...");
  try {
    const result = await agentService.runAgent(requirement, owner, repo);
    console.log("✅ Agent Run Complete!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Agent Run Failed:", error);
  } finally {
    await app.close();
  }
}

bootstrap();
