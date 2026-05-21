import { Injectable } from '@nestjs/common';
import { Sandbox } from 'e2b';

@Injectable()
export class SandboxService {
  private sandbox: Sandbox | null = null;

  async createSandbox() {
    // E2B SDK v1.x uses Sandbox.create() or Sandbox.create({ template: '...' })
    this.sandbox = await Sandbox.create();
    return this.sandbox;
  }

  async runCommand(command: string) {
    if (!this.sandbox) throw new Error('Sandbox not initialized');
    // E2B SDK v1.x uses sandbox.commands.run(command)
    const output = await this.sandbox.commands.run(command);
    return output;
  }

  async writeFile(path: string, content: string) {
    if (!this.sandbox) throw new Error('Sandbox not initialized');
    await this.sandbox.files.write(path, content);
  }

  async readFile(path: string) {
    if (!this.sandbox) throw new Error('Sandbox not initialized');
    return await this.sandbox.files.read(path);
  }

  async close() {
    if (this.sandbox) {
      // E2B SDK v1.x uses sandbox.kill() or sandbox.close()
      // @ts-ignore
      await this.sandbox.kill();
      this.sandbox = null;
    }
  }
}
