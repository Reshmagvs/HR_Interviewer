import React from 'react';
import { ResumeAnalysis } from '../types';
import { AlertCircle, CheckCircle, TrendingUp, Briefcase } from 'lucide-react';

interface AnalysisViewProps {
  analysis: ResumeAnalysis;
  onContinue: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis, onContinue }) => {
  // Color code the ATS score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 border-green-200';
    if (score >= 60) return 'bg-yellow-100 border-yellow-200';
    return 'bg-red-100 border-red-200';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Resume Analysis</h2>
            <p className="text-slate-500">Here is what our AI found in your profile</p>
          </div>
          <div className={`px-6 py-3 rounded-xl border ${getScoreBg(analysis.atsScore)} flex flex-col items-center`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">ATS Score</span>
            <span className={`text-3xl font-bold ${getScoreColor(analysis.atsScore)}`}>{analysis.atsScore}/100</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Key Strengths */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-lg">
              <CheckCircle className="text-green-500" size={20} />
              Key Strengths
            </h3>
            <ul className="space-y-2">
              {analysis.strengths.slice(0, 4).map((strength, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0"></span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          {/* Improvement Points */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-lg">
              <TrendingUp className="text-indigo-500" size={20} />
              Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {analysis.improvements.slice(0, 4).map((imp, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></span>
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100">
           <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-lg mb-3">
              <Briefcase className="text-blue-500" size={20} />
              Experience Summary
            </h3>
            <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
              {analysis.experienceSummary}
            </p>
        </div>

        {analysis.missingInfo.length > 0 && (
           <div className="mt-6">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-lg mb-3">
               <AlertCircle className="text-amber-500" size={20} />
               Missing Information
             </h3>
             <div className="flex flex-wrap gap-2">
               {analysis.missingInfo.map((info, i) => (
                 <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-100">
                   {info}
                 </span>
               ))}
             </div>
           </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onContinue}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
        >
          Proceed to Interview Setup
        </button>
      </div>
    </div>
  );
};

export default AnalysisView;