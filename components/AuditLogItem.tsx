// Importuri React și hooks
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
// Importuri tipuri și componente
import { AuditLog, AuditReport, Feedback, BoundingBox } from '../types';
import { TrashIcon, ArrowDownTrayIcon } from './icons';
import AuditResultDisplay from './AuditResultDisplay';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Interfața pentru props-urile componentei
interface AuditLogItemProps {
  log: AuditLog;
  isExpanded: boolean;
  onToggleExpand: () => void;
  feedback?: Feedback;
  onFeedbackSubmit: (feedback: Omit<Feedback, 'timestamp'>) => void;
  onDeleteAudit: (logId: string) => void;
}

// Funcție pentru a scala vizual impactul unei deviații (grosime linie, opacitate)
const impactScale = (finalImpact: number) => {
  const clampedImpact = Math.max(1, Math.min(50, finalImpact));
  const normalized = (clampedImpact - 1) / 49;
  const eased = Math.pow(normalized, 1.5); // Easing pentru un efect vizual mai plăcut
  return {
    strokeWidth: 1.5 + eased * 2.5,
    opacity: 0.7 + eased * 0.3,
  };
};

// Convertește coordonatele normalizate (0-1) ale unui bounding box în pixeli
const boundingBoxToPixels = (
  box: BoundingBox,
  displayWidth: number,
  displayHeight: number
): { x: number; y: number; width: number; height: number } => {
  // FIX: Precizie maximă, fără rotunjiri inutile
  return {
    x: box.x * displayWidth,
    y: box.y * displayHeight,
    width: box.width * displayWidth,
    height: box.height * displayHeight
  };
};

// NOU: Funcție pentru a genera o cale SVG pentru un cerc cu aspect organic
const generateOrganicCirclePath = (cx: number, cy: number, r: number, seed: number): string => {
  const points = 8; // Numărul de puncte de control pentru cerc
  const angleStep = (Math.PI * 2) / points;
  const pathParts: string[] = [];

  // Funcție de "jitter" pentru a adăuga imperfecțiuni
  const jitter = (val: number, jitterSeed: number, amplitude: number) => {
    const noise = Math.sin(jitterSeed * 12.9898 + seed * 4.1414) * 43758.5453;
    return val + (noise - Math.floor(noise) - 0.5) * amplitude;
  };

  let firstPoint = { x: 0, y: 0 };
  for (let i = 0; i <= points; i++) {
    const angle = angleStep * i;
    const radius = jitter(r, i, r * 0.15); // Variație de 15% a razei
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    if (i === 0) {
      firstPoint = { x, y };
      pathParts.push(`M ${x},${y}`);
    } else {
      const prevAngle = angleStep * (i - 1);
      const prevRadius = jitter(r, i - 1, r * 0.15);
      const prevX = cx + Math.cos(prevAngle) * prevRadius;
      const prevY = cy + Math.sin(prevAngle) * prevRadius;

      const cp1Angle = prevAngle + angleStep * 0.33;
      const cp1Radius = jitter(r, i * 10, r * 0.2);
      const cp1x = cx + Math.cos(cp1Angle) * cp1Radius;
      const cp1y = cy + Math.sin(cp1Angle) * cp1Radius;

      const cp2Angle = angle + angleStep * -0.33;
      const cp2Radius = jitter(r, i * 20, r * 0.2);
      const cp2x = cx + Math.cos(cp2Angle) * cp2Radius;
      const cp2y = cy + Math.sin(cp2Angle) * cp2Radius;

      if (i === points) {
        pathParts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${firstPoint.x},${firstPoint.y}`);
      } else {
        pathParts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`);
      }
    }
  }
  pathParts.push('Z'); // Închide calea
  return pathParts.join(' ');
};

// Funcție care desenează un cerc de mână (înlocuiește stilul zimțat)
const generateHandDrawnCirclePath = (
  pixelBox: { x: number; y: number; width: number; height: number; },
  seed: number = 0
): string => {
  const { x, y, width, height } = pixelBox;
  const cx = x + width / 2;
  const cy = y + height / 2;
  // Facem raza puțin mai mare decât chenarul pentru a-l înconjura
  const rx = width / 2 + 10;
  const ry = height / 2 + 10;

  const points = 12; // Mai multe puncte pentru o cale mai circulară și fină
  const angleStep = (Math.PI * 2) / points;
  const pathParts: string[] = [];

  // Funcție de "jitter" consistentă
  const jitter = (jitterSeed: number, amplitude: number) => {
    const noise = Math.sin(jitterSeed * 13.337 + seed * 7.7713) * 43758.5453;
    return (noise - Math.floor(noise) - 0.5) * amplitude;
  };

  const controlPoints = [];
  // Generăm puncte pentru cercul nostru neregulat
  for (let i = 0; i < points; i++) {
    const angle = angleStep * i;
    // Adăugăm imperfecțiuni atât la unghi, cât și la rază
    const jitteredAngle = angle + jitter(i, 0.2);
    const jitteredRx = rx + jitter(i * 2, rx * 0.25);
    const jitteredRy = ry + jitter(i * 2 + 1, ry * 0.25);

    const px = cx + Math.cos(jitteredAngle) * jitteredRx;
    const py = cy + Math.sin(jitteredAngle) * jitteredRy;
    controlPoints.push({ x: px, y: py });
  }

  // Începem calea la primul punct
  pathParts.push(`M ${controlPoints[0].x.toFixed(2)},${controlPoints[0].y.toFixed(2)}`);

  // Creăm curbe line între puncte pentru a evita colțurile
  for (let i = 0; i < points; i++) {
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % points];

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Punct de control pentru curba Bezier, pentru un aspect natural
    const cpX = midX + jitter(i + 10, (p2.x - p1.x) * 0.2);
    const cpY = midY + jitter(i + 11, (p2.y - p1.y) * 0.2);

    pathParts.push(`Q ${cpX.toFixed(2)},${cpY.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`);
  }

  pathParts.push('Z'); // Închidem calea
  return pathParts.join(' ');
};

// Componenta principală
const AuditLogItem: React.FC<AuditLogItemProps> = ({
  log,
  isExpanded,
  onToggleExpand,
  onDeleteAudit,
  feedback,
  onFeedbackSubmit
}) => {
  const originalReport = log.result.isValid ? (log.result as AuditReport) : null;
  const contentRef = useRef<HTMLDivElement>(null); // Ref pentru zona de printat

  // Stare simplificată, FĂRĂ offsetX/offsetY
  const [imageState, setImageState] = useState({
    isLoaded: false,
    displayWidth: 0,
    displayHeight: 0,
  });

  const imageRef = useRef<HTMLImageElement>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setDebugMode(prev => !prev);
      }
    };
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, []);

  const modifiedLog: AuditLog = useMemo(() => {
    if (!originalReport) return log;

    const deviationsWithBox = (originalReport.raw_deviations || [])
      .filter(d => d.boundingBox && d.boundingBox.width > 0 && d.boundingBox.height > 0)
      .sort((a, b) => {
        const yDiff = (a.boundingBox!.y - b.boundingBox!.y);
        if (Math.abs(yDiff) > 0.05) return yDiff;
        return a.boundingBox!.x - b.boundingBox!.x;
      });

    const deviationsWithoutBox = (originalReport.raw_deviations || [])
      .filter(d => !d.boundingBox || d.boundingBox.width <= 0 || d.boundingBox.height <= 0);

    return {
      ...log,
      result: {
        ...originalReport,
        raw_deviations: [...deviationsWithBox, ...deviationsWithoutBox],
      }
    };
  }, [log, originalReport]);

  const report = modifiedLog.result.isValid ? (modifiedLog.result as AuditReport) : null;

  // Funcție de calcul simplificată; măsoară doar dimensiunile redate
  const calculateImageDimensions = useCallback(() => {
    const img = imageRef.current;
    if (!img || !img.complete || !img.naturalWidth) return;

    const { offsetWidth, offsetHeight } = img;

    const newState = {
      isLoaded: true,
      displayWidth: offsetWidth,
      displayHeight: offsetHeight,
    };

    if (
      imageState.displayWidth !== newState.displayWidth ||
      imageState.displayHeight !== newState.displayHeight
    ) {
      setImageState(newState);
    }
  }, [imageState.displayWidth, imageState.displayHeight]);

  // FIX: UseEffect optimizat pentru ResizeObserver
  useEffect(() => {
    if (!isExpanded) {
      setImageState({ isLoaded: false, displayWidth: 0, displayHeight: 0 });
      return;
    }

    const img = imageRef.current;
    if (!img) return;

    const handleLoad = () => {
      // Folosim setTimeout pentru a aștepta render complet
      setTimeout(() => {
        calculateImageDimensions();
      }, 10);
    };

    img.addEventListener('load', handleLoad);
    if (img.complete) handleLoad();

    // Debounce pentru resize observer
    let resizeTimeout: NodeJS.Timeout;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateImageDimensions, 50);
    });
    resizeObserver.observe(img);

    return () => {
      img.removeEventListener('load', handleLoad);
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, [isExpanded, log.previewUrl, calculateImageDimensions]);

  // Funcție pentru a calcula punctele scăzute pentru fiecare deviație
  const calculateDeviationPenalty = (dev: any): number => {
    const desc = dev.description?.toLowerCase() || '';

    // Curățenie = -25p automat (CRITIC)
    if (desc.includes('pete') || desc.includes('murdărie') || desc.includes('apă') ||
      desc.includes('gunoi') || desc.includes('praf')) {
      return -25;
    }

    // Logistică
    if (desc.includes('cutie') || desc.includes('palet') || desc.includes('cărucioa')) {
      return -16;
    }

    // Pericole
    if (desc.includes('cablu') || desc.includes('lichid') || desc.includes('sticlă')) {
      return -20;
    }

    // Produse deteriorate
    if (desc.includes('deteriorat') || desc.includes('zgâriat') || desc.includes('rupt')) {
      return -12;
    }

    // Goluri raft
    if (desc.includes('gol') || desc.includes('gap') || desc.includes('lipsă')) {
      return -10;
    }

    // Clutter
    if (desc.includes('clutter') || desc.includes('dezordine')) {
      return -12;
    }

    // Etichete
    if (desc.includes('etichet')) {
      return -6;
    }

    // Produse căzute
    if (desc.includes('căzut') || desc.includes('răsturnat')) {
      return -6;
    }

    // Afișe
    if (desc.includes('afiș') || desc.includes('semnal')) {
      return -5;
    }

    // Uși/sertare
    if (desc.includes('ușă') || desc.includes('sertar')) {
      return -4;
    }

    // Default bazat pe severity
    if (dev.severity === 'CRITICĂ') return -20;
    if (dev.severity === 'Mare') return -12;
    if (dev.severity === 'Medie') return -8;
    return -4; // Mică
  };

  const deviationAnnotations = useMemo(() => {
    if (!report?.raw_deviations || !imageState.isLoaded || imageState.displayWidth === 0) {
      return [];
    }

    return report.raw_deviations
      .filter(dev => dev.boundingBox && dev.boundingBox.width > 0)
      .map((dev, index) => {
        // Determinăm severity pentru culoare și grosime
        const isCritical = dev.severity === 'CRITICĂ' || dev.severity === 'Mare';
        const strokeWidth = isCritical ? 4 : 3;
        const opacity = isCritical ? 0.9 : 0.7;

        // Calculăm punctele scăzute
        const penaltyPoints = calculateDeviationPenalty(dev);

        const pixelBox = boundingBoxToPixels(dev.boundingBox!, imageState.displayWidth, imageState.displayHeight);

        const labelR = 20; // Mărit de la 13 la 20 pentru vizibilitate
        const labelPos = {
          x: pixelBox.x + pixelBox.width + labelR * 0.4,
          y: pixelBox.y - labelR * 0.4
        };
        const labelCirclePath = generateOrganicCirclePath(labelPos.x, labelPos.y, labelR, index);
        const labelRotation = (Math.sin(index * 2.5) * 43758.5) % 15 - 7.5;

        return {
          ...dev,
          originalIndex: index,
          penaltyPoints, // Adăugăm punctele
          path: generateHandDrawnCirclePath(pixelBox, index),
          pixelBox,
          labelPos,
          labelCirclePath,
          labelRotation,
          strokeWidth,
          opacity,
        };
      });
  }, [report?.raw_deviations, imageState]);

  const score = report?.computation?.finalScore?.toString() ?? 'ERR';
  const grade = report?.computation?.grade ?? 'Eroare';

  const getGradeColor = () => {
    if (!report) return 'bg-[var(--accent-red)]';
    switch (grade) {
      case 'Very Good': return 'bg-[var(--accent-cyan)]';
      case 'Good': return 'bg-[var(--accent-green)]';
      case 'Needs Improvement': return 'bg-[var(--accent-yellow)]';
      default: return 'bg-[var(--accent-red)]';
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteAudit(log.id);
  };

  const handleExportPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contentRef.current) return;
    setIsGeneratingPDF(true);

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2, // Calitate mai bună
        useCORS: true, // Permite imagini cross-origin (dacă e cazul)
        backgroundColor: '#050a15', // Background întunecat
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10; // Margine sus

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Audit_Showroom_${log.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error("Eroare la generarea PDF:", error);
      alert("Nu s-a putut genera PDF-ul. Verificați consola.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div
        className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors relative cursor-pointer"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-4 overflow-hidden flex-1">
          <img
            src={log.previewUrl}
            alt="thumbnail"
            className="w-16 h-12 object-cover rounded-lg bg-black/30 flex-shrink-0"
          />
          <div className="flex-1 overflow-hidden">
            <p className="font-semibold text-white truncate">{log.fileName}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {new Date(log.timestamp).toLocaleString('ro-RO')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className={`px-3 py-1 text-sm font-bold rounded-full whitespace-nowrap text-black ${getGradeColor()}`}>
            {grade}
          </span>
          <div className="text-center w-16">
            <p className="text-xs text-[var(--text-secondary)]">Scor</p>
            <p className={`text-2xl font-bold mono ${!report ? 'text-[var(--accent-red)]' : 'text-white'}`}>{score}</p>
          </div>

          {isExpanded && (
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-cyan-500/20 hover:text-[var(--accent-cyan)] transition-colors"
              aria-label="Exportă PDF"
              title="Exportă PDF"
            >
              <ArrowDownTrayIcon className={`w-5 h-5 ${isGeneratingPDF ? 'animate-pulse' : ''}`} />
            </button>
          )}

          <button
            onClick={handleDelete}
            className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-red-500/20 hover:text-[var(--accent-red)] transition-colors"
            aria-label="Șterge audit"
            title="Șterge audit"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div ref={contentRef} className="p-1 sm:p-2 md:p-4 border-t border-[var(--border-subtle)] bg-black/20">
          <div className="flex flex-col gap-4">

            {debugMode && imageState.isLoaded && (
              <div className="bg-black/80 text-green-400 p-2 rounded text-xs mono">
                <div>Image: {imageState.displayWidth.toFixed(1)} x {imageState.displayHeight.toFixed(1)}px</div>
                <div>Annotations: {deviationAnnotations.length}</div>
                <div className="mt-1 text-yellow-400">Apasă D pentru a comuta modul debug</div>
              </div>
            )}

            {/* FIX PRINCIPAL: Container optimizat pentru aliniere perfectă */}
            <div className="w-full rounded-xl overflow-hidden bg-black/90 border border-white/10 flex justify-center items-center">
              <div
                className="relative inline-block"
                style={{
                  lineHeight: 0,
                  fontSize: 0,
                  position: 'relative'
                }}
              >
                <img
                  ref={imageRef}
                  src={log.previewUrl}
                  alt={`Audit for ${log.fileName}`}
                  className="block max-w-full max-h-full"
                  style={{
                    display: 'block',
                    margin: 0,
                    padding: 0,
                    border: 0,
                    verticalAlign: 'top',
                    maxWidth: '100%',
                    height: 'auto'
                  }}
                  onLoad={() => {
                    // Forțăm recalcularea după încărcare completă
                    requestAnimationFrame(() => {
                      calculateImageDimensions();
                    });
                  }}
                />

                {imageState.isLoaded && imageState.displayWidth > 0 && deviationAnnotations.length > 0 && (
                  <svg
                    className="absolute pointer-events-none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${imageState.displayWidth}px`,
                      height: `${imageState.displayHeight}px`
                    }}
                    viewBox={`0 0 ${imageState.displayWidth} ${imageState.displayHeight}`}
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <filter id="fountainPenEffect">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="turbulence" />
                        <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="0.8" />
                        <feGaussianBlur stdDeviation="0.2" />
                      </filter>
                      <filter id="inkBleedEffect">
                        <feMorphology operator="dilate" radius="0.5" in="SourceAlpha" result="dilate" />
                        <feGaussianBlur in="dilate" stdDeviation="1" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="labelShadow">
                        <feDropShadow dx="0.5" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.4" />
                      </filter>
                    </defs>

                    {debugMode && deviationAnnotations.map((dev) => (
                      <rect
                        key={`debug-${dev.originalIndex}`}
                        x={dev.pixelBox.x} y={dev.pixelBox.y}
                        width={dev.pixelBox.width} height={dev.pixelBox.height}
                        fill="rgba(0,255,0,0.1)" stroke="lime" strokeWidth="1" strokeDasharray="3,3"
                      />
                    ))}

                    {deviationAnnotations.map((dev) => (
                      <g key={`annotation-${dev.originalIndex}`} opacity={dev.opacity} filter="url(#inkBleedEffect)">
                        <path
                          d={dev.path}
                          fill="rgba(220, 38, 38, 0.1)"
                          stroke="none"
                        />
                        <path
                          d={dev.path}
                          fill="none"
                          stroke="#DC2626"
                          strokeWidth={dev.strokeWidth}
                          strokeLinecap="round" strokeLinejoin="round"
                          filter="url(#fountainPenEffect)"
                        />
                        <g
                          transform={`translate(0,0) rotate(${dev.labelRotation} ${dev.labelPos.x} ${dev.labelPos.y})`}
                        >
                          <g filter="url(#labelShadow)">
                            <path
                              d={dev.labelCirclePath}
                              fill="#DC2626"
                              stroke="white"
                              strokeWidth="2"
                            />
                          </g>
                          <text
                            textAnchor="middle" dominantBaseline="central"
                            fill="white" fontSize="18" fontWeight="bold"
                            style={{ fontFamily: "'Caveat', cursive, system-ui", userSelect: 'none' }}
                            x={dev.labelPos.x} y={dev.labelPos.y - 4}
                          >
                            {dev.originalIndex + 1}
                          </text>
                          <text
                            textAnchor="middle" dominantBaseline="hanging"
                            fill="white" fontSize="12" fontWeight="bold"
                            style={{ fontFamily: "'Caveat', cursive, system-ui", userSelect: 'none' }}
                            x={dev.labelPos.x} y={dev.labelPos.y + 6}
                          >
                            {dev.penaltyPoints}p
                          </text>
                        </g>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <div className="flex flex-col h-full">
                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 flex-shrink-0 uppercase tracking-wider">
                  Proces de Gândire AI
                </h4>
                <div className="flex-grow glass-panel p-3 text-xs text-cyan-300/90 whitespace-pre-wrap overflow-y-auto pr-2 mono rounded-xl min-h-[200px] max-h-[50vh] custom-scrollbar">
                  {log.thoughtProcess || 'Procesul de gândire nu a fost înregistrat.'}
                </div>
              </div>

              <div className="h-full max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                <AuditResultDisplay
                  log={modifiedLog}
                  feedback={feedback}
                  onFeedbackSubmit={onFeedbackSubmit}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogItem;
