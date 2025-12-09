export interface ResumeAnalysis {
  atsScore: number;
  skills: string[];
  experienceSummary: string;
  strengths: string[];
  gaps: string[];
  missingInfo: string[];
  improvements: string[];
}

export interface InterviewReport {
  communicationScore: number;
  confidenceScore: number;
  fluencyScore: number;
  resumeQualityScore: number;
  finalAtsScore: number;
  jobSuggestions: string[];
  skillRoadmap: string[];
  feedbackSummary: string;
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  ANALYSIS = 'ANALYSIS',
  DURATION_SELECT = 'DURATION_SELECT',
  INTERVIEW = 'INTERVIEW',
  REPORT = 'REPORT',
}

export type InterviewDuration = 3 | 5;

export interface AudioContextState {
  inputContext?: AudioContext;
  outputContext?: AudioContext;
}