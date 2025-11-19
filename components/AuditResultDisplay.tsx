import React, { useMemo, memo } from 'react';
import { AuditReport, Deviation, AuditLog, Feedback } from '../types';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from './icons';
import FeedbackControls from './FeedbackControls';

const GRADE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  'Very Good': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  'Good': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/50' },
  'Needs Improvement': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  'Sub Standard': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/50' },
  'Default': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/50' }
};

const SEVERITY_CONFIG: Record<string, { bg: string; text: string }> = {
  'Mică': { bg: 'bg-blue-500/20', text: 'text-blue-300' },
  'Medie': { bg: 'bg-yellow-500/20', text: 'text-yellow-300' },
  'Mare': { bg: 'bg-pink-500/20', text: 'text-pink-300' },
  'MARE': { bg: 'bg-pink-500/20', text: 'text-pink-300' }, // Handle uppercase variant
  'CRITICĂ': { bg: 'bg-red-600/30', text: 'text-red-400' },
  'Notă': { bg: 'bg-gray-500/20', text: 'text-gray-300' }
};

const DeviationCard = memo<{ deviation: Deviation; index: number }>(({ deviation, index }) => {
  const severityStyles = SEVERITY_CONFIG[deviation.severity] ?? SEVERITY_CONFIG['Notă'];
  
  return (
    <article className="glass-panel p-3 rounded-xl hover:bg-white/5 transition-colors">
      <header className="flex justify-between items-start gap-2">
        <div className="flex items-start gap-3 flex-grow">
            <div className="w-6 h-6 flex-shrink-0 rounded-full bg-pink-500/20 text-pink-300 font-bold text-sm flex items-center justify-center mt-0.5 mono">{index + 1}</div>
            <p className="text-base font-bold text-white">{deviation.description}</p>
        </div>
        <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-full whitespace-nowrap ${severityStyles.bg} ${severityStyles.text}`}>
          {deviation.severity}
        </span>
      </header>
      <div className="mt-2 text-xs text-[var(--text-secondary)] flex items-center gap-4 pl-9">
        <span><strong className="text-gray-400">Categorie:</strong> {deviation.category}</span>
        <span><strong className="text-gray-400">Locație:</strong> {deviation.location}</span>
        <span><strong className="text-gray-400">Impact:</strong> -{deviation.finalImpact}p</span>
      </div>
    </article>
  );
});

export const AuditResultDisplay: React.FC<{ log: AuditLog, feedback?: Feedback, onFeedbackSubmit: (f: Omit<Feedback, 'timestamp'>) => void }> = ({ log, feedback, onFeedbackSubmit }) => {

  const result = log.result;
  // FIX: Use the 'in' operator for a more robust type guard. The simple `!result.isValid`
  // check was not sufficient for TypeScript to correctly narrow the union type.
  if ('error' in result) {
    return (
      <div className="text-center p-6 bg-yellow-900/50 rounded-xl text-yellow-300 border border-yellow-700">
        <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-4" />
        <h3 className="font-bold text-xl mb-2">Analiză Eșuată</h3>
        <pre className="text-sm text-left mono whitespace-pre-wrap bg-black/20 p-2 rounded-md">{result.error}</pre>
      </div>
    );
  }

  const report = result;
  const statusStyles = GRADE_CONFIG[report.grade] ?? GRADE_CONFIG['Default'];

  return (
    <>
      <main className="w-full text-left space-y-6">
        <section className={`p-4 rounded-xl border ${statusStyles.border} ${statusStyles.bg}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-bold uppercase tracking-wider ${statusStyles.text}`}>Status General</p>
              <p className="text-2xl font-bold text-white mt-1">{report.grade}</p>
            </div>
            <div className="text-center">
              <p className={`text-sm font-bold uppercase tracking-wider ${statusStyles.text}`}>Scor</p>
              <p className="text-4xl font-extrabold text-white mono">{report.score}</p>
            </div>
          </div>
        </section>

        <section className="glass-panel p-4 rounded-xl">
          <h3 className="text-lg font-bold text-cyan-300 flex items-center gap-2"><InformationCircleIcon className="w-6 h-6" /> Detaliere Scor</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)] italic">"{report.scoringBreakdown}"</p>
          <div className="text-xs grid grid-cols-2 gap-x-4 pt-2 mt-2 border-t border-[var(--border-subtle)]">
            <p><strong className="text-gray-400">Categorie:</strong> <span className="mono text-cyan-300">{report.category}</span></p>
            <p><strong className="text-gray-400">Încredere:</strong> <span className="mono text-cyan-300">{report.confidence}%</span></p>
          </div>
        </section>

        {report.deviationsFound.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-pink-400 flex items-center gap-2"><XCircleIcon className="w-6 h-6" /> Probleme Identificate ({report.deviationsFound.length})</h3>
            {report.deviationsFound.map((dev, idx) => <DeviationCard key={idx} deviation={dev} index={idx} />)}
          </section>
        )}

        {report.conformityPoints.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2"><CheckCircleIcon className="w-6 h-6" /> Aspecte Pozitive</h3>
            <ul className="list-disc list-inside text-sm text-[var(--text-secondary)]">
              {report.conformityPoints.map((point, idx) => <li key={idx}>{point}</li>)}
            </ul>
          </section>
        )}
        
        {report.recommendations.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-green-400 flex items-center gap-2"><CheckCircleIcon className="w-6 h-6" /> Recomandări Acționabile</h3>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[var(--text-secondary)]">
              {report.recommendations.map((rec, idx) => <li key={idx}>{rec}</li>)}
            </ul>
          </section>
        )}

        {report.deviationsFound.length === 0 && (
          <div className="text-center text-gray-400 p-4 glass-panel rounded-xl">
            <p className="font-semibold">✓ Nicio problemă majoră identificată.</p>
          </div>
        )}
      </main>
      <FeedbackControls 
        auditId={log.id} 
        currentFeedback={feedback} 
        onSubmit={onFeedbackSubmit}
      />
    </>
  );
};

export default memo(AuditResultDisplay);