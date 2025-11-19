import React from 'react';
import { ChartBarIcon, ArrowUpCircleIcon, ArrowDownCircleIcon } from './icons';

interface StoreStats {
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

interface StoreSummaryCardProps {
  storeName: string;
  stats: StoreStats;
  onSelectStore: () => void;
}

const getHealthColor = (score: number | null) => {
    if (score === null) return { bg: 'bg-gray-700/50', text: 'text-gray-400', border: 'border-gray-600' };
    if (score >= 85) return { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500' };
    if (score >= 70) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500' };
    if (score >= 55) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500' };
    return { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500' };
};

const StatItem: React.FC<{ icon: React.FC<{className?: string}>, label: string, value: string | number | null, colorClass: string }> = ({ icon: Icon, label, value, colorClass }) => (
    <div className="flex flex-col items-center text-center">
        <Icon className={`w-7 h-7 mb-1 ${colorClass}`} />
        <p className="text-xl font-bold mono text-white">{value ?? 'N/A'}</p>
        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">{label}</p>
    </div>
);


const StoreSummaryCard: React.FC<StoreSummaryCardProps> = ({ storeName, stats, onSelectStore }) => {
    const healthColor = getHealthColor(stats.avg);

    return (
        <button 
            onClick={onSelectStore} 
            className="glass-panel p-6 rounded-2xl flex flex-col justify-between items-center text-center aspect-square transition-all duration-300 hover:bg-white/5 hover:scale-[1.03] focus-visible:scale-[1.03] focus-visible:border-cyan-400"
        >
            <h2 className="text-3xl font-bold text-white">Mobexpert {storeName}</h2>

            <div className="flex flex-col items-center my-4">
                <p className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Health Score</p>
                <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 ${healthColor.border} ${healthColor.bg}`}>
                    <span className={`text-5xl font-extrabold mono ${healthColor.text}`}>{stats.avg ?? '--'}</span>
                </div>
            </div>

            <div className="w-full grid grid-cols-3 gap-4 pt-4 border-t border-[var(--border-subtle)]">
                <StatItem icon={ChartBarIcon} label="Audituri" value={stats.count} colorClass="text-gray-400" />
                <StatItem icon={ArrowDownCircleIcon} label="Scor Min" value={stats.min} colorClass="text-pink-400" />
                <StatItem icon={ArrowUpCircleIcon} label="Scor Max" value={stats.max} colorClass="text-cyan-400" />
            </div>
        </button>
    );
};

export default StoreSummaryCard;
