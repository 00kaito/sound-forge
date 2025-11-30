# AudioForge - Instrukcja uruchomienia lokalnego

## Wymagania systemowe

- **Node.js** w wersji 20 lub nowszej
- **npm** (instalowany razem z Node.js)
- **Docker** i **Docker Compose** (opcjonalnie - dla uruchomienia w kontenerze)

## Metoda 1: Uruchomienie bez Dockera (zalecane dla deweloperów)

### 1. Zainstaluj Node.js 20+

**Windows:**
Pobierz instalator z [nodejs.org](https://nodejs.org/) (wersja LTS 20.x lub nowsza)

**macOS (Homebrew):**
```bash
brew install node@20
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Sklonuj repozytorium

```bash
git clone <url-repozytorium>
cd audioforge
```

### 3. Zainstaluj zależności

```bash
npm install
```

### 4. Uruchom aplikację

```bash
npm run dev
```

### 5. Otwórz przeglądarkę

Aplikacja będzie dostępna pod adresem: **http://localhost:5000**

---

## Metoda 2: Uruchomienie z Dockerem

### 1. Zainstaluj Docker

Pobierz i zainstaluj Docker Desktop z [docker.com](https://docs.docker.com/get-docker/)

### 2. Sklonuj repozytorium

```bash
git clone <url-repozytorium>
cd audioforge
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

### 4. Otwórz przeglądarkę

Aplikacja będzie dostępna pod adresem: **http://localhost:5000**

### Przydatne komendy Docker

```bash
# Uruchom aplikację
./docker-run.sh start

# Zatrzymaj aplikację
./docker-run.sh stop

# Wyświetl logi
./docker-run.sh logs

# Zbuduj obraz od nowa
./docker-run.sh build

# Sprawdź status
./docker-run.sh status

# Wyczyść wszystko (usuwa dane!)
./docker-run.sh clean
```

---

## Rozwiązywanie problemów

### Problem: "tsx: not found"
**Rozwiązanie:** Upewnij się, że używasz Node.js w wersji 20 lub nowszej:
```bash
node --version
```

### Problem: "import.meta.dirname is undefined"
**Rozwiązanie:** Zaktualizuj Node.js do wersji 20+. Starsze wersje nie wspierają tej funkcjonalności.

### Problem: Aplikacja nie uruchamia się na porcie 5000
**Rozwiązanie:** Sprawdź czy port 5000 nie jest zajęty przez inną aplikację:
```bash
# Linux/macOS
lsof -i :5000

# Windows
netstat -ano | findstr :5000
```

### Problem: Błędy podczas instalacji npm
**Rozwiązanie:** Wyczyść cache npm i zainstaluj ponownie:
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## Struktura projektu

```
audioforge/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # Komponenty UI
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Biblioteki pomocnicze
│   │   ├── pages/          # Strony aplikacji
│   │   └── types/          # Definicje TypeScript
│   └── index.html
├── server/                 # Backend (Express)
│   ├── index.ts            # Punkt wejścia serwera
│   ├── routes.ts           # Definicje API
│   └── storage.ts          # Warstwa danych
├── shared/                 # Współdzielone typy
├── Dockerfile              # Konfiguracja Docker
├── docker-compose.yml      # Orkiestracja kontenerów
└── package.json            # Zależności projektu
```

---

## Funkcjonalności AudioForge

- Edycja wielościeżkowa audio
- Wizualizacja fali dźwiękowej z wysoką wydajnością
- Obsługa długich plików audio (30+ minut)
- Zoom do 1500%
- Eksport projektów
- Przetwarzanie audio w czasie rzeczywistym

---

## Wsparcie

W przypadku problemów utwórz issue w repozytorium projektu.
