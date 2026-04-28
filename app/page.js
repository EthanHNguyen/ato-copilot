"use client";

import React, { useRef, useState } from 'react';
import { 
  Upload, 
  Shield, 
  AlertCircle, 
  FileCheck, 
  Zap, 
  ChevronRight, 
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
  ArrowRight,
  Copy,
  Check,
  Info,
  Terminal,
  Activity,
  ArrowUpRight
} from 'lucide-react';

export default function ATOCopilot() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [copied, setCopied] = useState(false);
  const [selectedControl, setSelectedControl] = useState(null);
  const [error, setError] = useState(null);
  const [scanStep, setScanStep] = useState('Ready to scan package evidence');
  const [selectedArtifact, setSelectedArtifact] = useState(null);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async (file) => {
    setError(null);
    setLoading(true);
    setSelectedArtifact(file?.name || null);
    setScanStep(file ? `Uploading ${file.name}...` : 'Contacting analysis API...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch(`${apiBaseUrl}/analyze`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      setScanStep('Parsing control evidence...');

      if (!response.ok) {
        throw new Error(`Analysis request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Analysis response was not a control list');
      }

      setScanStep('Rendering control analysis...');
      setAnalysis(data);
      // Default to AC-2 for the deep dive as per PRD
      setSelectedControl(data.find(c => c.id === 'AC-2') || data[0]);
    } catch (error) {
      console.error('Analysis failed', error);
      setAnalysis(null);
      setSelectedControl(null);
      setError('Package scan failed. Confirm the analysis API is running and returned a valid control list.');
      setScanStep('Ready to scan package evidence');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleFileSelection = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-300 font-mono selection:bg-blue-500/30 overflow-x-hidden">
      <div className="bg-green-600 text-black text-center text-[11px] font-bold tracking-[0.25em] py-1 uppercase">
        DEMO DATA -- NO CUI
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-4">
        {/* Header / Command Bar */}
        <header className="flex items-center justify-between mb-8 border border-slate-800 p-2 rounded-sm bg-[#161B22]">
          <div className="flex items-center gap-3 px-2">
            <Shield className="text-blue-500 w-5 h-5" />
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">ATO.COPILOT<span className="text-slate-500 font-normal ml-2">v2.4.0</span></h1>
          </div>

          <div className="flex-1 max-w-md mx-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-3 w-3 text-slate-500" />
              </div>
              <input 
                type="text" 
                readOnly
                placeholder="Security Context Search..." 
                className="w-full bg-[#0B0E14] border border-slate-800 py-1.5 pl-9 pr-12 text-xs text-slate-400 focus:outline-none focus:border-slate-700 rounded-sm"
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <span className="text-[10px] text-slate-600 font-sans border border-slate-800 px-1 rounded-sm">⌘K</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 px-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-green-500 flex items-center gap-1.5 font-bold">
                <span className="w-1 h-1 rounded-full bg-green-500" />
                SEC_CONNECTED
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="text-[10px] text-slate-500 font-bold">
              AUTH: <span className="text-blue-500">G_ADMIN</span>
            </div>
          </div>
        </header>

        <main>
          {!analysis && !loading ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              {error && (
                <div className="border border-red-500/30 bg-red-500/10 p-4 rounded-sm text-red-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="border border-slate-800 bg-[#161B22] p-6 rounded-sm">
                <div className="flex items-center gap-2 text-[10px] text-blue-500 font-bold mb-4">
                  <Terminal className="w-3 h-3" />
                  SYSTEM_INITIALIZED // COMPLIANCE_PREP_DAEMON_V2
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 tracking-tighter uppercase">
                  Security Evidence Analysis Terminal
                </h2>
                <p className="text-slate-400 text-sm max-w-2xl font-mono leading-relaxed">
                  Agentic review of uploaded artifacts against NIST 800-53/FedRAMP evidence requirements. 
                  The agent plans the review, searches cited evidence, validates gaps, and predicts reviewer inquiry patterns.
                </p>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  onChange={handleFileSelection}
                  accept=".zip,.csv,.txt,.log,.json,.jsonl"
                  data-testid="evidence-file-input"
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="group w-full border border-slate-800 bg-[#0B0E14] hover:bg-[#161B22] p-12 text-center transition-all cursor-pointer rounded-sm border-dashed disabled:cursor-wait disabled:opacity-70"
                >
                  <div className="mx-auto w-12 h-12 border border-slate-800 flex items-center justify-center mb-4 group-hover:border-blue-500 transition-colors">
                    <Upload className="w-5 h-5 text-slate-500 group-hover:text-blue-500" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-widest">INITIATE PACKAGE SCAN</h3>
                  <p className="text-slate-500 text-xs font-mono">
                    [ ZIP, CSV, TXT, JSONL, LOG ]
                  </p>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: Shield, title: "PLAN", desc: "CONTROL REQUIREMENT REVIEW" },
                  { icon: Zap, title: "USE_TOOLS", desc: "CITED EVIDENCE SEARCH" },
                  { icon: Search, title: "VALIDATE", desc: "SUPPORTED CLAIMS + GAPS" }
                ].map((item, i) => (
                  <div key={i} className="border border-slate-800 p-4 bg-[#161B22] rounded-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className="w-3 h-3 text-blue-500" />
                      <h4 className="text-[10px] font-bold text-white uppercase">{item.title}</h4>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="min-h-[400px] border border-slate-800 bg-[#0B0E14] p-8 font-mono">
              <div className="flex items-center gap-2 text-blue-500 mb-6">
                <Activity className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest">Running Evidence Review Agent...</span>
              </div>
              <div className="mb-6 border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-blue-200 text-xs font-bold uppercase tracking-widest rounded-sm">
                {scanStep}
              </div>
              {selectedArtifact && (
                <div className="mb-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Artifact: <span className="text-slate-300">{selectedArtifact}</span>
                </div>
              )}
              <div className="space-y-2 text-[11px]">
                <div className="text-slate-500">[ 0.001 ] INITIALIZING_SCAN_ENGINE... <span className="text-green-500">OK</span></div>
                <div className="text-slate-500">[ 0.124 ] LOADING_CONTROL_REQUIREMENTS... <span className="text-green-500">OK</span></div>
                <div className="text-slate-500">[ 0.452 ] EXTRACTING_ARTIFACTS_FROM_PACKAGE... <span className="text-blue-500">IN_PROGRESS</span></div>
                <div className="text-slate-400">[ 0.891 ] RUNNING_AGENT_TOOL_TRACE...</div>
                <div className="text-slate-600">[ ..... ] VALIDATING_CLAIMS_AC_2_AU_6_CM_6...</div>
              </div>
              
              <div className="mt-8 space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                  <span>Progress</span>
                  <span>74%</span>
                </div>
                <div className="h-1 bg-slate-900 border border-slate-800 rounded-sm overflow-hidden">
                  <div className="h-full bg-blue-500 animate-progress-fast" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Section 1: Package Prep Snapshot */}
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-slate-500" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analysis Snapshot</h3>
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    [ 3_CONTROLS_LOCATED ]
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {analysis.map((ctrl, i) => (
                    <div 
                      key={ctrl.id}
                      onClick={() => setSelectedControl(ctrl)}
                      className={`group border p-4 transition-all cursor-pointer rounded-sm ${
                        selectedControl?.id === ctrl.id 
                          ? 'border-blue-500 bg-[#161B22]' 
                          : 'border-slate-800 bg-[#0B0E14] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-bold font-mono text-blue-500">
                          {ctrl.id}
                        </span>
                        <div className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded-sm ${
                          ctrl.status === 'Needs Prep Review' 
                            ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                            : 'bg-green-500/10 text-green-500 border-green-500/20'
                        }`}>
                          {ctrl.status === 'Needs Prep Review' ? '[!] NEEDS PREP' : '[✓] READY'}
                        </div>
                      </div>
                      <h4 className="font-bold text-white mb-2 text-xs uppercase tracking-tight">{ctrl.name}</h4>
                      
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                          <span>CONFIDENCE</span>
                          <span className="text-blue-500">{(ctrl.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-slate-900 border border-slate-800 rounded-sm overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                              ctrl.status === 'Needs Prep Review' ? 'bg-blue-600' : 'bg-green-600'
                            }`}
                            style={{ width: `${ctrl.confidence * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 2: Deep Dive */}
              {selectedControl && (
                <section className="grid grid-cols-1 lg:grid-cols-5 gap-0 border border-slate-800 rounded-sm overflow-hidden bg-[#161B22] animate-in fade-in duration-500">
                  {/* Left Column: Analysis */}
                  <div className="lg:col-span-3 border-r border-slate-800 p-6 space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 border border-blue-500/30 bg-blue-500/10 rounded-sm">
                        <Zap className="text-blue-500 w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">Control Analysis Deep Dive</div>
                        <h3 className="text-lg font-bold text-white uppercase tracking-tight">{selectedControl.id}: {selectedControl.name}</h3>
                        {selectedControl.insight_source === 'openrouter_model' && (
                          <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-green-500">
                            AI-GENERATED REVIEWER INSIGHT
                          </div>
                        )}
                        {selectedControl.insight_source === 'agentic_evidence_review' && (
                          <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-green-500">
                            AGENTIC EVIDENCE REVIEW
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedControl.agent_plan?.length > 0 && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-2">
                          <Terminal className="w-3 h-3" />
                          Agent Plan
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedControl.agent_plan.map((step, idx) => (
                            <div key={idx} className="bg-[#0B0E14] border border-slate-800 p-3 rounded-sm text-[10px] text-slate-300 leading-relaxed">
                              <span className="text-green-500 font-bold mr-2">{String(idx + 1).padStart(2, '0')}</span>
                              {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        Predicted Reviewer Question
                      </label>
                      <div className="bg-[#0B0E14] border border-amber-500/30 p-6 rounded-sm relative">
                        <p className="text-lg font-bold text-white leading-tight italic tracking-tight">
                          "{selectedControl.reviewer_question}"
                        </p>
                        <button 
                          onClick={() => copyToClipboard(selectedControl.reviewer_question)}
                          className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-white transition-colors"
                        >
                          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                        <FileCheck className="w-3 h-3" />
                        Recommended Action
                      </label>
                      <div className="bg-[#0B0E14] border border-blue-500/30 p-6 rounded-sm">
                        <p className="text-slate-300 font-bold text-sm leading-relaxed">
                          {selectedControl.suggestion}
                        </p>
                      </div>
                    </div>

                    {selectedControl.evidence_claims?.length > 0 && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" />
                          Evidence Claims
                        </label>
                        <div className="space-y-2">
                          {selectedControl.evidence_claims.map((claim, idx) => (
                            <div key={idx} className="bg-[#0B0E14] border border-green-500/20 p-4 rounded-sm">
                              <p className="text-slate-200 text-xs font-bold mb-2">{claim.claim}</p>
                              <div className="space-y-1">
                                {claim.citations?.map((citation) => (
                                  <div key={citation.chunk_id} className="text-[9px] text-green-400/80 break-all">
                                    {citation.artifact} // {citation.location} // {citation.hash}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedControl.confidence_rationale && (
                      <div className="bg-[#0B0E14] border border-slate-800 p-4 rounded-sm text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
                        Confidence Rationale: <span className="normal-case tracking-normal text-slate-300">{selectedControl.confidence_rationale}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Metadata / Trace */}
                  <div className="lg:col-span-2 bg-[#0B0E14] p-6 space-y-8">
                    <div className="space-y-6">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">Reasoning Trace</h3>
                      <div className="space-y-4 font-mono text-[10px]">
                        {selectedControl.reasoning.map((step, idx) => (
                          <div key={idx} className="flex gap-3 text-slate-400 group">
                            <span className="text-blue-500 shrink-0">0{idx + 1}</span>
                            <p className="group-hover:text-slate-200 transition-colors">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Data Provenance</h3>
                      <div className="bg-[#161B22] border border-slate-800 p-4 font-mono text-[9px] break-all text-blue-400/80">
                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                          <Search className="w-2.5 h-2.5" />
                          SOURCE_FILE
                        </div>
                        {selectedControl.provenance}
                      </div>
                    </div>

                    {selectedControl.tool_trace?.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-slate-800">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tool Trace</h3>
                        <div className="space-y-2 font-mono text-[10px]">
                          {selectedControl.tool_trace.map((trace, idx) => (
                            <div key={idx} className="bg-[#161B22] border border-slate-800 p-3 rounded-sm">
                              <div className="text-blue-500 font-bold uppercase">{trace.tool}</div>
                              <div className="text-slate-500 mt-1">INPUT: <span className="text-slate-300">{trace.input}</span></div>
                              <div className="text-slate-500 mt-1">RESULT: <span className="text-slate-300">{trace.result}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={() => {
                        setAnalysis(null);
                        setSelectedControl(null);
                      }}
                      className="w-full py-3 border border-slate-800 hover:bg-slate-800 text-slate-500 hover:text-white transition-all flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest rounded-sm"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Clear Session
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
        </main>

        <footer className="mt-12 text-center pb-8 border-t border-slate-900 pt-8">
          <p className="text-slate-700 text-[10px] font-bold uppercase tracking-[0.4em]">
            v2.4.0-STABLE
          </p>
        </footer>
      </div>

      <div className="bg-green-600 text-black text-center text-[11px] font-bold tracking-[0.25em] py-1 uppercase">
        DEMO DATA -- NO CUI
      </div>

      <style jsx global>{`
        @keyframes progress-fast {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-progress-fast {
          animation: progress-fast 2s ease-in-out infinite;
        }
        .animate-in {
          animation: fade-in 0.5s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
