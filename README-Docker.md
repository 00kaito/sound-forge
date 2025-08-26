# AudioForge Docker Deployment

## Database Configuration

**UWAGA**: Aplikacja AudioForge została zaprojektowana dla **Neon Database** (serverless PostgreSQL), ale Docker setup używa **lokalnego PostgreSQL** dla łatwości deployment.

### Różnice między środowiskami:

| Środowisko | Baza danych | Konfiguracja |
|------------|-------------|--------------|
| **Development (Replit)** | Neon Database | `DATABASE_URL` z Neon connection string |
| **Docker (lokalne)** | PostgreSQL 15 | `DATABASE_URL` z lokalnym PostgreSQL |
| **Production (cloud)** | Neon Database | `DATABASE_URL` z Neon connection string |

## Uruchamianie z Docker

```bash
# Uruchom wszystkie serwisy
./docker-run.sh start

# Sprawdź logi
./docker-run.sh logs

# Status serwisów  
./docker-run.sh status
```

## Konfiguracja dla produkcji

1. **Skopiuj template konfiguracji:**
   ```bash
   cp .env.docker .env.production
   ```

2. **Zaktualizuj .env.production:**
   ```bash
   # Zmień na swój Neon Database connection string
   DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
   
   # Ustaw bezpieczny session secret
   SESSION_SECRET=twoj-bardzo-bezpieczny-klucz-minimum-32-znaki
   ```

3. **Restart serwisów:**
   ```bash
   ./docker-run.sh restart
   ```

## Migracja danych

Aplikacja używa Drizzle ORM z automatyczną migracją schema. Schema zostało poprawione dla kompatybilności PostgreSQL:

- ✅ `datetime('now')` → `now()` (PostgreSQL syntax)
- ✅ UUID generation z `gen_random_uuid()`
- ✅ Kompatybilność z Neon Database i standardowym PostgreSQL

## Porty i serwisy

- **AudioForge App**: http://localhost:5000
- **PostgreSQL**: localhost:5432
- **Volumes**: 
  - `audio_uploads` - pliki audio
  - `postgres_data` - dane bazy

## Troubleshooting

### Problem z migracją bazy
```bash
# Usuń volumes i restart
docker-compose down -v
./docker-run.sh start
```

### Problem z portami
```bash
# Sprawdź czy porty są wolne
netstat -tulpn | grep :5000
netstat -tulpn | grep :5432
```