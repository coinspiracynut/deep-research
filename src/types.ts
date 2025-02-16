import { z } from 'zod';
import { ProgressManager } from './progress-manager';
import { OutputManager } from './output-manager';

export const ResearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  depth: z.number().int().min(1).max(5).optional().default(3),
  breadth: z.number().int().min(1).max(5).optional().default(3),
});

export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;

export interface ResearchTask {
  id: string;
  query: string;
  depth: number;
  breadth: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  startTime: Date;
  endTime?: Date;
  results?: string[];
  progress?: ProgressManager;
  output?: OutputManager;
}

export interface ResearchProgress {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
}
