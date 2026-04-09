import React from 'react';
import type { CalculatedScore } from '../types';

interface ComplianceStatusBadgeProps {
    computation: CalculatedScore | null;
    isAnalyzing: boolean;
}

const ComplianceStatusBadge: React.FC<ComplianceStatusBadgeProps> = ({ computation, isAnalyzing }) => {
    if (isAnalyzing) {
        return (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 animate-pulse">
                <div className="w-3 h-3 rounded-full bg-violet-400 animate-ping" />
                <span className="text-sm font-medium text-violet-300">Analizez...</span>
            </div>
        );
    }

    if (!computation) {
        return (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm font-medium text-text-secondary">Aștept prima analiză</span>
            </div>
        );
    }

    const { finalScore, grade, color } = computation;

    const bgColor = finalScore >= 95
        ? 'bg-green-500/10 border-green-500/20'
        : finalScore >= 75
        ? 'bg-yellow-500/10 border-yellow-500/20'
        : 'bg-red-500/10 border-red-500/20';

    const dotColor = finalScore >= 95
        ? 'bg-green-400'
        : finalScore >= 75
        ? 'bg-yellow-400'
        : 'bg-red-500';

    return (
        <div className={`flex items-center gap-4 px-5 py-3 rounded-2xl border ${bgColor}`}>
            <div className={`w-3 h-3 rounded-full ${dotColor} animate-pulse`} />
            <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold mono ${color}`}>{finalScore}</span>
                <span className="text-xs text-text-secondary">/100</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <span className={`text-sm font-semibold ${color}`}>{grade}</span>
        </div>
    );
};

export default ComplianceStatusBadge;
