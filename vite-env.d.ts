/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
    // Adaugă aici alte variabile de mediu dacă mai ai
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
