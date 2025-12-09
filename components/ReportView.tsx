import React, { useState, useEffect } from 'react';
import { InterviewReport } from '../types';
import { ResponsiveContainer, RadialBarChart, RadialBar, Legend, Tooltip } from 'recharts';
import { Star, MessageCircle, Zap, FileText, ArrowRight, Save, History, Trash2, X, Check, Calendar } from 'lucide-react';

interface ReportViewProps {
  report: InterviewReport;
  transcript?: string;
  onRestart: () => void;
}

interface SavedReport {
  id: number;
  date: string;
  report: InterviewReport;
  transcript: string;
}

const ReportView: React.FC<ReportViewProps> = ({ report, transcript, onRestart }) => {
  const [currentReport, setCurrentReport] = useState<InterviewReport>(report);
  const [currentTranscript, setCurrentTranscript] = useState<string | undefined>(transcript);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('interview_reports');
    if (saved) {
      try {
        setSavedReports(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved reports", e);
      }
    }
  }, []);

  // Sync state if props change (e.g. new interview finished)
  useEffect(() => {
    setCurrentReport(report);
    setCurrentTranscript(transcript);
    setLoadedId(null);
    setSaveStatus('idle');
  }, [report, transcript]);

  const handleSave = () => {
    const newReport: SavedReport = {
      id: Date.now(),
      date: new Date().toISOString(),
      report: currentReport,
      transcript: currentTranscript || ''
    };

    const updatedReports = [newReport, ...savedReports];
    setSavedReports(updatedReports);
    localStorage.setItem('interview_reports', JSON.stringify(updatedReports));
    setLoadedId(newReport.id);
    setSaveStatus('saved');
    
    // Reset save status animation after 2s
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedReports = savedReports.filter(r => r.id !== id);
    setSavedReports(updatedReports);
    localStorage.setItem('interview_reports', JSON.stringify(updatedReports));
    if (loadedId === id) {
      setLoadedId(null);
    }
  };

  const handleLoad = (saved: SavedReport) => {
    setCurrentReport(saved.report);
    setCurrentTranscript(saved.transcript);
    setLoadedId(saved.id);
    setIsHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const chartData = [
    { name: 'Communication', score: currentReport.communicationScore, fill: '#6366f1' },
    { name: 'Confidence', score: currentReport.confidenceScore, fill: '#8b5cf6' },
    { name: 'Fluency', score: currentReport.fluencyScore, fill: '#ec4899' },
    { name: 'Resume Quality', score: currentReport.resumeQualityScore, fill: '#14b8a6' },
    { name: 'ATS Score', score: currentReport.finalAtsScore, fill: '#f59e0b' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-12 relative">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center text-white relative">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="absolute top-6 right-6 p-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            <History size={16} />
            History
          </button>
          
          <h2 className="text-3xl font-bold mb-2">Interview Performance Report</h2>
          <p className="text-indigo-100 opacity-90">
            {loadedId ? `Viewing saved report from ${formatDate(savedReports.find(r => r.id === loadedId)?.date || '')}` : 'Here is a detailed breakdown of your session.'}
          </p>
        </div>

        <div className="p-8 grid lg:grid-cols-2 gap-10">
          {/* Chart Section */}
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Score Overview</h3>
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  innerRadius="20%" 
                  outerRadius="100%" 
                  barSize={20} 
                  data={chartData} 
                  startAngle={180} 
                  endAngle={0}
                >
                  <RadialBar
                    label={{ position: 'insideStart', fill: '#fff' }}
                    background
                    dataKey="score"
                  />
                  <Legend 
                    iconSize={10} 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6 w-full bg-slate-50 p-6 rounded-xl border border-slate-100">
               <h4 className="flex items-center gap-2 font-bold text-slate-700 mb-2">
                 <MessageCircle className="text-indigo-500" size={20} />
                 Feedback Summary
               </h4>
               <p className="text-slate-600 text-sm leading-relaxed">
                 {currentReport.feedbackSummary}
               </p>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-6">
            {/* Job Suggestions */}
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-3">
                <Star className="text-yellow-500" size={20} />
                Recommended Roles
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentReport.jobSuggestions.map((job, i) => (
                  <span key={i} className="px-4 py-2 bg-yellow-50 text-yellow-800 rounded-lg text-sm font-medium border border-yellow-100">
                    {job}
                  </span>
                ))}
              </div>
            </div>

            {/* Improvement Roadmap */}
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-3">
                <Zap className="text-indigo-500" size={20} />
                Skill Improvement Roadmap
              </h3>
              <div className="space-y-3">
                {currentReport.skillRoadmap.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-slate-600 text-sm">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {currentTranscript && (
          <div className="mx-8 mb-8 pt-8 border-t border-slate-100">
             <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-4">
               <FileText className="text-slate-500" size={20} />
               Full Interview Transcript
             </h3>
             <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 max-h-96 overflow-y-auto whitespace-pre-wrap text-slate-700 text-sm leading-relaxed">
               {currentTranscript}
             </div>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={handleSave}
          disabled={loadedId !== null}
          className={`flex items-center gap-2 px-8 py-4 rounded-full font-semibold shadow-lg transition-all ${
            loadedId !== null 
              ? 'bg-green-100 text-green-700 cursor-default'
              : saveStatus === 'saved'
                ? 'bg-green-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          {loadedId !== null ? (
            <>
              <Check size={20} />
              Saved
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <Check size={20} />
              Saved!
            </>
          ) : (
            <>
              <Save size={20} />
              Save Report
            </>
          )}
        </button>

        <button
          onClick={onRestart}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-lg font-semibold py-4 px-10 rounded-full shadow-lg transition-all"
        >
          Start New Interview
          <ArrowRight size={20} />
        </button>
      </div>

      {/* History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <History className="text-indigo-600" size={24} />
                Interview History
              </h3>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {savedReports.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No saved reports found.</p>
                </div>
              ) : (
                savedReports.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleLoad(item)}
                    className={`group p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md flex justify-between items-center ${
                      loadedId === item.id 
                        ? 'bg-indigo-50 border-indigo-200' 
                        : 'bg-white border-slate-100 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${loadedId === item.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600'} transition-colors`}>
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800">{formatDate(item.date)}</h4>
                        <div className="flex gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            Comm: {item.report.communicationScore}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            Conf: {item.report.confidenceScore}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete report"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportView;