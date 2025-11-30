# AudioForge - Edytor Audio dla Audiobooków

Webowy edytor audio zaprojektowany specjalnie do edycji audiobooków. Oferuje przetwarzanie po stronie klienta, profesjonalne narzędzia audio, edycję na timeline z wizualizacją fali dźwiękowej oraz funkcje Text-to-Speech z obsługą wielu dostawców.

## Spis treści

- [Wymagania systemowe](#wymagania-systemowe)
- [Szybki start](#szybki-start)
- [Konfiguracja zmiennych środowiskowych](#konfiguracja-zmiennych-środowiskowych)
- [Uruchomienie z Dockerem](#uruchomienie-z-dockerem)
- [Funkcjonalności](#funkcjonalności)
- [Struktura projektu](#struktura-projektu)
- [Rozwiązywanie problemów](#rozwiązywanie-problemów)

---

## Wymagania systemowe

- **Node.js 20+** - [Pobierz](https://nodejs.org/) (wersja LTS 20.x lub nowsza)
- **npm** (instalowany automatycznie z Node.js)
- **Docker** (opcjonalnie - do uruchomienia w kontenerze)

### Instalacja Node.js

**Windows:**
Pobierz instalator z [nodejs.org](https://nodejs.org/) (wybierz wersję LTS 20.x)

**macOS (Homebrew):**
```bash
brew install node@20
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## Szybki start

### 1. Sklonuj repozytorium

```bash
git clone <url-repozytorium>
cd audioforge
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Skonfiguruj zmienne środowiskowe (dla funkcji TTS)

Jeśli chcesz korzystać z funkcji Text-to-Speech, utwórz plik `.env` w głównym katalogu projektu:

```env
# Klucze API dla Text-to-Speech (musisz uzyskać własne klucze!)
TRANSKRIPTOR_API_KEY=twój_klucz_transkriptor
OPENAI_API_KEY=twój_klucz_openai
```

> **Ważne:** 
> - Klucze API **nie są dołączone** do repozytorium - musisz uzyskać własne
> - Aplikacja działa bez kluczy API, ale funkcja TTS będzie niedostępna
> - Transkriptor: [transkriptor.com](https://transkriptor.com)
> - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 4. Uruchom aplikację

```bash
npm run dev
```

### 5. Otwórz w przeglądarce

```
http://localhost:5000
```

---

## Konfiguracja zmiennych środowiskowych

### Klucze API dla Text-to-Speech

| Zmienna | Opis | Gdzie uzyskać |
|---------|------|---------------|
| `TRANSKRIPTOR_API_KEY` | Klucz API Transkriptor (27 polskich głosów z emocjami) | [transkriptor.com](https://transkriptor.com) |
| `OPENAI_API_KEY` | Klucz API OpenAI (6 głosów: alloy, echo, fable, onyx, nova, shimmer) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

### Porównanie dostawców TTS

| Funkcja | Transkriptor | OpenAI |
|---------|--------------|--------|
| Liczba głosów | 27 polskich | 6 uniwersalnych |
| Emocje/Style | 14 opcji (np. Calm, Cheerful, Dramatic) | Brak |
| Język | Polski | Wielojęzyczny |
| Jakość | Wysoka | Bardzo wysoka |
| Rate limiting | 2s między requestami | Brak |
| Retry logic | 3 próby z backoff | Brak |

### Przechowywanie danych

Aplikacja używa **pamięci (in-memory storage)** na backendzie i **localStorage/IndexedDB** w przeglądarce:

| Warstwa | Storage | Trwałość |
|---------|---------|----------|
| Backend | MemStorage (RAM) | Resetuje się przy restarcie serwera |
| Frontend | LocalAudioStorage | Trwałe w przeglądarce |
| Pliki audio | Folder `uploads/` | Trwałe na dysku |

> **Uwaga:** Projekty i ustawienia są zapisywane w przeglądarce. Eksportuj projekty regularnie aby nie stracić pracy.

---

## Uruchomienie z Dockerem

### 1. Zainstaluj Docker

Pobierz Docker Desktop z [docker.com](https://docs.docker.com/get-docker/)

### 2. Utwórz plik `.env`

```env
TRANSKRIPTOR_API_KEY=twój_klucz
OPENAI_API_KEY=twój_klucz
```

### 3. Uruchom za pomocą skryptu

**Linux/macOS:**
```bash
chmod +x docker-run.sh
./docker-run.sh start
```

**Windows (PowerShell):**
```powershell
docker-compose up -d
```

### 4. Otwórz w przeglądarce

```
http://localhost:5000
```

### Komendy Docker

```bash
./docker-run.sh start    # Uruchom aplikację
./docker-run.sh stop     # Zatrzymaj aplikację
./docker-run.sh logs     # Wyświetl logi
./docker-run.sh build    # Zbuduj obraz od nowa
./docker-run.sh status   # Sprawdź status
./docker-run.sh clean    # Wyczyść wszystko (usuwa dane!)
```

---

## Funkcjonalności

### Edycja audio
- **Edycja wielościeżkowa** - obsługa wielu ścieżek audio jednocześnie
- **Wizualizacja fali dźwiękowej** - zoptymalizowana dla długich plików (30+ minut)
- **Zoom do 1500%** - precyzyjna edycja fragmentów
- **Drag & drop** - przeciąganie i upuszczanie klipów na timeline

### Text-to-Speech (TTS)
- **Dual TTS** - wybór między Transkriptor a OpenAI
- **27 polskich głosów** (Transkriptor) z 14 stylami emocji
- **6 głosów OpenAI** (alloy, echo, fable, onyx, nova, shimmer)
- **Tryb dialogowy** - automatyczne rozpoznawanie mówców (format "Imię: tekst")
- **Per-fragment kontrola** - różne głosy i emocje dla każdego fragmentu

### Zarządzanie projektem
- **Zapis/wczytywanie projektów** - format JSON z pełnym stanem projektu
- **Eksport audio** - eksport do różnych formatów
- **Historia zmian** - cofanie/ponawianie operacji

---

## Dostępne skrypty

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Uruchamia serwer deweloperski z hot-reload |
| `npm run build` | Buduje aplikację do produkcji |
| `npm start` | Uruchamia zbudowaną wersję produkcyjną |
| `npm run check` | Sprawdza typy TypeScript |

---

## Struktura projektu

```
audioforge/
├── client/                 # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/     # Komponenty UI
│   │   │   └── audio-editor/  # Komponenty edytora audio
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Biblioteki pomocnicze
│   │   │   ├── audio-engine.ts      # Silnik audio (Web Audio API)
│   │   │   └── tts-service.ts       # Serwis TTS
│   │   ├── pages/          # Strony aplikacji
│   │   └── types/          # Definicje TypeScript
│   └── index.html
├── server/                 # Backend (Express + TypeScript)
│   ├── index.ts            # Punkt wejścia serwera
│   ├── routes.ts           # Definicje API (w tym TTS endpoints)
│   └── storage.ts          # Warstwa dostępu do danych
├── shared/                 # Współdzielone typy i schemat
│   └── schema.ts           # Definicje typów i schematów
├── uploads/                # Folder na pliki audio
├── Dockerfile              # Konfiguracja Docker
├── docker-compose.yml      # Orkiestracja kontenerów
└── package.json            # Zależności projektu
```

---

## Rozwiązywanie problemów

### Problem: "tsx: not found" lub "import.meta.dirname is undefined"

**Przyczyna:** Używasz starej wersji Node.js

**Rozwiązanie:** Zaktualizuj Node.js do wersji 20+:
```bash
node --version  # Sprawdź wersję
```

### Problem: Port 5000 jest zajęty

**Rozwiązanie:** Znajdź i zamknij proces używający portu:

```bash
# Linux/macOS
lsof -i :5000
kill -9 <PID>

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Problem: Błędy podczas instalacji npm

**Rozwiązanie:** Wyczyść cache i zainstaluj ponownie:
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Problem: TTS nie generuje audio

**Rozwiązanie:** Sprawdź czy:
1. Klucze API są poprawnie skonfigurowane w pliku `.env`
2. Klucze są aktywne i mają wystarczające środki
3. Serwer został zrestartowany po dodaniu kluczy

### Problem: Hot Module Reload resetuje pliki

**Wyjaśnienie:** LocalAudioStorage używa pamięci przeglądarki i może się resetować przy HMR. Ponownie wczytaj pliki audio po restartach serwera deweloperskiego.

### Problem: Wolne ładowanie dużych plików

**Wyjaśnienie:** Aplikacja jest zoptymalizowana dla audiobooków (30+ minut). Pierwsze wczytanie pliku może zająć chwilę ze względu na generowanie cache waveform.

---

## Technologie

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Radix UI, shadcn/ui
- **Backend:** Express.js, TypeScript
- **Audio:** Web Audio API
- **State Management:** TanStack Query (React Query), React hooks
- **TTS:** Transkriptor API, OpenAI TTS API
- **Storage:** In-memory (backend), localStorage/IndexedDB (frontend)

---

## API Endpoints

### TTS (Text-to-Speech)

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/tts/generate` | POST | Generuje audio przez Transkriptor |
| `/api/tts/generate/openai` | POST | Generuje audio przez OpenAI |

---

## Licencja

MIT License
