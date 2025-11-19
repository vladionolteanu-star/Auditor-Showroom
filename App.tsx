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
    const [thoughtProcessForLoading, setThoughtProcessForLoading] = useState<string | null>(null);
    const auditResultRef = useRef<{newLog: AuditLog} | null>(null);

    const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
        try {
            const savedLogs = localStorage.getItem(AUDIT_LOGS_KEY);
            return savedLogs ? JSON.parse(savedLogs) : [];
        } catch (e) {
            console.error("Failed to load audit logs:", e);
            return [];
        }
    });
    
    const [feedbackData, setFeedbackData] = useState<Map<string, Feedback>>(() => {
        try {
            const savedFeedback = localStorage.getItem(FEEDBACK_DATA_KEY);
            return savedFeedback ? new Map(JSON.parse(savedFeedback)) : new Map();
        } catch (error) {
            console.error("Failed to load feedback from localStorage", error);
            return new Map();
        }
    });

    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    useEffect(() => {
        try {
            // Persist logs including session-only preview URLs. They will break on reload.
            localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(auditLogs));
        } catch (e) {
            console.error("Failed to save audit logs:", e);
        }
    }, [auditLogs]);
    
    useEffect(() => {
        try {
            localStorage.setItem(FEEDBACK_DATA_KEY, JSON.stringify(Array.from(feedbackData.entries())));
        } catch (error) {
            console.error("Failed to save feedback to localStorage", error);
        }
    }, [feedbackData]);

    const storeStats = useMemo(() => {
        const initialData: { [key in 'Pipera' | 'Baneasa']: { scores: number[] } } = {
            Pipera: { scores: [] },
            Baneasa: { scores: [] },
        };

        const stats = auditLogs.reduce((acc, log) => {
            const match = log.fileName.match(/\[(Pipera|Baneasa)\//);
            if (match && log.result.isValid) {
                const store = match[1] as 'Pipera' | 'Baneasa';
                acc[store].scores.push(log.result.score);
            }
            return acc;
        }, initialData);

        const calculateMetrics = (scores: number[]) => {
            if (scores.length === 0) return { avg: null, min: null, max: null, count: 0 };
            const sum = scores.reduce((a, b) => a + b, 0);
            return {
                avg: Math.round(sum / scores.length),
                min: Math.min(...scores),
                max: Math.max(...scores),
                count: scores.length
            };
        };

        return {
            Pipera: calculateMetrics(stats.Pipera.scores),
            Baneasa: calculateMetrics(stats.Baneasa.scores),
        };
    }, [auditLogs]);

    const handleSelectStore = (store: 'Pipera' | 'Baneasa') => {
        setActiveStore(store);
        setView('detail');
    };

    const handleBackToStores = () => {
        setActiveStore(null);
        setView('stores');
    };
    
    const handleFeedbackSubmit = (feedback: Omit<Feedback, 'timestamp'>) => {
        const newFeedback: Feedback = { ...feedback, timestamp: new Date().toISOString() };
        setFeedbackData(prev => new Map(prev).set(feedback.auditId, newFeedback));
    };
    
    const fileToBase64 = (file: File): Promise<{base64: string, mimeType: string}> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = (reader.result as string).split(',')[1];
                resolve({ base64: result, mimeType: file.type });
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleRunAudit = useCallback(async (
        category: AuditCategoryName,
        mainImageFile: File,
        mainImageUrl: string,
        refImageFiles: File[]
    ) => {
        if (!activeStore) {
            setError("Niciun magazin selectat. Vă rugăm să vă întoarceți și să selectați un magazin.");
            return;
        }
        setView('loading');
        setError(null);
        setThoughtProcessForLoading(null);
        setExpandedLogId(null);

        try {
            const mainImage = await fileToBase64(mainImageFile);
            const userReferenceImages = await Promise.all(refImageFiles.map(fileToBase64));
            
            const finalReferenceImages = userReferenceImages;
            
            const response = await getVisualAudit(mainImage.base64, mainImage.mimeType, category, finalReferenceImages);
            
            const newLog: AuditLog = {
                id: `${new Date().toISOString()}-${mainImageFile.name}`,
                timestamp: new Date().toISOString(),
                fileName: `[${activeStore}/${category}] ${mainImageFile.name}`,
                previewUrl: mainImageUrl,
                thoughtProcess: response.thoughtProcess,
                result: response.result,
            };
            
            auditResultRef.current = { newLog };
            setThoughtProcessForLoading(response.thoughtProcess);

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during the audit.';
             const errorLog: AuditLog = {
                id: `${new Date().toISOString()}-${mainImageFile.name}`,
                timestamp: new Date().toISOString(),
                fileName: `[${activeStore}/${category}] ${mainImageFile.name}`,
                thoughtProcess: 'Audit failed before thought process was generated.',
                result: { isValid: false, error: errorMessage },
                previewUrl: mainImageUrl,
            };
            setAuditLogs(prev => [errorLog, ...prev]);
            setExpandedLogId(errorLog.id);
            setError(errorMessage);
            setView('detail');
        }
    }, [activeStore]);
    
    const handleLoadingComplete = () => {
        if (auditResultRef.current) {
            const { newLog } = auditResultRef.current;
            setAuditLogs(prevLogs => [newLog, ...prevLogs]);
            setExpandedLogId(newLog.id);
            auditResultRef.current = null;
        }
        setView('detail');
    };

    const handleDeleteAudit = (logId: string) => {
        if (window.confirm("Sunteți sigur că doriți să ștergeți acest audit? Acțiunea este ireversibilă.")) {
            setAuditLogs(prev => prev.filter(log => log.id !== logId));
            setFeedbackData(prev => {
                const newMap = new Map(prev);
                newMap.delete(logId);
                return newMap;
            });
            if (expandedLogId === logId) setExpandedLogId(null);
        }
    };
    
    const WelcomeScreen: React.FC = () => (
        <div className="text-center p-8 h-full flex flex-col justify-center items-center glass-panel rounded-xl">
            <h2 className="text-3xl font-bold text-white mb-2">Istoric Audituri</h2>
            <p className="text-[var(--text-secondary)] max-w-md">Aici vor apărea rezultatele auditurilor după ce sunt finalizate. Începe prin a selecta o categorie și a încărca o imagine.</p>
        </div>
    );
        
    return (
        <div className="min-h-screen font-sans relative">
            {view === 'loading' && (
                <LoadingSpinner
                    realThoughtProcess={thoughtProcessForLoading}
                    onAnimationComplete={handleLoadingComplete}
                />
            )}
            
            <header className="glass-panel sticky top-0 z-20">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <h1 className="text-2xl font-bold leading-tight text-white">AI Showroom Auditor</h1>
                </div>
            </header>
            <main>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8">
                    
                    {view === 'stores' && (
                        <section>
                            <h2 className="text-3xl font-bold text-center mb-6 text-white">Selectează Magazinul</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <StoreSummaryCard 
                                    storeName="Pipera" 
                                    stats={storeStats.Pipera} 
                                    onSelectStore={() => handleSelectStore('Pipera')}
                                />
                                <StoreSummaryCard 
                                    storeName="Baneasa" 
                                    stats={storeStats.Baneasa} 
                                    onSelectStore={() => handleSelectStore('Baneasa')}
                                />
                            </div>
                        </section>
                    )}

                    {view === 'detail' && activeStore && (
                        <section>
                            <div className="mb-6">
                                <button onClick={handleBackToStores} className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-white transition-colors">
                                    <ArrowLeftIcon className="w-5 h-5" />
                                    Înapoi la Magazine
                                </button>
                                <h2 className="text-3xl font-bold text-center -mt-6 text-white">Audit Mobexpert {activeStore}</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                {auditCategories.map(cat => (
                                    <AuditCategoryCard 
                                        key={`${activeStore}-${cat.name}`}
                                        category={cat.name}
                                        description={cat.description}
                                        icon={cat.icon}
                                        onRunAudit={handleRunAudit}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                    
                    <section className="pt-4">
                        {error && (
                            <div className="glass-panel border-l-4 border-[var(--accent-red)] text-[var(--text-primary)] p-4 rounded-lg mb-4" role="alert">
                                <p className="font-bold">Error</p>
                                <p>{error}</p>
                            </div>
                        )}
                        
                        {auditLogs.length > 0 ? (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-white px-2">Istoric Audituri General</h3>
                                {auditLogs.map(log => (
                                    <AuditLogItem 
                                        key={log.id}
                                        log={log}
                                        isExpanded={expandedLogId === log.id}
                                        onToggleExpand={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                        onDeleteAudit={() => handleDeleteAudit(log.id)}
                                        feedback={feedbackData.get(log.id)}
                                        onFeedbackSubmit={handleFeedbackSubmit}
                                    />
                                ))}
                            </div>
                        ) : <WelcomeScreen />}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default App;