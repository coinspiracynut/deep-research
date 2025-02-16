import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { DeepResearch } from './deep-research';
import { ProgressManager } from './progress-manager';
import { OutputManager } from './output-manager';

const app = express();
const port = process.env.PORT || 3002;
const host = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Task storage
const tasks = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start research
app.post('/research', async (req, res) => {
  try {
    const { query, depth = 3, breadth = 3 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const taskId = `task-${Date.now()}`;
    const progress = new ProgressManager();
    const output = new OutputManager();
    
    const research = new DeepResearch({
      query,
      maxDepth: depth,
      maxBreadth: breadth,
      progressManager: progress,
      outputManager: output,
    });

    tasks.set(taskId, { research, progress, output });

    // Start research in background
    research.run().catch(error => {
      console.error(`Task ${taskId} failed:`, error);
      tasks.get(taskId).status = 'failed';
      tasks.get(taskId).error = error.message;
    });

    res.json({
      taskId,
      status: 'running',
      query,
      config: { depth, breadth }
    });
  } catch (error) {
    console.error('Error starting research:', error);
    res.status(500).json({ error: 'Failed to start research task' });
  }
});

// Get research status
app.get('/research/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = tasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { progress, output, status, error } = task;
    
    res.json({
      taskId,
      status: status || 'running',
      error,
      progress: progress.getProgress(),
      results: output.getOutput()
    });
  } catch (error) {
    console.error('Error getting research status:', error);
    res.status(500).json({ error: 'Failed to get research status' });
  }
});

app.listen(port, host, () => {
  console.log(`Deep Research API running on http://${host}:${port}`);
});
