# AudioForge Docker Deployment

## Storage Architecture

**UWAGA**: Aplikacja AudioForge **nie wymaga bazy danych**! Używa uproszczonej architektury storage:

### Storage w różnych warstwach:

| Warstwa | Storage | Persistence |
|---------|---------|-------------|
| **Backend** | MemStorage (RAM) | Nie - resetuje się przy restarcie |
| **Frontend** | LocalAudioStorage (browser) | Tak - localStorage/IndexedDB |
| **Pliki** | Volume-mounted uploads | Tak - Docker volume |

## Uruchamianie z Docker

```bash
# Uruchom wszystkie serwisy
./docker-run.sh start

# Sprawdź logi
./docker-run.sh logs

# Status serwisów  
./docker-run.sh status
```

## Konfiguracja

1. **Skopiuj template konfiguracji:**
   ```bash
   cp .env.docker .env.production
   ```

2. **Zaktualizuj .env.production:**
   ```bash
   # Ustaw bezpieczny session secret
   SESSION_SECRET=twoj-bardzo-bezpieczny-klucz-minimum-32-znaki
   ```

3. **Restart serwisu:**
   ```bash
   ./docker-run.sh restart
   ```

## Persistence i Storage

- ✅ **Pliki audio**: Volume `audio_uploads` - persistent storage
- ✅ **Projekty/timeline**: Browser localStorage - persistent w przeglądarce
- ⚠️ **Backend state**: MemStorage - resetuje się przy restarcie

## Porty i serwisy

- **AudioForge App**: http://localhost:5000
- **Volume**: `audio_uploads` - uploaded files

## Troubleshooting

### Reset storage
```bash
# Usuń volume z plikami i restart
docker-compose down -v
./docker-run.sh start
```

### Problem z portem
```bash
# Sprawdź czy port jest wolny
netstat -tulpn | grep :5000
```