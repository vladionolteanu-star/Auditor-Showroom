

import React, { useState, useCallback, useRef } from 'react';
import { PhotoIcon, PlusCircleIcon, FolderOpenIcon, XCircleIcon, CameraIcon } from './icons';

type AuditCategoryName = 'Info Point Birouri' | 'Intrare' | 'Best Seller' | 'Rafturi';

interface AuditCategoryCardProps {
    category: AuditCategoryName;
    description: string;
    icon: React.FC<{ className?: string }>;
    onRunAudit: (category: AuditCategoryName, mainImage: File, mainImageUrl: string, refImages: File[]) => void;
}

const CameraModal: React.FC<{
    onClose: () => void;
    onCapture: (blob: Blob | null) => void;
}> = ({ onClose, onCapture }) => {
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
                    videoRef.current.onloadedmetadata = () => {
                        setIsCameraReady(true);
                    };
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                alert("Nu am putut accesa camera. Asigură-te că ai acordat permisiuni în browser.");
                onClose();
            }
        };

        openCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [onClose]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            canvas.toBlob(blob => {
                onCapture(blob);
                onClose();
            }, 'image/jpeg');
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            {!isCameraReady && (
                <div className="text-white text-lg">Pornire cameră...</div>
            )}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-auto max-w-4xl max-h-[calc(100vh-150px)] rounded-lg shadow-2xl shadow-cyan-500/10 transition-opacity duration-300 ${isCameraReady ? 'opacity-100' : 'opacity-0'}`}
            ></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="mt-6 flex items-center justify-center w-full max-w-4xl">
                <div className="flex-1 text-left">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        Anulează
                    </button>
                </div>
                <div className="flex-1 flex justify-center">
                    <button
                        onClick={handleCapture}
                        disabled={!isCameraReady}
                        className="w-20 h-20 rounded-full bg-white flex items-center justify-center ring-4 ring-offset-4 ring-offset-black ring-white/50 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                        aria-label="Capture photo"
                    >
                        <div className="w-16 h-16 rounded-full bg-white border-4 border-black"></div>
                    </button>
                </div>
                <div className="flex-1"></div>
            </div>
        </div>
    );
};


const AuditCategoryCard: React.FC<AuditCategoryCardProps> = ({ category, description, icon: Icon, onRunAudit }) => {
    const [mainImageFile, setMainImageFile] = useState<File | null>(null);
    const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
    const [refImageFiles, setRefImageFiles] = useState<File[]>([]);
    const [refImageUrls, setRefImageUrls] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCapturingForRef, setIsCapturingForRef] = useState(false);

    const handleMainFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setMainImageFile(file);
            setMainImageUrl(URL.createObjectURL(file));
        }
    };

    const handleRefFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            // Explicitly cast Array.from result to File[] to ensure TypeScript infers the correct type
            const newImageFiles = Array.from(files) as File[];
            const newImageUrls = newImageFiles.map(file => URL.createObjectURL(file));

            if (newImageFiles.length > 0) {
                setRefImageFiles(prev => [...prev, ...newImageFiles]);
                setRefImageUrls(prev => [...prev, ...newImageUrls]);
            }
        }
    };
    
    const handlePhotoCapture = (blob: Blob | null) => {
        if (blob instanceof Blob) {
            const fileName = `capture-${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
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

    const removeRefImage = (indexToRemove: number) => {
        setRefImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        setRefImageUrls(prev => {
            const urlToRemove = prev[indexToRemove];
            URL.revokeObjectURL(urlToRemove);
            return prev.filter((_, index) => index !== indexToRemove);
        });
    };

    const handleAuditClick = () => {
        if (mainImageFile && mainImageUrl) {
            setIsLoading(true);
            onRunAudit(category, mainImageFile, mainImageUrl, refImageFiles);
        }
    };

    const uniqueId = `file-upload-${category}`;
    const uniqueRefId = `ref-file-upload-${category}`;

    return (
        <>
        {isCameraOpen && <CameraModal onClose={() => setIsCameraOpen(false)} onCapture={handlePhotoCapture} />}
        <div className="glass-panel p-4 rounded-xl flex flex-col space-y-4">
            <header className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-cyan-300" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">{category}</h3>
                    <p className="text-sm text-[var(--text-secondary)]">{description}</p>
                </div>
            </header>

            <div className="flex-grow min-h-0">
                {mainImageUrl ? (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden group">
                        <img src={mainImageUrl} alt="Preview audit" className="w-full h-full object-cover" />
                        <label htmlFor={uniqueId} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <span className="text-white font-semibold">Schimbă Imaginea</span>
                        </label>
                        <input id={uniqueId} name={uniqueId} type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleMainFileChange} />
                    </div>
                ) : (
                    <div className="w-full h-48 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-subtle)] rounded-lg hover:bg-white/5 transition-colors p-4">
                        <PhotoIcon className="w-10 h-10 text-[var(--text-secondary)]" />
                        <label htmlFor={uniqueId} className="mt-2 text-sm text-[var(--text-primary)] cursor-pointer">
                            <span className="font-semibold hover:text-cyan-400">Încarcă imaginea</span>
                        </label>
                        <p className="text-xs text-[var(--text-secondary)]">principală pentru audit</p>
                        <input id={uniqueId} type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleMainFileChange} />
                        
                        <div className="relative w-full flex items-center justify-center my-2">
                            <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
                            <span className="flex-shrink mx-2 text-xs text-[var(--text-secondary)]">SAU</span>
                            <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
                        </div>
                        
                        <button onClick={() => { setIsCapturingForRef(false); setIsCameraOpen(true); }} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors">
                            <CameraIcon className="w-5 h-5" />
                            Fă o poză
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                        <FolderOpenIcon className="w-5 h-5" />
                        Imagini Referință ({refImageFiles.length})
                    </h4>
                     <div className="flex items-center gap-2">
                        <label htmlFor={uniqueRefId} className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors">
                            <PlusCircleIcon className="w-5 h-5" /> Adaugă
                        </label>
                        <input id={uniqueRefId} name={uniqueRefId} type="file" multiple className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleRefFilesChange} />
                        <button onClick={() => { setIsCapturingForRef(true); setIsCameraOpen(true); }} className="p-1 rounded-full text-cyan-400 hover:text-cyan-300 hover:bg-white/10 transition-colors" aria-label="Fă o poză de referință">
                            <CameraIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                {refImageUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {refImageUrls.map((url, index) => (
                            <div key={index} className="relative w-12 h-12 rounded-md overflow-hidden group">
                                <img src={url} alt={`Ref ${index+1}`} className="w-full h-full object-cover" />
                                <button onClick={() => removeRefImage(index)} className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <button
                onClick={handleAuditClick}
                disabled={!mainImageFile || isLoading}
                className="w-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-teal)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-2 px-4 rounded-lg transition-all duration-300 neon-accent"
            >
                {isLoading ? 'Se procesează...' : `Rulează Audit ${category}`}
            </button>
        </div>
        </>
    );
};

export default AuditCategoryCard;