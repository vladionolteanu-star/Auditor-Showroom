import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getVisualAudit } from './services/geminiService';
import type { AuditLog, Feedback } from './types';
import AuditLogItem from './components/AuditLogItem';
import LoadingSpinner from './components/LoadingSpinner';
import AuditCategoryCard from './components/AuditCategoryCard';
import StoreSummaryCard from './components/StoreSummaryCard';
import { ArrowLeftIcon, ChartBarIcon, CubeTransparentIcon, InformationCircleIcon, ViewColumnsIcon } from './components/icons';

const AUDIT_LOGS_KEY = 'visual_audit_logs';
const FEEDBACK_DATA_KEY = 'visual_audit_feedback';

type AuditCategoryName = 'Info Point Birouri' | 'Intrare' | 'Best Seller' | 'Rafturi';

const auditCategories: { name: AuditCategoryName; description: string; icon: React.FC<{className?: string}> }[] = [
    { name: 'Info Point Birouri', description: 'Analiză pentru zonele de consultanță și birouri.', icon: InformationCircleIcon },
    { name: 'Intrare', description: 'Evaluarea primei impresii și a zonelor de acces.', icon: CubeTransparentIcon },
    { name: 'Best Seller', description: 'Verificare specială pentru zonele cu produse de top.', icon: ChartBarIcon },
    { name: 'Rafturi', description: 'Analiză pentru decorațiuni și aranjamente pe rafturi.', icon: ViewColumnsIcon },
];

const App: React.FC = () => {
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'stores' | 'detail' | 'loading'>('stores');
    const [activeStore, setActiveStore] = useState<'Pipera' | 'Baneasa' | null>(null);
    
    // TAB STATE
    const [activeCategory, setActiveCategory] = useState<AuditCategoryName>('Intrare');
    
    const [thoughtProcessForLoading, setThoughtProcessForLoading] = useState<string | null>(null);
    const auditResultRef = useRef<{newLog: AuditLog} | null>(null);
    
    // Ref pentru Auto-Scroll la rezultatul nou
    const latestLogRef = useRef<HTMLDivElement>(null);

    const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
        try { return JSON.parse(localStorage.getItem(AUDIT_LOGS_KEY) || '[]'); } catch { return []; }
    });
    const [feedbackData, setFeedbackData] = useState<Map<string, Feedback>>(() => {
        try { return new Map(JSON.parse(localStorage.getItem(FEEDBACK_DATA_KEY) || '[]')); } catch { return new Map(); }
    });
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    useEffect(() => localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(auditLogs)), [auditLogs]);
    useEffect(() => localStorage.setItem(FEEDBACK_DATA_KEY, JSON.stringify(Array.from(feedbackData.entries()))), [feedbackData]);

    // --- AUTO SCROLL EFFECT (Safe) ---
    useEffect(() => {
        // Dacă suntem în detail view și tocmai a apărut un log nou expandat
        if (view === 'detail' && auditLogs.length > 0 && expandedLogId === auditLogs[0].id) {
            // Mic delay pentru a permite randarea DOM-ului
            setTimeout(() => {
                if (latestLogRef.current) {
                    latestLogRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
        }
    }, [auditLogs, view, expandedLogId]);

    const storeStats = useMemo(() => {
        const initialData = { Pipera: { scores: [] as number[] }, Baneasa: { scores: [] as number[] } };
        const stats = auditLogs.reduce((acc, log) => {
            const match = log.fileName.match(/\[(Pipera|Baneasa)\//);
            if (match && log.result.isValid) {
                acc[match[1] as 'Pipera'|'Baneasa'].scores.push(log.result.score);
            }
            return acc;
        }, initialData);

        const calculateMetrics = (scores: number[]) => ({
            avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
            min: scores.length ? Math.min(...scores) : null,
            max: scores.length ? Math.max(...scores) : null,
            count: scores.length
        });
        return { Pipera: calculateMetrics(stats.Pipera.scores), Baneasa: calculateMetrics(stats.Baneasa.scores) };
    }, [auditLogs]);

    const handleSelectStore = (store: 'Pipera' | 'Baneasa') => { setActiveStore(store); setView('detail'); };
    const handleBackToStores = () => { setActiveStore(null); setView('stores'); };
    const handleFeedbackSubmit = (feedback: Omit<Feedback, 'timestamp'>) => {
        setFeedbackData(prev => new Map(prev).set(feedback.auditId, { ...feedback, timestamp: new Date().toISOString() }));
    };

    const fileToBase64 = (file: File): Promise<{base64: string, mimeType: string}> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: file.type });
            reader.onerror = reject;
        });
    };

    const handleRunAudit = useCallback(async (cat: AuditCategoryName, main: File, url: string, refs: File[]) => {
        if (!activeStore) return;
        setView('loading'); setError(null); setThoughtProcessForLoading(null); setExpandedLogId(null);
        try {
            const mainImg = await fileToBase64(main);
            const refImgs = await Promise.all(refs.map(fileToBase64));
            const response = await getVisualAudit(mainImg.base64, mainImg.mimeType, cat, refImgs);
            
            const newLog: AuditLog = {
                id: `${new Date().toISOString()}-${main.name}`,
                timestamp: new Date().toISOString(),
                fileName: `[${activeStore}/${cat}] ${main.name}`,
                previewUrl: url,
                thoughtProcess: response.thoughtProcess,
                result: response.result,
            };
            // Salvăm rezultatul în Ref pentru a-l procesa după animație
            auditResultRef.current = { newLog };
            setThoughtProcessForLoading(response.thoughtProcess);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setAuditLogs(prev => [{
                id: `${new Date().toISOString()}-${main.name}`,
                timestamp: new Date().toISOString(),
                fileName: `[${activeStore}/${cat}] ${main.name}`,
                thoughtProcess: 'Failed.',
                result: { isValid: false, error: msg },
                previewUrl: url,
            }, ...prev]);
            setError(msg);
            setView('detail');
        }
    }, [activeStore]);

    // --- FIX CRITIC PENTRU CRASH ---
    const handleLoadingComplete = useCallback(() => {
        const result = auditResultRef.current;
        
        // 1. Verificăm dacă avem un rezultat valid ÎNAINTE să accesăm proprietăți
        if (result && result.newLog) {
            const { newLog } = result;

            // 2. Prevenim duplicatele (cheia dublă)
            setAuditLogs(prevLogs => {
                if (prevLogs.some(log => log.id === newLog.id)) {
                    return prevLogs; // Dacă există deja, nu îl mai adăugăm
                }
                return [newLog, ...prevLogs];
            });

            setExpandedLogId(newLog.id);
            
            // 3. Golim ref-ul ca să nu fie procesat din nou
            auditResultRef.current = null;
        }
        
        // Trecem înapoi la view, indiferent dacă a fost succes sau nu
        setView('detail');
    }, []);

    const handleDeleteAudit = (logId: string) => {
        if (window.confirm("Ștergi definitiv acest audit?")) {
            setAuditLogs(prev => prev.filter(l => l.id !== logId));
            setFeedbackData(prev => { const n = new Map(prev); n.delete(logId); return n; });
        }
    };

    const TabButton: React.FC<{cat: typeof auditCategories[0]}> = ({ cat }) => {
        const isActive = activeCategory === cat.name;
        return (
            <button
                onClick={() => setActiveCategory(cat.name)}
                className={`relative px-6 py-3 text-sm font-medium transition-all duration-300 outline-none whitespace-nowrap
                    ${isActive ? 'text-white' : 'text-text-secondary hover:text-text-primary'}
                `}
            >
                <div className="flex items-center gap-2 z-10 relative">
                    <cat.icon className={`w-4 h-4 ${isActive ? 'text-accent-DEFAULT' : 'opacity-70'}`} />
                    {cat.name}
                </div>
                {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-DEFAULT shadow-[0_-2px_10px_rgba(139,92,246,0.5)]"></div>
                )}
            </button>
        );
    };

    return (
        <div className="min-h-screen font-sans text-text-primary relative selection:bg-accent-DEFAULT/30">
            <div className="grain" />
            
            {view === 'loading' && <LoadingSpinner realThoughtProcess={thoughtProcessForLoading} onAnimationComplete={handleLoadingComplete} />}
            
            <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-accent-DEFAULT to-accent-soft rounded-lg flex items-center justify-center shadow-glow">
                            <span className="font-bold text-white">M</span>
                        </div>
                        <h1 className="text-lg font-bold tracking-tight text-white hidden md:block">
                            Mobexpert AI Auditor
                        </h1>
                    </div>
                    {activeStore && (
                         <div className="flex items-center gap-3 bg-bg-card/50 border border-border px-3 py-1.5 rounded-full">
                             <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
                             <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">Locație: <span className="text-white font-bold">{activeStore}</span></span>
                         </div>
                    )}
                </div>
            </header>

            <main className="relative z-10 pb-20 mt-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                    
                    {view === 'stores' && (
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-12">
                                <span className="inline-block py-1 px-3 mb-4 rounded-full bg-accent-DEFAULT/10 border border-accent-DEFAULT/20 text-[10px] font-bold tracking-widest text-accent-DEFAULT uppercase shadow-glow">
                                    Enterprise AI Solution
                                </span>
                                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Selectează Showroom</h2>
                                <p className="text-text-secondary max-w-xl mx-auto">Centralizator de performanță vizuală pentru rețeaua Mobexpert.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                <StoreSummaryCard storeName="Pipera" stats={storeStats.Pipera} onSelectStore={() => handleSelectStore('Pipera')} />
                                <StoreSummaryCard storeName="Baneasa" stats={storeStats.Baneasa} onSelectStore={() => handleSelectStore('Baneasa')} />
                            </div>
                        </section>
                    )}

                    {view === 'detail' && activeStore && (
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-6">
                                <button onClick={handleBackToStores} className="group flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-white transition-colors mb-4">
                                    <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                    Înapoi la Magazine
                                </button>
                                
                                {/* TAB NAVIGATION - SLEEK */}
                                <div className="flex flex-nowrap overflow-x-auto border-b border-white/10 mb-6 scrollbar-hide">
                                    {auditCategories.map(cat => <TabButton key={cat.name} cat={cat} />)}
                                </div>

                                {/* ACTIVE CATEGORY CARD */}
                                <AuditCategoryCard 
                                    key={`${activeStore}-${activeCategory}`}
                                    category={activeCategory}
                                    description={auditCategories.find(c => c.name === activeCategory)?.description || ''}
                                    icon={auditCategories.find(c => c.name === activeCategory)?.icon || CubeTransparentIcon}
                                    onRunAudit={handleRunAudit}
                                />
                            </div>
                        </section>
                    )}
                    
                    <section className="pt-4 animate-in fade-in delay-150 duration-700">
                        {error && (
                            <div className="bg-status-danger/10 border border-status-danger/30 text-status-danger p-4 rounded-xl mb-6">
                                <p className="font-bold">Eroare:</p> {error}
                            </div>
                        )}
                        {auditLogs.length > 0 ? (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2 px-1">
                                    Rezultate Recente <span className="text-xs font-mono text-accent-DEFAULT bg-accent-DEFAULT/10 px-2 py-1 rounded">{auditLogs.length}</span>
                                </h3>
                                <div className="space-y-4">
                                    {auditLogs.map((log, index) => (
                                        // REF-ul pentru Auto-Scroll este pus DOAR pe primul element
                                        <div key={log.id} ref={index === 0 ? latestLogRef : null}>
                                            <AuditLogItem 
                                                log={log} isExpanded={expandedLogId === log.id}
                                                onToggleExpand={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                                onDeleteAudit={() => handleDeleteAudit(log.id)}
                                                feedback={feedbackData.get(log.id)} onFeedbackSubmit={handleFeedbackSubmit}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default App;