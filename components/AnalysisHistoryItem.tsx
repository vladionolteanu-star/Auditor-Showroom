import React from 'react';
import type { AnalysisSnapshot, ComplianceReport } from '../types';

interface AnalysisHistoryItemProps {
    snapshot: AnalysisSnapshot;
    isSelected: boolean;
    onSelect: () => void;
}

const AnalysisHistoryItem: React.FC<AnalysisHistoryItemProps> = ({ snapshot, isSelected, onSelect }) => {
    const hasError = !snapshot.report.isValid || 'error' in snapshot.report;
    const report = snapshot.report as ComplianceReport;
    const score = hasError ? null : report.computation.finalScore;
    const violationCount = hasError ? 0 : report.violations.length;

    const time = new Date(snapshot.timestamp).toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const scoreColor = score === null
        ? 'text-gray-500'
        : score >= 95
        ? 'text-green-400'
        : score >= 75
        ? 'text-yellow-400'
        : 'text-red-500';

    const borderColor = isSelected ? 'border-violet-500/50 bg-violet-500/5' : 'border-white/5 hover:border-white/10';

    return (
        <button
            onClick={onSelect}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${borderColor}`}
        >
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                <img
                    src={snapshot.frameUrl}
                    alt=""
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold mono ${scoreColor}`}>
                        {score !== null ? score : '—'}
                    </span>
                    {violationCount > 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                            {violationCount} {violationCount === 1 ? 'problemă' : 'probleme'}
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-text-secondary">{time}</span>
            </div>
        </button>
    );
};

export default AnalysisHistoryItem;
