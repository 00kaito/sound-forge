# AudioForge - Instrukcja uruchomienia na komputerze lokalnym

## Wymagania systemowe

- **Node.js** w wersji 20 lub nowszej
- **npm** (dostarczany z Node.js)
- **PostgreSQL** (opcjonalnie, dla pełnej funkcjonalności bazy danych)

## Instalacja

### 1. Sklonuj repozytorium

```bash
git clone <url-repozytorium>
cd audioforge
```

### 2. Zainstaluj zależności

```bash
npm install
```

### 3. Konfiguracja zmiennych środowiskowych

Utwórz plik `.env` w głównym katalogu projektu z następującymi zmiennymi:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/audioforge
NODE_ENV=development
```

Jeśli nie masz PostgreSQL, aplikacja będzie działać z ograniczoną funkcjonalnością (bez zapisu do bazy danych).

### 4. Uruchomienie w trybie deweloperskim

```bash
npm run dev
```

Aplikacja będzie dostępna pod adresem: **http://localhost:5000**

## Budowanie wersji produkcyjnej

### 1. Zbuduj aplikację

```bash
npm run build
```

### 2. Uruchom wersję produkcyjną

```bash
npm start
```

## Dostępne skrypty

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Uruchamia serwer deweloperski z hot-reload |
| `npm run build` | Buduje aplikację do produkcji |
| `npm start` | Uruchamia zbudowaną wersję produkcyjną |
| `npm run check` | Sprawdza typy TypeScript |
| `npm run db:push` | Synchronizuje schemat bazy danych (wymaga PostgreSQL) |

## Struktura projektu

```
audioforge/
├── client/              # Kod frontend (React)
│   ├── src/
│   │   ├── components/  # Komponenty UI
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Biblioteki pomocnicze
│   │   ├── pages/       # Strony aplikacji
│   │   └── types/       # Definicje typów TypeScript
│   └── index.html
├── server/              # Kod backend (Express)
│   ├── index.ts         # Punkt wejścia serwera
│   ├── routes.ts        # Definicje tras API
│   └── storage.ts       # Warstwa dostępu do danych
├── shared/              # Współdzielony kod
│   └── schema.ts        # Schemat bazy danych (Drizzle)
└── package.json
```

## Rozwiązywanie problemów

### Port 5000 jest zajęty

Upewnij się, że żadna inna aplikacja nie używa portu 5000, lub zmień port w konfiguracji serwera.

### Błędy połączenia z bazą danych

Sprawdź czy:
- PostgreSQL jest uruchomiony
- Dane dostępowe w `DATABASE_URL` są poprawne
- Baza danych istnieje

### Błędy podczas instalacji zależności

Spróbuj wyczyścić cache npm:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Wsparcie

W przypadku problemów sprawdź plik `replit.md` zawierający szczegółową dokumentację techniczną projektu.
