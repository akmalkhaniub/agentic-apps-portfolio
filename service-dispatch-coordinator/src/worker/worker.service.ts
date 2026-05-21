import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class WorkerService {
  async negotiateJob(description: string, techName: string, techSkills: string[]) {
    const workerPath = path.join(process.cwd(), 'workers', 'main.py');
    const skillsStr = techSkills.join(',');
    
    // In a real app, we'd pass JSON or use a proper RPC/Queue
    const pythonPath = path.join(process.cwd(), 'venv_313', 'Scripts', 'python.exe');
    const command = `"${pythonPath}" "${workerPath}" "${description}" "${techName}" "${skillsStr}"`;
    
    try {
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      console.error('Worker error:', error);
      return 'REJECTED';
    }
  }
}
