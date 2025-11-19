import React, { useEffect, useRef, useState } from "react";
import { PROJECT_FILES as initialProjectFiles } from '../config/loading-code-reels';

interface LoadingSpinnerProps {
  realThoughtProcess: string | null;
  onAnimationComplete: () => void;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ realThoughtProcess, onAnimationComplete }) => {
  // Starea fișierelor (codul sursă)
  const [projectFiles, setProjectFiles] = useState([...(initialProjectFiles || [])]);

  // UI State
  const [activeFile, setActiveFile] = useState(0);
  const [highlightedLine, setHighlightedLine] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [openTabs, setOpenTabs] = useState<number[]>([0]); // Începem cu primul tab
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState("AI initializing audit protocols...");
  
  // Refs pentru controlul animației
  const timersRef = useRef<number[]>([]);
  const animationStateRef = useRef<"scanning" | "revealing" | "done">("scanning");
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup la unmount
  useEffect(() => {
    return () => timersRef.current.forEach(timerId => clearTimeout(timerId as any));
  }, []);

  // ============================================================
  // 1. ANIMAȚIA DE SCANARE (Secvențială - Trece prin fișiere)
  // ============================================================
  useEffect(() => {
    // Dacă deja avem răspunsul sau nu suntem în mod scanare, ieșim
    if (realThoughtProcess || animationStateRef.current !== "scanning") return;

    let currentFileIdx = activeFile;
    let currentLineIdx = 0;

    const scanNextLine = () => {
      if (animationStateRef.current !== "scanning") return;

      const file = projectFiles[currentFileIdx];
      // Safety check
      if (!file) {
        // Dacă ceva e greșit, resetăm la 0
        currentFileIdx = 0;
        return;
      }

      const lines = file.content.split('\n');

      // Dacă mai avem linii în fișierul curent
      if (currentLineIdx < lines.length) {
        setHighlightedLine(currentLineIdx);
        
        // Calcul poziție cursor (24px înălțime linie)
        const newCursorPos = currentLineIdx * 24;
        setCursorPosition(newCursorPos);

        // Auto-scroll lin
        if (codeContainerRef.current) {
            const containerHeight = codeContainerRef.current.clientHeight;
            // Ținem cursorul undeva la mijlocul ecranului
            const scrollTarget = newCursorPos - (containerHeight / 2) + 50;
            codeContainerRef.current.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        }

        const lineContent = lines[currentLineIdx];

        // Mesaje de status în funcție de ce citește
        if (lineContent.includes('AUDIT_CONFIG') || lineContent.includes('rules')) setStatusMessage("Reading configuration matrix...");
        else if (lineContent.includes('interface') || lineContent.includes('type')) setStatusMessage("Validating data schemas...");
        else if (lineContent.includes('export') || lineContent.includes('return')) setStatusMessage("Analyzing export modules...");

        currentLineIdx++;

        // VITEZA DE CITIRE (Mai lentă, să pară că "citește")
        let delay = 80; 
        if (lineContent.trim().length > 60) delay = 150; // Linii lungi
        if (lineContent.trim().length === 0) delay = 40;  // Linii goale

        const timer = setTimeout(scanNextLine, delay);
        timersRef.current.push(timer as any);
      } 
      else {
        // S-a terminat fișierul curent. Trecem la următorul.
        const nextFileIdx = (currentFileIdx + 1) % projectFiles.length; // Loop doar dacă termină tot
        
        currentFileIdx = nextFileIdx;
        currentLineIdx = 0;

        // Schimbăm Tab-ul vizual
        setActiveFile(nextFileIdx);
        
        // Gestionăm tab-urile deschise (să nu se aglomereze, păstrăm doar 3)
        setOpenTabs(prev => {
            if (prev.includes(nextFileIdx)) return prev;
            const newTabs = [...prev, nextFileIdx];
            if (newTabs.length > 3) return newTabs.slice(1); // Scoatem primul dacă sunt prea multe
            return newTabs;
        });

        setStatusMessage(`Opening ${projectFiles[nextFileIdx].path}...`);

        // Pauză mică între fișiere
        const timer = setTimeout(scanNextLine, 1200);
        timersRef.current.push(timer as any);
      }
    };

    // Start scan
    const startTimer = setTimeout(scanNextLine, 500);
    timersRef.current.push(startTimer as any);

  }, []); // Rulează o singură dată la montare (logica internă se ocupă de buclă)


  // ============================================================
  // 2. PREGĂTIRE THOUGHT PROCESS (Când vine răspunsul de la AI)
  // ============================================================
  useEffect(() => {
    if (!realThoughtProcess) return;

    // 1. OPRIM ORICE SCANARE IMEDIAT
    animationStateRef.current = "revealing";
    timersRef.current.forEach(timerId => clearTimeout(timerId as any));
    timersRef.current = [];

    setStatusMessage("GENERATING REASONING LOG...");

    // 2. Creăm un fișier virtual nou pentru gândire
    const thoughtFile = {
      path: "AI_REASONING_LOG.md", // Nume fișier
      language: "markdown",
      content: realThoughtProcess
    };

    // 3. Îl adăugăm în listă și îl activăm
    setProjectFiles(prev => {
      const newFiles = [...prev, thoughtFile];
      const thoughtIndex = newFiles.length - 1;
      
      // Resetăm UI-ul pentru noul fișier
      setActiveFile(thoughtIndex);
      setOpenTabs(prev => [...prev, thoughtIndex]); // Adăugăm tab-ul nou la sfârșit
      setHighlightedLine(-1);
      setCursorPosition(0);
      
      return newFiles;
    });

  }, [realThoughtProcess]);


  // ============================================================
  // 3. ANIMAȚIA DE SCRIERE (Typewriter Effect pentru Thought Process)
  // ============================================================
  useEffect(() => {
    // Pornim doar dacă suntem în modul revealing și avem fișierul de gândire activ
    if (animationStateRef.current === "revealing" && activeFile === projectFiles.length - 1) {
        
        const file = projectFiles[activeFile];
        const lines = file.content.split('\n');
        let lineIdx = 0;

        // Resetăm scroll-ul sus la început
        if (codeContainerRef.current) {
            codeContainerRef.current.scrollTop = 0;
        }

        const typeWriterLoop = () => {
            if (lineIdx >= lines.length) {
                // FINALIZARE
                setStatusMessage("AUDIT COMPLETE. RENDERING REPORT...");
                
                // Aici e "oleaca" de pauză. Așteptăm 2.5 secunde să vadă omul ce s-a scris
                setTimeout(() => {
                    setIsFadingOut(true);
                    setTimeout(onAnimationComplete, 1000); // Timp pentru fade-out
                }, 2500); 
                return;
            }

            // Highlight linia curentă
            setHighlightedLine(lineIdx);
            const newCursorPos = lineIdx * 24;
            setCursorPosition(newCursorPos);

            // Scroll logic - urmărește cursorul
            if (codeContainerRef.current) {
                 const containerHeight = codeContainerRef.current.clientHeight;
                 // Păstrăm cursorul mai jos ca să se vadă contextul de sus (ce a scris deja)
                 if (newCursorPos > containerHeight / 2) {
                    codeContainerRef.current.scrollTop = newCursorPos - (containerHeight / 2);
                 }
            }

            lineIdx++;

            // Viteză de scriere variabilă (naturală)
            // Mai rapidă decât citirea, că e output generat
            let typeDelay = 30; 
            if (lines[lineIdx - 1].length > 80) typeDelay = 50;

            const timer = setTimeout(typeWriterLoop, typeDelay);
            timersRef.current.push(timer as any);
        };

        // Pornim scrierea după o mică pauză
        const startDelay = setTimeout(typeWriterLoop, 600);
        timersRef.current.push(startDelay as any);
    }
  }, [activeFile, projectFiles]); // Se declanșează când activeFile devine fișierul de gândire


  // ============================================================
  // HELPERE VIZUALE
  // ============================================================
  const currentFile = projectFiles[activeFile] || { path: '', content: '', language: '' };
  
  // Afișăm doar liniile care au fost "scrise" deja în modul revealing
  // Sau toate liniile în modul scanning
  const visibleLines = animationStateRef.current === 'revealing' 
     ? currentFile.content.split('\n').slice(0, highlightedLine + 1)
     : currentFile.content.split('\n');

  const highlightToken = (line: string) => {
    // Syntax Highlighting Minimalist Turcoaz
    let html = line
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\/\/.*/g, '<span class="text-emerald-500/80 italic">$&</span>') // Comentarii
      .replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, '<span class="text-orange-300">$&</span>') // Stringuri
      .replace(/\b(export|import|const|let|var|function|return|interface|type|async|await)\b/g, '<span class="text-[#38e8ff] font-semibold">$&</span>') // Keywords
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-pink-400">$&</span>'); // Booleans

    // Markdown specific styling
    if (currentFile.language === 'markdown') {
        if (line.startsWith('###')) html = `<span class="text-[#38e8ff] font-bold uppercase tracking-widest border-b border-[#38e8ff]/20 pb-1 inline-block w-full mt-2">${line}</span>`;
        else if (line.startsWith('#')) html = `<span class="text-white font-bold text-lg border-b border-white/20 pb-1 inline-block w-full mb-2">${line}</span>`;
        else if (line.trim().startsWith('-')) html = `<span class="text-gray-300 pl-2">● ${line.substring(1)}</span>`;
        else if (line.includes(':')) html = line.replace(/(.*?):/, '<span class="text-[#38e8ff] font-semibold">$1:</span>');
    }

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#050a15]/95 backdrop-blur-md transition-opacity duration-1000 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Container Principal */}
      <div className="w-full h-full sm:w-[95vw] sm:h-[90vh] bg-[#0c1324] rounded-lg shadow-[0_0_80px_rgba(56,232,255,0.1)] border border-[#38e8ff]/20 flex flex-col overflow-hidden font-mono text-sm relative">
        
        {/* Ambient Glow Top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#38e8ff] to-transparent opacity-60 blur-[2px]"></div>

        {/* Tabs Bar */}
        <div className="flex bg-[#050a15] border-b border-[#38e8ff]/10 overflow-x-auto custom-scrollbar scrollbar-none">
           {openTabs.map(tabIdx => {
              const isActive = activeFile === tabIdx;
              const file = projectFiles[tabIdx];
              if (!file) return null;
              return (
                <div 
                    key={tabIdx}
                    className={`
                        px-4 py-2.5 flex items-center gap-2 cursor-default transition-all border-r border-[#38e8ff]/5 min-w-[120px]
                        ${isActive ? 'bg-[#0c1324] text-[#38e8ff] border-t-2 border-t-[#38e8ff]' : 'text-gray-500 bg-[#050a15] hover:bg-[#0c1324]/50'}
                    `}
                >
                    {/* Iconiță fișier */}
                    <span className={`w-2 h-2 rounded-sm ${file.language === 'markdown' ? 'bg-purple-500 shadow-[0_0_5px_purple]' : 'bg-blue-500'}`}></span>
                    <span className="truncate font-medium">{file.path.split('/').pop()}</span>
                </div>
              )
           })}
        </div>

        {/* Breadcrumbs & Info */}
        <div className="px-4 py-1.5 bg-[#0c1324] text-gray-500 text-[11px] border-b border-[#38e8ff]/5 flex justify-between items-center select-none">
             <div className="flex items-center gap-2">
                <span>mobexpert-audit</span>
                <span>/</span>
                <span className="text-gray-300">{currentFile.path}</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[#38e8ff]/70 tracking-wider">GEMINI 1.5 PRO</span>
             </div>
        </div>

        {/* Editor Area */}
        <div ref={codeContainerRef} className="flex-1 overflow-y-auto custom-scrollbar relative scroll-smooth bg-[#0c1324] pb-10">
             <div className="flex min-h-full py-4">
                {/* Line Numbers */}
                <div className="w-12 flex-shrink-0 flex flex-col items-end pr-4 text-gray-700 select-none border-r border-[#38e8ff]/5 bg-[#0c1324]">
                    {visibleLines.map((_, i) => (
                        <div key={i} className={`h-6 leading-6 text-[11px] ${highlightedLine === i ? 'text-[#38e8ff] font-bold' : ''}`}>{i + 1}</div>
                    ))}
                </div>

                {/* Code Content */}
                <div className="flex-1 pl-4 relative">
                    {/* Cursor Line Highlight */}
                    <div 
                        className="absolute left-0 right-0 h-6 bg-[#38e8ff]/5 border-l-2 border-[#38e8ff] transition-all duration-100 pointer-events-none"
                        style={{ top: `${cursorPosition}px` }}
                    />

                    {visibleLines.map((line, i) => (
                        <div 
                            key={i} 
                            className={`
                                h-6 leading-6 whitespace-pre transition-all duration-200
                                ${i === highlightedLine ? 'text-gray-100' : 'text-gray-400'}
                            `}
                        >
                            {highlightToken(line)}
                        </div>
                    ))}
                    
                    {/* Blinking Block Cursor */}
                    <div 
                        className="absolute w-2 h-5 bg-[#38e8ff] opacity-50 animate-pulse transition-all duration-75 z-10 shadow-[0_0_10px_#38e8ff]"
                        style={{ top: `${cursorPosition + 2}px`, left: '16px' }} // Poziționat generic la începutul liniei
                    ></div>
                </div>
             </div>
        </div>

        {/* Status Bar */}
        <div className="h-8 bg-[#050a15] border-t border-[#38e8ff]/20 flex items-center justify-between px-4 text-xs text-[#38e8ff] select-none z-20">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-[#38e8ff]/10 px-3 py-0.5 rounded-full border border-[#38e8ff]/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#38e8ff] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#38e8ff]"></span>
                    </span>
                    <span className="font-bold tracking-widest text-[10px]">COMET AI PROCESSING</span>
                </div>
                <span className="text-gray-400 hidden sm:inline-block animate-pulse font-mono">{statusMessage}</span>
            </div>
            
            <div className="flex items-center gap-6 text-gray-600 font-medium">
                <span>Ln {highlightedLine + 1}, Col 1</span>
                <span className="hidden sm:inline">UTF-8</span>
                <span className="text-[#38e8ff]">{currentFile.language === 'markdown' ? 'Markdown' : 'TypeScript'}</span>
            </div>
        </div>

      </div>
    </div>
  );
};

export default LoadingSpinner;