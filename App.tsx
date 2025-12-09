import React, { useState } from 'react';
import ResumeUploader from './components/ResumeUploader';
import AnalysisView from './components/AnalysisView';
import InterviewSession from './components/InterviewSession';
import ReportView from './components/ReportView';
import { AppStep, ResumeAnalysis, InterviewDuration, InterviewReport } from './types';
import { analyzeResume, generateInterviewReport } from './services/gemini';
import { Clock } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [duration, setDuration] = useState<InterviewDuration>(3);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [transcriptData, setTranscriptData] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (text: string, imageData?: string, mimeType?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeResume(text, imageData, mimeType);
      setAnalysis(result);
      setStep(AppStep.ANALYSIS);
    } catch (err: any) {
      console.error(err);
      setError("Unable to analyze resume. Please try again or use a clearer image/text.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDurationSelect = (dur: InterviewDuration) => {
    setDuration(dur);
    setStep(AppStep.INTERVIEW);
  };

  const handleInterviewComplete = async (transcript: string) => {
    if (!analysis) return;
    setIsLoading(true);
    setTranscriptData(transcript);
    setStep(AppStep.REPORT);
    try {
      const result = await generateInterviewReport(transcript || "No conversation recorded.", analysis);
      setReport(result);
    } catch (err) {
      console.error(err);
      setError("Failed to generate report.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = () => {
    setStep(AppStep.UPLOAD);
    setAnalysis(null);
    setReport(null);
    setTranscriptData('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">HR</div>
            <h1 className="text-xl font-bold text-slate-800">AI Interviewer</h1>
          </div>
          <div className="text-sm text-slate-500 font-medium">
             {step === AppStep.UPLOAD && 'Step 1: Upload'}
             {step === AppStep.ANALYSIS && 'Step 2: Review'}
             {step === AppStep.DURATION_SELECT && 'Step 3: Setup'}
             {step === AppStep.INTERVIEW && 'Step 4: Interview'}
             {step === AppStep.REPORT && 'Final Report'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6">
        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        {step === AppStep.UPLOAD && (
          <div className="mt-10">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Master Your Next Interview</h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Upload your resume, get instant feedback, and practice with our realistic AI HR manager in real-time.
              </p>
            </div>
            <ResumeUploader onAnalyze={handleAnalyze} isLoading={isLoading} />
          </div>
        )}

        {step === AppStep.ANALYSIS && analysis && (
          <AnalysisView 
            analysis={analysis} 
            onContinue={() => setStep(AppStep.DURATION_SELECT)} 
          />
        )}

        {step === AppStep.DURATION_SELECT && (
           <div className="max-w-2xl mx-auto mt-20 text-center">
             <h2 className="text-3xl font-bold text-slate-800 mb-8">Choose Interview Duration</h2>
             <div className="grid grid-cols-2 gap-8">
               <button 
                 onClick={() => handleDurationSelect(3)}
                 className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-2xl hover:border-indigo-600 hover:shadow-xl transition-all group"
               >
                 <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                   <Clock size={32} />
                 </div>
                 <span className="text-2xl font-bold text-slate-800 mb-2">3 Minutes</span>
                 <span className="text-slate-500">Quick screening check</span>
               </button>

               <button 
                 onClick={() => handleDurationSelect(5)}
                 className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-2xl hover:border-indigo-600 hover:shadow-xl transition-all group"
               >
                 <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                   <Clock size={32} />
                 </div>
                 <span className="text-2xl font-bold text-slate-800 mb-2">5 Minutes</span>
                 <span className="text-slate-500">Standard interview session</span>
               </button>
             </div>
           </div>
        )}

        {step === AppStep.INTERVIEW && analysis && (
          <InterviewSession 
            analysis={analysis} 
            duration={duration} 
            onComplete={handleInterviewComplete} 
          />
        )}

        {step === AppStep.REPORT && (
          <>
            {!report ? (
              <div className="flex flex-col items-center justify-center h-[50vh]">
                 <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-6"></div>
                 <h3 className="text-xl font-semibold text-slate-800">Generating Performance Report...</h3>
                 <p className="text-slate-500 mt-2">Analyzing your communication skills and confidence levels.</p>
              </div>
            ) : (
              <ReportView report={report} transcript={transcriptData} onRestart={handleRestart} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;