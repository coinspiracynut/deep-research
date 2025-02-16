import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { deepResearch } from './deep-research';
import { ProgressManager } from './progress-manager';
import { OutputManager } from './output-manager';
import { ResearchRequestSchema, ResearchTask } from './types';

const app = express();
const port = parseInt(process.env.PORT || '3002', 10);
const host = process.env.HOST || '0.0.0.0';
const maxConcurrentTasks = process.env.MAX_CONCURRENT_TASKS ? parseInt(process.env.MAX_CONCURRENT_TASKS) : 5;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Task storage
const tasks = new Map<string, ResearchTask>();

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Health check
app.get('/health', (req, res) => {
  const runningTasks = Array.from(tasks.values()).filter(t => t.status === 'running').length;
  res.json({
    status: 'ok',
    version: process.env.npm_package_version,
    tasks: {
      running: runningTasks,
      total: tasks.size,
      maxConcurrent: maxConcurrentTasks
    }
  });
});

// Start research
app.post('/research', async (req, res) => {
  try {
    // Validate request body
    const result = ResearchRequestSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: result.error.issues
      });
    }

    // Check concurrent task limit
    const runningTasks = Array.from(tasks.values()).filter(t => t.status === 'running').length;
    if (runningTasks >= maxConcurrentTasks) {
      return res.status(429).json({
        error: 'Too many concurrent tasks',
        message: `Maximum of ${maxConcurrentTasks} concurrent tasks allowed`
      });
    }

    const { query, depth, breadth } = result.data;
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const progress = new ProgressManager();
    const output = new OutputManager();
    
    const task: ResearchTask = {
      id: taskId,
      query,
      depth,
      breadth,
      status: 'running',
      startTime: new Date(),
    };
    
    tasks.set(taskId, task);

    // Start research in background
    deepResearch({
      query,
      depth,
      breadth,
      onProgress: (progress) => {
        const task = tasks.get(taskId);
        if (task && task.progress) {
          task.progress.update(progress);
        }
      }
    }).then(result => {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.endTime = new Date();
        task.results = result.learnings;
      }
    }).catch((error: unknown) => {
      console.error(`Task ${taskId} failed:`, error);
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : String(error);
        task.endTime = new Date();
      }
    });

    res.json({
      taskId,
      status: 'running',
      query,
      config: { depth, breadth }
    });
  } catch (error) {
    console.error('Error starting research:', error);
    res.status(500).json({
      error: 'Failed to start research task',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

    res.json({
      ...task,
      progress: task.status === 'running' && task.progress ? task.progress : undefined,
      results: task.status === 'completed' ? task.results : undefined
    });
  } catch (error) {
    console.error('Error getting research status:', error);
    res.status(500).json({
      error: 'Failed to get research status',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

// List all tasks (with pagination)
app.get('/research', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const status = req.query.status as 'running' | 'completed' | 'failed' | undefined;
    
    let taskList = Array.from(tasks.values());
    
    if (status) {
      taskList = taskList.filter(t => t.status === status);
    }
    
    const total = taskList.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    taskList = taskList
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(offset, offset + limit);
    
    res.json({
      tasks: taskList,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Error listing tasks:', error);
    res.status(500).json({
      error: 'Failed to list tasks',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

app.listen(port, host, () => {
  console.log(`Deep Research API running on http://${host}:${port}`);
});

