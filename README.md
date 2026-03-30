# Cabling MVP

[![CI](https://github.com/VitykVV/Cabling/actions/workflows/ci.yml/badge.svg)](https://github.com/VitykVV/Cabling/actions/workflows/ci.yml)

Lokalna aplikacja webowa do liczenia długości przewodów wiązki kablowej dla central `BS-C`, z edycją danych bazowych, reguł i eksportem `PDF`/`XLSX`.

Stan techniczny na `2026-03-30`:
- aplikacja buduje się lokalnie i przechodzi testy automatyczne;
- zapis blokuje błędy krytyczne walidacji;
- fundament repo jest przygotowany do dalszej rozbudowy;
- ostrzeżenia danych biznesowych nadal istnieją i są świadomie odłożone do późniejszego uzupełnienia.

## Szybki Start

### Windows

```powershell
.\URUCHOM_APLIKACJE.ps1 -Mode prod
```

### Tryb developerski

```powershell
npm run dev
```

Aplikacja domyślnie działa pod adresem `http://127.0.0.1:4321`.

## Komendy Robocze

```bash
npm test
npm run build
npm run test:smoke
npm run check
```

Znaczenie:
- `npm test` uruchamia testy domenowe i testy store;
- `npm run build` buduje frontend do `dist/`;
- `npm run test:smoke` sprawdza serwer, bootstrap, statyczny frontend i eksport `XLSX`;
- `npm run check` uruchamia pełny lokalny gate przed pushem.

## Dokumentacja

- [URUCHOMIENIE.md](./URUCHOMIENIE.md) - uruchomienie lokalne i podstawowe komendy.
- [DOCKER.md](./DOCKER.md) - stack kontenerowy.
- [CONTRIBUTING.md](./CONTRIBUTING.md) - zasady rozwoju repo.
- [SPECYFIKACJA_GO_MVP.md](./SPECYFIKACJA_GO_MVP.md) - zakres i kryteria MVP.

## Workflow Repo

Rekomendowany workflow:
1. twórz branch roboczy od `main`;
2. rozwijaj zmianę poza `main`;
3. uruchom `npm run check` przed pushem;
4. otwórz PR do `main`;
5. merguj dopiero po zielonym `CI` i review.

## Lokalny Bezpiecznik

Repo ma aktywny lokalnie hook `pre-push`, który blokuje przypadkowy push do `main`.

Awaryjne obejście tylko świadomie:
- `PowerShell: $env:ALLOW_MAIN_PUSH=1; git push origin main`
- `bash: ALLOW_MAIN_PUSH=1 git push origin main`

## Zalecane Ustawienia GitHub

Tych ustawień nie da się wiarygodnie wymusić samymi plikami repo, więc trzeba je kliknąć w GitHub UI:
- włączyć branch protection dla `main`;
- wymagać status check `CI`;
- zablokować direct push do `main`;
- wymagać minimum jednego review;
- opcjonalnie wymagać review od `CODEOWNERS`.

## Jakość Danych

Repo jest gotowe do rozbudowy technicznej, ale dane biznesowe nadal mogą zawierać ostrzeżenia nieblokujące. To nie blokuje rozwoju kodu, ale blokuje traktowanie wyniku jako w pełni domkniętego biznesowo.
