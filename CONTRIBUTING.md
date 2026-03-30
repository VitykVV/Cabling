# Contributing

## Zasada Główna

Nie rozwijaj projektu bezpośrednio na `main`. `main` ma zostać gałęzią gotową do odtworzenia i wdrożenia.

## Branching

Preferowane nazwy branchy:
- `feature/...`
- `fix/...`
- `refactor/...`
- `docs/...`
- `codex/...`

Przykłady:
- `feature/rule-preview-improvements`
- `fix/export-xlsx-metadata`

## Lokalny Gate Przed Push

Przed pushem uruchom:

```bash
npm run check
```

Minimalny standard zmian:
- testy przechodzą;
- build przechodzi;
- smoke test przechodzi;
- zmiana nie dodaje nowych sekretów ani plików środowiskowych do repo.

## Pull Request

Każdy PR powinien zawierać:
- krótki opis celu zmiany;
- zakres techniczny;
- wpływ na dane bazowe lub eksport, jeśli istnieje;
- sposób weryfikacji;
- screeny tylko wtedy, gdy zmiana dotyczy UI.

## Zmiany Danych Biznesowych

Jeżeli zmieniasz `seed.json`, reguły albo dane referencyjne:
- opisz źródło zmiany;
- nie usuwaj ostrzeżeń danych bez podstawy biznesowej;
- oddzielaj refaktor kodu od zmian danych, jeżeli to możliwe.

## Co Nie Powinno Trafiać Do Repo

Nie commituj:
- `.env` i lokalnych wariantów środowiska;
- baz SQLite;
- plików runtime;
- tymczasowych plików Excela typu `~$...`.

## Zalecane Ustawienia GitHub

Po stronie repo w GitHub UI ustaw:
- branch protection dla `main`;
- wymagany status check `CI`;
- zakaz pushowania bezpośrednio do `main`;
- co najmniej jedno review przed merge.
