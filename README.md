# AudioForge - Audio Editor for Audiobooks

Web-based audio editor specifically designed for audiobook editing, featuring client-side processing, professional-grade audio tools, timeline editing with waveform visualization, and specialized audiobook features.

## Uruchomienie na środowisku lokalnym

### Wymagania

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (dołączony z Node.js)

### Instalacja i uruchomienie

1. **Klonuj lub pobierz projekt**
   ```bash
   # Jeśli używasz Git
   git clone <repository-url>
   cd audioforge
   ```

2. **Zainstaluj zależności**
   ```bash
   npm install
   ```

3. **Uruchom aplikację w trybie development**
   ```bash
   npm run dev
   ```

4. **Otwórz w przeglądarce**
   ```
   http://localhost:5000
   ```

### Dostępne skrypty

```bash
# Development - uruchamia serwer z hot reload
npm run dev

# Production build - buduje aplikację
npm run build

# Start production - uruchamia zbudowaną aplikację
npm start

# Type checking - sprawdza typy TypeScript
npm run check
```

### Struktura aplikacji

```
audioforge/
├── client/                 # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/     # Komponenty React
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/           # Utilities i biblioteki
│   │   └── pages/         # Strony aplikacji
├── server/                # Backend (Express + TypeScript)
│   ├── index.ts           # Główny serwer
│   ├── routes.ts          # API routes
│   └── storage.ts         # Storage interface
├── shared/                # Wspólne typy i schema
└── uploads/              # Folder na pliki audio
```

### Funkcjonalności

- **Timeline editing** - wielościeżkowy edytor audio
- **Waveform visualization** - wizualizacja fali dźwiękowej z optymalizacją wydajności
- **Audio processing** - podstawowe operacje na audio
- **File upload** - wczytywanie plików audio
- **Project management** - zarządzanie projektami (lokalne storage)

### Storage

Aplikacja używa uproszczonej architektury storage:

- **Frontend**: LocalAudioStorage (browser localStorage/IndexedDB)
- **Backend**: MemStorage (in-memory, resetuje się przy restarcie)
- **Pliki**: File system (folder uploads/)

### Rozwiązywanie problemów

**Problem z portem:**
```bash
# Sprawdź czy port 5000 jest wolny
netstat -tulpn | grep :5000

# Lub zmień port w server/index.ts
```

**Problem z Hot Module Reload:**
- LocalAudioStorage resetuje się przy HMR
- Ponownie wczytaj pliki audio po restartach developmentu

**Problem z dużymi plikami audio:**
- Aplikacja jest zoptymalizowana dla plików audiobook (30+ minut)
- Cache waveform może zająć chwilę przy pierwszym wczytaniu

## Deployment

### Docker (zalecane)

Zobacz [README-Docker.md](./README-Docker.md) dla instrukcji Docker deployment.

### Produkcja

```bash
# Build aplikacji
npm run build

# Uruchom production server
npm start
```

## Technologie

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **Audio**: Web Audio API
- **State Management**: React Query, React hooks
- **Styling**: TailwindCSS + shadcn/ui components

## Licencja

MIT License