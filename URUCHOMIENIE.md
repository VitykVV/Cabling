# Uruchomienie aplikacji

## Najprostsza opcja

W folderze projektu uruchom:

```powershell
.\URUCHOM_APLIKACJE.ps1
```

albo przez plik CMD:

```cmd
URUCHOM_APLIKACJE.cmd
```

Aplikacja wystartuje pod adresem:

```text
http://127.0.0.1:4321
```

Zatrzymanie serwera:

```text
Ctrl+C
```

## Docker Production

Instrukcja produkcyjnego stacku Docker jest w pliku `DOCKER.md`.

Szybki start:

```powershell
Copy-Item .env.docker.example .env
docker compose up -d --build
```

Stack produkcyjny zawiera:
- `app`
- `nginx`
- healthcheck
- trwala baze SQLite poza obrazem

Pod Synology / NAS uzyj:

```powershell
docker compose -f docker-compose.yml -f docker-compose.synology.yml up -d --build
```

## Tryby pracy

Tryb standardowy, zalecany do zwyklego uzycia:

```powershell
.\URUCHOM_APLIKACJE.ps1 -Mode prod
```

Co robi:
- sprawdza `node` i `npm`
- instaluje zaleznosci, jesli brakuje `node_modules`
- buduje frontend
- uruchamia aplikacje

Tryb developerski:

```powershell
.\URUCHOM_APLIKACJE.ps1 -Mode dev
```

Co robi:
- uruchamia backend
- uruchamia watcher frontendu
- odswieza build przy zmianach plikow

## Reczne komendy

Build frontendu:

```powershell
npm run build
```

Start aplikacji po buildzie:

```powershell
npm run start
```

Tryb developerski:

```powershell
npm run dev
```

## Wymagania

- Node.js z `npm`
- Windows PowerShell lub PowerShell 7
- Docker Desktop, jesli uruchamiasz wersje kontenerowa

## Stan na

Fakty zweryfikowane na: `2026-03-27`
- `npm run start` dziala
- `GET /` zwraca `200`
- `GET /api/bootstrap` zwraca `200`
- eksport `XLSX` i `PDF` dziala
- produkcyjny stack Docker z `nginx` i healthcheckiem dziala
