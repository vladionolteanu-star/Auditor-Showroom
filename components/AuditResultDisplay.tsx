import React, { memo } from 'react';
import { AuditLog, Feedback } from '../types';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from './icons';
import FeedbackControls from './FeedbackControls';

// Helper pentru itemi de inventar
const InventoryRow: React.FC<{ label: string; count: number; riskLevel?: 'low' | 'high' }> = ({ label, count, riskLevel = 'low' }) => {
    if (count === 0) return null; // Nu afișăm ce e zero (reduce zgomotul)
    
    const isHighRisk = riskLevel === 'high';
    return (
        <div className={`flex justify-between items-center p-2.5 border-b border-white/5 last:border-0 ${isHighRisk ? 'bg-red-500/10' : ''}`}>
            <span className="text-sm text-gray-300">{label}</span>
            <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${isHighRisk ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}>
                {count}
            </span>
        </div>
    );
};

const BooleanRow: React.FC<{ label: string; value: boolean; isBad?: boolean }> = ({ label, value, isBad = true }) => {
    if (!value) return null; // Afișăm doar ce e detectat (true)
    
    return (
        <div className={`flex justify-between items-center p-2.5 border-b border-white/5 last:border-0 ${isBad ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
            <span className="text-sm text-gray-300">{label}</span>
            <span className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded tracking-wider ${isBad ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                DETECTAT
            </span>
        </div>
    );
};

export const AuditResultDisplay: React.FC<{ log: AuditLog, feedback?: Feedback, onFeedbackSubmit: (f: Omit<Feedback, 'timestamp'>) => void }> = ({ log, feedback, onFeedbackSubmit }) => {
  const result = log.result;

  if ('error' in result) {
    return <div className="p-4 bg-red-900/20 border border-red-500/50 text-red-400 rounded-xl">Eroare analiză: {result.error}</div>;
  }

  const { inventory, computation, recommendations } = result;

  return (
    <div className="space-y-6">
        
        {/* 1. DASHBOARD SCOR & PENALIZĂRI */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Card Scor (Stânga) */}
            <div className="md:col-span-4 glass-panel p-6 rounded-xl flex flex-col justify-center items-center text-center border-t-4 border-t-accent-DEFAULT bg-gradient-to-b from-white/5 to-transparent">
                <h3 className="text-text-secondary text-[10px] uppercase tracking-[0.2em] mb-2">Scor Audit</h3>
                <div className={`text-6xl font-black mono tracking-tighter ${computation.color}`}>{computation.finalScore}</div>
                <div className={`mt-3 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/10 bg-white/5 ${computation.color}`}>
                    {computation.grade}
                </div>
            </div>
            
            {/* Lista Penalizări (Dreapta) */}
            <div className="md:col-span-8 glass-panel p-5 rounded-xl flex flex-col">
                <h3 className="text-text-secondary text-xs uppercase tracking-widest mb-4 flex items-center gap-2 font-bold">
                    <ExclamationTriangleIcon className="w-4 h-4 text-orange-400" /> Raport Penalizări
                </h3>
                <div className="flex-1 overflow-y-auto max-h-40 custom-scrollbar pr-2">
                    {computation.penalties.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-green-400/80">
                            <CheckCircleIcon className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">Nicio penalizare aplicată.</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {computation.penalties.map((p, i) => (
                                <li key={i} className="text-red-300 text-sm flex items-start gap-2 p-2 rounded hover:bg-red-500/5 transition-colors">
                                    <span className="text-red-500 mt-0.5">●</span>
                                    {p}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>

        {/* 2. INVENTAR DETALIAT (Grid 3 coloane) */}
        <div className="glass-panel p-0 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2">
                    <InformationCircleIcon className="w-5 h-5 text-accent-cyan" /> Inventar Digital
                </h3>
                <span className="text-[10px] text-text-secondary uppercase tracking-wider">AI Vision Analysis</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
                {/* COL 1: Logistică & Curățenie */}
                <div className="p-4">
                    <h4 className="text-xs text-accent-DEFAULT font-bold uppercase mb-3 opacity-80">Logistică & Integritate</h4>
                    <BooleanRow label="Cutii/Paleți pe culoar" value={inventory.has_logistics_visible} isBad />
                    <BooleanRow label="Pericol Siguranță" value={inventory.has_safety_hazards} isBad />
                    <InventoryRow label="Zone Murdare" count={inventory.cleanliness_issues_count} riskLevel="high" />
                    <InventoryRow label="Produse Deteriorate" count={inventory.damaged_products_count} riskLevel="high" />
                    <InventoryRow label="Sertare/Uși Deschise" count={inventory.open_drawers_doors_count} />
                </div>

                {/* COL 2: Merchandising */}
                <div className="p-4">
                    <h4 className="text-xs text-accent-DEFAULT font-bold uppercase mb-3 opacity-80">Merchandising & Styling</h4>
                    <InventoryRow label="Goluri Raft (Gaps)" count={inventory.shelf_voids_count} riskLevel="high" />
                    <BooleanRow label="Raft Dezordonat" value={inventory.disorganized_shelf_stock} isBad />
                    <BooleanRow label="Textile Ne-aranjate" value={inventory.poor_textile_styling} isBad />
                    <InventoryRow label="Produse Orfane" count={inventory.orphan_products_count} />
                    <BooleanRow label="Dezordine Casierie" value={inventory.checkout_clutter_detected} isBad />
                </div>

                {/* COL 3: Prețuri & Iluminat */}
                <div className="p-4">
                    <h4 className="text-xs text-accent-DEFAULT font-bold uppercase mb-3 opacity-80">Prețuri & Ambianță</h4>
                    <InventoryRow label="Etichete Lipsă" count={inventory.missing_price_tags_count} riskLevel="high" />
                    <InventoryRow label="Semnalistică Căzută" count={inventory.fallen_signage_count} />
                    <InventoryRow label="Probleme Iluminat" count={inventory.lighting_issues_count} />
                    <BooleanRow label="Personal Absent" value={inventory.staff_absence_visible} isBad />
                </div>
            </div>
        </div>

        {/* 3. RECOMANDĂRI */}
        {recommendations.length > 0 && (
            <div className="p-5 bg-green-500/5 border border-green-500/20 rounded-xl">
                <h3 className="text-green-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <CheckCircleIcon className="w-5 h-5" /> Acțiuni Corective
                </h3>
                <div className="grid grid-cols-1 gap-2">
                    {recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-gray-300 bg-black/20 p-2 rounded border border-white/5">
                            <span className="text-green-500 font-bold">{(i + 1).toString().padStart(2, '0')}</span>
                            {r}
                        </div>
                    ))}
                </div>
            </div>
        )}

        <FeedbackControls auditId={log.id} currentFeedback={feedback} onSubmit={onFeedbackSubmit} />
    </div>
  );
};

export default memo(AuditResultDisplay);