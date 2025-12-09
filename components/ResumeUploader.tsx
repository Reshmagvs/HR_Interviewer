import React, { useState } from 'react';
import { Upload, FileText, Type } from 'lucide-react';

interface ResumeUploaderProps {
  onAnalyze: (text: string, imageData?: string, mimeType?: string) => void;
  isLoading: boolean;
}

const ResumeUploader: React.FC<ResumeUploaderProps> = ({ onAnalyze, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [textInput, setTextInput] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      onAnalyze('', base64String, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      onAnalyze(textInput);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
      <div className="bg-indigo-600 p-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Upload Your Resume</h2>
        <p className="text-indigo-100">Let AI analyze your profile and prepare your interview.</p>
      </div>
      
      <div className="p-6">
        <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'upload' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload size={18} />
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'text' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Type size={18} />
            Paste Text
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-indigo-600">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="font-medium">Analyzing your resume...</p>
          </div>
        ) : (
          <>
            {activeTab === 'upload' ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-10 bg-slate-50 hover:bg-slate-100 transition-colors">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <div className="bg-indigo-100 p-4 rounded-full mb-4 text-indigo-600">
                    <FileText size={32} />
                  </div>
                  <span className="text-lg font-medium text-slate-700 mb-1">
                    {fileName ? fileName : 'Click to Upload Resume'}
                  </span>
                  <span className="text-sm text-slate-500">
                    Supports PDF, PNG, JPG
                  </span>
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Paste your resume contents here..."
                  className="w-full h-64 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                  className="self-end px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Analyze Text
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResumeUploader;