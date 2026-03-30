# Docker Production

## Co jest przygotowane

Stack produkcyjny sklada sie z 2 kontenerow:
- `app` - aplikacja Node.js z baza SQLite i eksportem PDF/XLSX
- `nginx` - reverse proxy przed aplikacja

Dziala tez healthcheck:
- aplikacja: `GET /health`
- nginx: `GET /nginx-health`

## Pliki

- `Dockerfile` - obraz aplikacji
- `docker-compose.yml` - glowny stack produkcyjny pod VPS i zwykly serwer Docker
- `docker-compose.synology.yml` - override pod Synology / NAS z bind mountem `./runtime`
- `nginx/Dockerfile` - obraz reverse proxy`r`n- `nginx/conf.d/default.conf` - konfiguracja reverse proxy
- `.env.docker.example` - przykladowe zmienne

## Szybki start

Skopiuj zmienne:

```powershell
Copy-Item .env.docker.example .env
```

Uruchom:

```powershell
docker compose up -d --build
```

Aplikacja bedzie dostepna pod adresem:

```text
http://127.0.0.1:4321
```

Jesli chcesz port 80, ustaw w `.env`:

```text
PUBLIC_PORT=80
```

## VPS

Najprostszy wariant pod VPS:

1. skopiuj projekt na serwer
2. skopiuj `.env.docker.example` do `.env`
3. ustaw `PUBLIC_PORT=80`
4. uruchom:

```bash
docker compose up -d --build
```

Sprawdzenie:

```bash
docker compose ps
curl http://127.0.0.1/health
```

## Synology / NAS

Na Synology i wielu NAS wygodniej trzymac baze jako zwykly folder obok projektu.
Do tego sluzy override `docker-compose.synology.yml`.

Uruchom:

```bash
docker compose -f docker-compose.yml -f docker-compose.synology.yml up -d --build
```

To zapisze baze SQLite do folderu:

```text
./runtime/app.db
```

Ten wariant jest wygodny do backupu i podgladu danych w NAS.

## Healthcheck i status

Stan kontenerow:

```bash
docker compose ps
```

Logi:

```bash
docker compose logs -f
```

Health aplikacji przez nginx:

```bash
curl http://127.0.0.1:${PUBLIC_PORT:-4321}/health
```

Health nginx lokalnie w kontenerze:

```bash
docker compose exec nginx wget -q -O - http://127.0.0.1/nginx-health
```

## Dane trwale

- baza SQLite jest zapisywana poza warstwa obrazu
- domyslnie:
  - VPS / zwykly Docker: named volume `cabling-runtime`
  - Synology / NAS: folder `./runtime`
- dane startowe `seed.json` pozostaja w obrazie i seeduja baze przy pierwszym starcie

## PDF i polskie znaki

Kontener instaluje font `DejaVu Sans`, dzieki czemu eksport PDF zachowuje polskie znaki takze w Linux / Docker.

## Ważne

Ten stack jest przygotowany do stabilnego uruchomienia produkcyjnego w HTTP.
Jesli aplikacja ma byc wystawiona do internetu po domenie, nastepny krok to certyfikat TLS / HTTPS.
Mozna to zrobic przez:
- zewnetrzny reverse proxy na VPS
- reverse proxy Synology
- osobny certbot / proxy manager

## Stan na

Fakty zweryfikowane na: `2026-03-27`
- `docker build` przechodzi
- `docker compose config -q` przechodzi
- kontener `app` przechodzi healthcheck
- `nginx` odpowiada przed aplikacja
- `GET /api/bootstrap` zwraca `200`
- eksport `PDF` i `XLSX` dziala z kontenera

