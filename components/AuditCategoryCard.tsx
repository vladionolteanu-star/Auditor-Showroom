import React, { useState, useRef } from 'react';
import { PhotoIcon, PlusCircleIcon, FolderOpenIcon, XCircleIcon, CameraIcon } from './icons';

type AuditCategoryName = 'Info Point Birouri' | 'Intrare' | 'Best Seller' | 'Rafturi';

interface AuditCategoryCardProps {
    category: AuditCategoryName;
    description: string;
    icon: React.FC<{ className?: string }>;
    onRunAudit: (category: AuditCategoryName, mainImage: File, mainImageUrl: string, refImages: File[]) => void;
}

const CameraModal: React.FC<{ onClose: () => void; onCapture: (blob: Blob | null) => void; }> = ({ onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);

    React.useEffect(() => {
        const openCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => setIsCameraReady(true);
                }
            } catch (err) {
                console.error("Camera error:", err);
                onClose();
            }
        };
        openCamera();
        return () => streamRef.current?.getTracks().forEach(track => track.stop());
    }, [onClose]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            canvas.toBlob(blob => { onCapture(blob); onClose(); }, 'image/jpeg');
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-2xl rounded-2xl border border-white/20 shadow-2xl mb-8" />
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="flex gap-6">
                <button onClick={onClose} className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20">Anulează</button>
                <button onClick={handleCapture} disabled={!isCameraReady} className="w-16 h-16 rounded-full bg-white ring-4 ring-white/30 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50">
                    <div className="w-12 h-12 rounded-full border-2 border-black"></div>
                </button>
            </div>
        </div>
    );
};

const AuditCategoryCard: React.FC<AuditCategoryCardProps> = ({ category, description, onRunAudit }) => {
    const [mainImageFile, setMainImageFile] = useState<File | null>(null);
    const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
    const [refImageFiles, setRefImageFiles] = useState<File[]>([]);
    const [refImageUrls, setRefImageUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCapturingForRef, setIsCapturingForRef] = useState(false);

    const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setMainImageFile(file);
            setMainImageUrl(URL.createObjectURL(file));
        }
    };

    const handleRefFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files);
            setRefImageFiles(prev => [...prev, ...newFiles]);
            // FIX: Adaugat 'as Blob' pentru a rezolva eroarea de TypeScript
            setRefImageUrls(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f as Blob))]);
        }
    };
    
    const handlePhotoCapture = (blob: Blob | null) => {
        if (blob) {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const url = URL.createObjectURL(file);
            if (isCapturingForRef) {
                setRefImageFiles(prev => [...prev, file]);
                setRefImageUrls(prev => [...prev, url]);
            } else {
                setMainImageFile(file);
                setMainImageUrl(url);
            }
        }
    };

    const uniqueId = `upload-${category.replace(/\s/g, '')}`;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isCameraOpen && <CameraModal onClose={() => setIsCameraOpen(false)} onCapture={handlePhotoCapture} />}
            
            <div className="glass-panel p-6 rounded-2xl border-t border-white/10">
                <p className="text-sm text-text-secondary mb-6">{description}</p>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* MAIN DROPZONE */}
                    <div className="flex-1">
                        {mainImageUrl ? (
                            <div className="relative w-full aspect-video md:aspect-auto md:h-64 rounded-xl overflow-hidden group border border-border hover:border-accent-DEFAULT transition-all">
                                <img src={mainImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                <label htmlFor={uniqueId} className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                                    <PhotoIcon className="w-8 h-8 text-white mb-2" />
                                    <span className="text-white text-sm font-bold">Schimbă Poza</span>
                                </label>
                                <input id={uniqueId} type="file" className="sr-only" accept="image/*" onChange={handleMainFileChange} />
                            </div>
                        ) : (
                            <div className="w-full aspect-video md:aspect-auto md:h-64 border-2 border-dashed border-border hover:border-accent-DEFAULT/50 hover:bg-accent-DEFAULT/5 rounded-xl flex flex-col items-center justify-center transition-all group">
                                <div className="w-12 h-12 rounded-full bg-bg-elevated flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg">
                                    <PhotoIcon className="w-6 h-6 text-text-secondary group-hover:text-accent-DEFAULT" />
                                </div>
                                <label htmlFor={uniqueId} className="cursor-pointer text-center">
                                    <span className="block text-sm font-bold text-white mb-1">Încarcă Imaginea</span>
                                    <span className="text-xs text-text-tertiary">JPG, PNG (Max 10MB)</span>
                                </label>
                                <input id={uniqueId} type="file" className="sr-only" accept="image/*" onChange={handleMainFileChange} />
                                
                                <div className="flex items-center gap-3 mt-4 w-full max-w-[200px]">
                                    <div className="h-px bg-border flex-1"></div>
                                    <span className="text-[10px] text-text-tertiary uppercase">Sau</span>
                                    <div className="h-px bg-border flex-1"></div>
                                </div>

                                <button onClick={() => { setIsCapturingForRef(false); setIsCameraOpen(true); }} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-elevated border border-border hover:border-white/20 text-sm text-white transition-colors">
                                    <CameraIcon className="w-4 h-4" />
                                    Deschide Camera
                                </button>
                            </div>
                        )}
                    </div>

                    {/* SIDEBAR ACTIONS */}
                    <div className="w-full md:w-72 flex flex-col gap-4">
                        {/* Reference Images */}
                        <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold uppercase text-text-secondary flex items-center gap-2">
                                    <FolderOpenIcon className="w-4 h-4" /> Referințe ({refImageFiles.length})
                                </h4>
                                <div className="flex gap-2">
                                    <label className="cursor-pointer p-1.5 hover:bg-white/10 rounded-md text-accent-cyan transition-colors">
                                        <PlusCircleIcon className="w-5 h-5" />
                                        <input type="file" multiple className="sr-only" accept="image/*" onChange={handleRefFilesChange} />
                                    </label>
                                    <button onClick={() => { setIsCapturingForRef(true); setIsCameraOpen(true); }} className="p-1.5 hover:bg-white/10 rounded-md text-accent-cyan transition-colors">
                                        <CameraIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 min-h-[50px]">
                                {refImageUrls.length === 0 && <p className="text-xs text-text-tertiary italic w-full">Opțional: Adaugă standarde vizuale.</p>}
                                {refImageUrls.map((url, idx) => (
                                    <div key={idx} className="relative w-10 h-10 rounded-lg overflow-hidden group border border-border">
                                        <img src={url} className="w-full h-full object-cover" />
                                        <button onClick={() => {
                                            setRefImageFiles(p => p.filter((_, i) => i !== idx));
                                            setRefImageUrls(p => p.filter((_, i) => i !== idx));
                                        }} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white">
                                            <XCircleIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={() => { if(mainImageFile) { setIsLoading(true); onRunAudit(category, mainImageFile, mainImageUrl!, refImageFiles); } }}
                            disabled={!mainImageFile || isLoading}
                            className="flex-1 bg-accent-DEFAULT hover:bg-accent-soft disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all shadow-glow flex items-center justify-center gap-3"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Analiză în curs...
                                </>
                            ) : (
                                <>🚀 Rulează Audit</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditCategoryCard;