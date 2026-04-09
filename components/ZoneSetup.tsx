import React, { useState } from 'react';
import type { ZoneType } from '../types';
import { CameraIcon, SparklesIcon } from './icons';

interface ZoneSetupProps {
    onStart: (zoneType: ZoneType, zoneName: string) => void;
}

const ZoneSetup: React.FC<ZoneSetupProps> = ({ onStart }) => {
    const [selectedZone, setSelectedZone] = useState<ZoneType>('casierie');
    const [zoneName, setZoneName] = useState('');

    const zones: { type: ZoneType; label: string; description: string; icon: string }[] = [
        {
            type: 'casierie',
            label: 'Casierie',
            description: 'Monitorizează ordinea la casele de marcat: tejghea curată, fără obiecte personale, documente ordonate.',
            icon: '🏪',
        },
        {
            type: 'birou_consilier',
            label: 'Birou Consilier',
            description: 'Monitorizează birourile consilierilor: organizare, curățenie, zona client accesibilă.',
            icon: '🖥️',
        },
    ];

    const handleStart = () => {
        const name = zoneName.trim() || (selectedZone === 'casierie' ? 'Casierie 1' : 'Birou Consilier 1');
        onStart(selectedZone, name);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 py-1.5 px-4 mb-4 rounded-full bg-violet-500/10 border border-violet-500/20">
                    <SparklesIcon className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[11px] font-semibold tracking-wider text-violet-400 uppercase">
                        Computer Vision Live
                    </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                    Ochiul Soacrei
                </h2>
                <p className="text-text-secondary max-w-lg mx-auto">
                    Monitorizare live a ordinii și curățeniei. Selectează zona și pornește camera.
                </p>
            </div>

            <div className="space-y-4 mb-8">
                {zones.map((zone) => (
                    <button
                        key={zone.type}
                        onClick={() => setSelectedZone(zone.type)}
                        className={`w-full text-left p-5 rounded-2xl border transition-all duration-200 ${
                            selectedZone === zone.type
                                ? 'border-violet-500/50 bg-violet-500/10 shadow-lg shadow-violet-500/5'
                                : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                        }`}
                    >
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">{zone.icon}</span>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-lg font-semibold text-white">{zone.label}</h3>
                                    {selectedZone === zone.type && (
                                        <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                                    )}
                                </div>
                                <p className="text-sm text-text-secondary leading-relaxed">{zone.description}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="mb-8">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                    Nume zonă (opțional)
                </label>
                <input
                    type="text"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder={selectedZone === 'casierie' ? 'ex: Casierie 1' : 'ex: Birou Consilier A'}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-text-secondary/50 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
            </div>

            <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-lg transition-all duration-200 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.01] active:scale-[0.99]"
            >
                <CameraIcon className="w-6 h-6" />
                Start Monitorizare
            </button>

            <p className="text-center text-xs text-text-secondary/50 mt-4">
                Camera se va deschide automat. Analiza rulează la fiecare 60 de secunde.
            </p>
        </div>
    );
};

export default ZoneSetup;
