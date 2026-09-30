import React, { useState } from 'react';
import { 
  ShieldAlert, 
  FileText, 
  Check, 
  X, 
  AlertTriangle, 
  Sparkles, 
  HeartHandshake, 
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { TERMS_SECTIONS, TERMS_VERSION, TERMS_LAST_UPDATED } from '../constants/termsContent';

interface TermsModalProps {
  isOpen: boolean;
  isBlocking?: boolean; // When true, user cannot dismiss until accepting
  acceptedDate?: string;
  onAccept?: () => void;
  onClose?: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  isBlocking = false,
  acceptedDate,
  onAccept,
  onClose
}) => {
  const [hasAgreed, setHasAgreed] = useState(false);

  if (!isOpen) return null;

  const handleAcceptClick = () => {
    if (!hasAgreed) return;
    onAccept?.();
  };

  const formattedAcceptedDate = acceptedDate ? (() => {
    try {
      const d = new Date(acceptedDate);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  })() : '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="terms-title" className="text-base sm:text-lg font-black text-white truncate">
                  Terms of Service &amp; Health Disclaimer
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                  v{TERMS_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isBlocking 
                  ? 'Please review and accept to unlock NutriFit AI' 
                  : `Last updated ${TERMS_LAST_UPDATED}${formattedAcceptedDate ? ` • Accepted on ${formattedAcceptedDate}` : ''}`}
              </p>
            </div>
          </div>

          {!isBlocking && onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition shrink-0 cursor-pointer"
              title="Close terms"
              aria-label="Close terms"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Terms Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-300 text-xs sm:text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
          
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-slate-950/70 border border-rose-500/25 rounded-2xl p-3 space-y-1 shadow-sm">
              <div className="flex items-center space-x-1.5 text-rose-400 font-bold text-xs">
                <Stethoscope className="w-4 h-4 shrink-0" />
                <span>Not Medical Advice</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Personal wellness logger only. Consult a physician before any diet, deficit, or workout.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-amber-500/25 rounded-2xl p-3 space-y-1 shadow-sm">
              <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-xs">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>AI Accuracy</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Gemini AI is experimental. AI macro and workout estimates may contain errors; always verify.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-emerald-500/25 rounded-2xl p-3 space-y-1 shadow-sm">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs">
                <HeartHandshake className="w-4 h-4 shrink-0" />
                <span>Use at Own Risk</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                You voluntarily assume all health, metabolic, and physical risks associated with your lifestyle.
              </p>
            </div>
          </div>

          {/* Full Sections */}
          <div className="space-y-4 pt-1">
            {TERMS_SECTIONS.map(section => (
              <div 
                key={section.id} 
                className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span className="text-cyan-400 font-mono font-bold">{section.number}.</span>
                    <span>{section.title}</span>
                  </h3>
                  {section.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${section.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                      {section.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-[11px] sm:text-xs text-slate-300/90 leading-relaxed">
                  {section.paragraphs.map((para, pIdx) => {
                    const colonIndex = para.indexOf(':');
                    const hasBoldLead = colonIndex > 0 && colonIndex < 35;

                    return (
                      <p key={pIdx}>
                        {hasBoldLead ? (
                          <>
                            <strong className="text-white font-semibold">{para.slice(0, colonIndex + 1)}</strong>
                            {para.slice(colonIndex + 1)}
                          </>
                        ) : (
                          para
                        )}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Offline & Privacy Footnote */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center space-x-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Private &amp; Client-Side:</strong> All your logs, meals, and health entries stay locally on your device or in your personal Google Drive.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex flex-col gap-3 shrink-0">
          {isBlocking ? (
            <>
              {/* Checkbox Acknowledgment */}
              <label className="flex items-start space-x-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={e => setHasAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/30 bg-slate-800 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-300 group-hover:text-white leading-relaxed">
                  I have read and agree to the <strong>Terms of Service &amp; Health Disclaimer</strong>. I understand that NutriFit AI is not medical advice, uses experimental AI models, and that I use the application at my own sole risk.
                </span>
              </label>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-slate-500">
                  {hasAgreed ? 'Agreement ready to confirm' : 'Checkbox required to continue'}
                </span>
                <button
                  type="button"
                  onClick={handleAcceptClick}
                  disabled={!hasAgreed}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center space-x-2 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Accept &amp; Continue</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Agreement Active (Version {TERMS_VERSION})</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
