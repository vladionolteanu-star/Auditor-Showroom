import React, { useState, useRef } from 'react';
import { VideoCameraIcon } from './icons';

interface VideoRecorderProps {
    className?: string;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({ className = '' }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPreparing, setIsPreparing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = async () => {
        setIsPreparing(true);
        try {
            // Solicită permisiune pentru screen share
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                } as MediaTrackConstraints,
                audio: false // Poți activa dacă vrei audio de sistem
            } as DisplayMediaStreamOptions);

            streamRef.current = stream;

            // Verifică ce codec-uri sunt suportate
            const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? { mimeType: 'video/webm;codecs=vp9' }
                : MediaRecorder.isTypeSupported('video/webm')
                    ? { mimeType: 'video/webm' }
                    : {};

            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);

                // Creează link de download
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `mobexpert-audit-demo-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
                document.body.appendChild(a);
                a.click();

                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

                // Reset chunks pentru următoarea înregistrare
                chunksRef.current = [];
                setIsRecording(false);
            };

            // Detectează când utilizatorul oprește share-ul manual
            stream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(100); // Colectează date la fiecare 100ms
            setIsRecording(true);
            setIsPreparing(false);

        } catch (error: any) {
            console.error('Recording failed:', error);
            setIsPreparing(false);

            if (error.name === 'NotAllowedError') {
                alert('Permisiunea de screen recording a fost refuzată. Te rog acordă acces pentru a înregistra.');
            } else if (error.name === 'NotFoundError') {
                alert('Nu s-a găsit nicio sursă de ecran disponibilă.');
            } else {
                alert('Nu s-a putut porni înregistrarea. Verifică că browser-ul suportă screen recording.');
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        // Oprește toate track-urile stream-ului
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleToggle = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isPreparing}
            className={`
                group relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-300 outline-none
                ${isRecording
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                    : 'bg-white/5 text-text-secondary border border-border hover:bg-white/10 hover:text-white'
                }
                ${isPreparing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                disabled:opacity-50 disabled:cursor-not-allowed
                ${className}
            `}
            title={isRecording ? 'Oprește Înregistrarea' : 'Înregistrează Prezentare'}
        >
            {/* Icon */}
            <div className="relative">
                <VideoCameraIcon className={`w-5 h-5 ${isRecording ? 'text-red-500' : ''}`} />
                {isRecording && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </div>

            {/* Label */}
            <span className="hidden sm:inline">
                {isPreparing ? 'Pornire...' : isRecording ? 'Stop Recording' : 'Record Demo'}
            </span>

            {/* Timer pentru recording (optional) */}
            {isRecording && (
                <span className="hidden md:inline text-xs font-mono bg-red-500/20 px-2 py-0.5 rounded">
                    REC
                </span>
            )}
        </button>
    );
};

export default VideoRecorder;
