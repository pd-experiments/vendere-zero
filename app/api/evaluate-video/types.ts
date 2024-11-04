import { AdStructuredOutputSchema } from '../evaluate/schemas';
import { z } from 'zod';

type AdStructuredOutput = z.infer<typeof AdStructuredOutputSchema>;

export interface VideoEvaluation {
  frameData: string;
  evaluation: AdStructuredOutput;
}

export interface VideoEvaluationResponse {
  total_frames: number;
  evaluations: VideoEvaluation[];
} 