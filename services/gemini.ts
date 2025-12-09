import { GoogleGenAI, Type } from "@google/genai";
import { ResumeAnalysis, InterviewReport } from "../types";

// Helper to get AI instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeResume = async (
  text: string,
  fileData?: string,
  mimeType?: string
): Promise<ResumeAnalysis> => {
  const ai = getAI();
  
  const prompt = `
    Analyze this resume provided below. 
    Extract the following details and return them in JSON format:
    1. ATS Score (0-100 based on keyword density, formatting, and clarity).
    2. Key Skills (array of strings).
    3. Experience Summary (concise paragraph).
    4. Strengths (array of strings).
    5. Gaps or Weaknesses (array of strings).
    6. Missing Information (what crucial details are absent?).
    7. 5 Specific Improvement Points.

    Resume Content:
    ${text ? text : '[See attached file]'}
  `;

  const parts: any[] = [{ text: prompt }];
  if (fileData && mimeType) {
    parts.push({
      inlineData: {
        data: fileData,
        mimeType: mimeType,
      },
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          atsScore: { type: Type.NUMBER },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experienceSummary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as ResumeAnalysis;
  }
  throw new Error("Failed to analyze resume");
};

export const generateInterviewReport = async (
  transcript: string,
  initialAnalysis: ResumeAnalysis
): Promise<InterviewReport> => {
  const ai = getAI();
  
  const prompt = `
    You are a Senior HR Analytics Manager. Based on the following interview transcript and the candidate's initial resume analysis, generate a comprehensive performance report in JSON.

    Initial Analysis Context:
    ATS Score: ${initialAnalysis.atsScore}
    Strengths: ${initialAnalysis.strengths.join(', ')}

    Interview Transcript:
    ${transcript}

    Required Output (JSON):
    1. Communication Skill Score (0-100).
    2. Confidence Score (0-100).
    3. Fluency Score (0-100).
    4. Resume Quality Score (0-100, re-evaluated after interview).
    5. Final ATS Score (0-100).
    6. Job & Career Suggestions (3-5 specific roles).
    7. Skill Improvement Roadmap (step-by-step list).
    8. Feedback Summary (concise paragraph on performance).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          communicationScore: { type: Type.NUMBER },
          confidenceScore: { type: Type.NUMBER },
          fluencyScore: { type: Type.NUMBER },
          resumeQualityScore: { type: Type.NUMBER },
          finalAtsScore: { type: Type.NUMBER },
          jobSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          skillRoadmap: { type: Type.ARRAY, items: { type: Type.STRING } },
          feedbackSummary: { type: Type.STRING },
        },
      },
    },
  });

  if (response.text) {
    return JSON.parse(response.text) as InterviewReport;
  }
  throw new Error("Failed to generate report");
};