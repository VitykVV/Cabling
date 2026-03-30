# Prompt dla Codex: techniczna implementacja MVP aplikacji długości kabli

Podstawa analizy:
- plik źródłowy: `B:\Cabling\BS-C Dlugosci przewodow2.xlsm`
- stan danych: `2026-03-26 10:57 CET`

## Gotowy prompt MVP

```text
Masz zbudować działające MVP aplikacji „Aplikacja długości kabli”, która zastępuje skoroszyt Excel używany do liczenia długości przewodów dla central BS-C.

Najważniejszy cel:
- dostarczyć działające MVP end-to-end, a nie szkic;
- odtworzyć logikę Excela dla podstawowego scenariusza referencyjnego;
- umożliwić edycję danych bazowych i reguł bez zmiany kodu;
- umożliwić tworzenie nowych konfiguracji biznesowych;
- pokazać użytkownikowi logikę wyliczenia dla każdej pozycji.

Zasady pracy:
- najpierw przeanalizuj istniejący projekt w repozytorium;
- jeśli repozytorium jest puste, zbuduj lokalny MVP w prostym stacku: `TypeScript + React + Vite` dla frontendu oraz lekki backend lokalny w `Node.js/TypeScript` albo prostą warstwę danych opartą o JSON/SQLite;
- nie używaj Excela jako runtime engine;
- przenieś logikę do jawnego, testowalnego silnika reguł;
- nie chowaj warunków biznesowych w komponentach UI;
- po zakończeniu uruchom weryfikację i zostaw projekt w stanie możliwym do lokalnego uruchomienia.

Zakres MVP:

1. Ekrany MVP
- ekran `Konfigurator`:
  - wybór `wlk`
  - wybór `konfiguracja`
  - wybór `Nagrzewnica`
  - wybór `Wentylator NW`
  - wybór `Wentylator W`
  - wybór `Przepustnica na Wyciągu`
  - wybór `Recyrkulacja`
  - wybór `Presostat Filra`
  - wybór `Presostat Wymiennika`
  - wybór `Przetwornik ciśnienia went.`
  - przycisk `Oblicz`
  - zapis konfiguracji pod nazwą
  - lista zapisanych konfiguracji z akcjami: wczytaj, duplikuj, usuń
- ekran `Wynik`:
  - tabela pozycji: `lp`, `element`, `wlk`, `typ kabla`, `suma, m`
  - podsumowanie metrów wg typu kabla
  - rozwijany podgląd logiki obliczeń dla każdego wiersza
- ekran `Dane bazowe`:
  - edycja wariantów `wlk`
  - edycja wymiarów `L/B/H`
  - edycja mapowania `index -> mm`
  - edycja słowników opcji
  - edycja typów kabli
- ekran `Reguły`:
  - lista reguł pozycji
  - tworzenie nowej reguły
  - edycja istniejącej reguły
  - testowanie reguły na bieżącej konfiguracji
- ekran `Nowa konfiguracja biznesowa`:
  - dodanie nowej wartości słownikowej do grupy `konfiguracja`
  - przypisanie tej wartości do wybranych reguł
  - podgląd wpływu na wynik

2. Architektura
Zaimplementuj projekt w podziale na moduły:
- `app/` albo `src/app/`: shell aplikacji, routing, layout
- `features/configurator/`: formularz i zapis konfiguracji
- `features/results/`: tabela wynikowa i podsumowanie
- `features/rules/`: CRUD reguł
- `features/reference-data/`: CRUD danych bazowych
- `domain/cable-calculation/`: czysty silnik obliczeń
- `domain/rules/`: modele reguł i walidacja
- `domain/reference-data/`: modele słowników, wymiarów i mapowań
- `lib/persistence/`: zapis/odczyt danych
- `tests/`: testy jednostkowe i scenariusz referencyjny

3. Model danych
Zaprojektuj jawny model danych. Minimum:

`ReferenceData`
- `variants[]`
  - `id`
  - `code` np. `BS-C-H-2`
  - `lengthMm`
  - `widthMm`
  - `heightMm`
  - `isActive`
- `indexMappings[]`
  - `id`
  - `variantCode`
  - `indexCode`
  - `distanceMm`
- `optionGroups[]`
  - `id`
  - `code`
  - `label`
  - `type` (`single-select` albo `boolean-select`)
- `optionValues[]`
  - `id`
  - `groupCode`
  - `value`
  - `label`
  - `isActive`
- `cableTypes[]`
  - `id`
  - `code`
  - `label`
  - `isActive`

`RuleRecord`
- `id`
- `element`
- `groupCode`
- `allowedValues[]`
- `variantCodeMode`:
  - `single` albo `all`
- `variantCodes[]`
- `indexCode`
- `exitToElementMm`
- `slackInMm`
- `slackOutMm`
- `cableType`
- `showInReport`
- `description`
- `notes`

`SavedConfiguration`
- `id`
- `name`
- `selections`
  - `wlk`
  - `konfiguracja`
  - `Nagrzewnica`
  - `Wentylator NW`
  - `Wentylator W`
  - `Przepustnica na Wyciągu`
  - `Recyrkulacja`
  - `Presostat Filra`
  - `Presostat Wymiennika`
  - `Przetwornik ciśnienia went.`
- `createdAt`
- `updatedAt`

`CalculationRow`
- `lp`
- `element`
- `wlk`
- `cableType`
- `indexCode`
- `distanceFromPanelMm`
- `exitToElementMm`
- `slackInMm`
- `slackOutMm`
- `sumMm`
- `sumM`
- `activatedBy`
- `explanation`

4. Silnik reguł
Zaimplementuj czysty silnik:
- wejście: `ReferenceData + SavedConfiguration + RuleRecord[]`
- wyjście:
  - lista aktywnych pozycji
  - podsumowanie wg typu kabla
  - lista ostrzeżeń o brakach danych

Reguła aktywacji:
- pozycja jest aktywna, gdy wartość wybrana przez użytkownika dla `groupCode` należy do `allowedValues[]`;
- dla grupy `standard` pozycja jest zawsze aktywna;
- dla pozycji bez typu kabla nie dodawaj ich do podsumowania kabli, ale pokaż je w logice, jeśli `showInReport = true`;
- jeśli brakuje mapowania `variantCode + indexCode`, zwróć ostrzeżenie i nie generuj wyniku liczbowego dla tej pozycji.

Wzór obliczenia:
- `sumMm = distanceFromPanelMm + exitToElementMm + slackInMm + slackOutMm`
- `sumM = sumMm / 1000`

Każdy wynik musi mieć pełne wyjaśnienie:
- dlaczego pozycja weszła do wyniku;
- z jakiej reguły pochodzi;
- jakie liczby weszły do wzoru;
- jaki jest końcowy wynik.

5. Dane startowe do MVP
Załaduj dane początkowe na podstawie analizy Excela.

Warianty `wlk`:
- `BS-C-H-1`: `L=1750`, `B=600`, `H=800`
- `BS-C-H-2`: `L=1950`, `B=800`, `H=1000`
- `BS-C-H-3`: `L=1950`, `B=1200`, `H=1000`
- `BS-C-H-4`: `L=2450`, `B=1200`, `H=1200`
- `BS-C-H-5`: `L=2450`, `B=1400`, `H=1200`
- `BS-C-H-6`: `L=2600`, `B=1600`, `H=1410`
- `BS-C-H-7`: `L=2850`, `B=1600`, `H=1800`

Obsługiwane wartości słownikowe:
- `konfiguracja`:
  - `Matka`
  - `Matka+CH`
  - `Matka+satelitka nietypowa`
  - `Matka+DB`
  - `Matka+DB+CH`
  - `Matka+DB+satelitka nietypowa`
  - `DB+Matka`
  - `DB+Matka+CH`
  - `DB+Matka+BD`
  - `DB+Matka+BD+CH`
- `Nagrzewnica`:
  - `Brak`
  - `Wodna`
  - `PTC 3 kw`
  - `PTC 6 kw`
  - `PTC 9 kw`
  - `PTC 12 kw`
  - `PTC 15 kw`
  - `PTC 18 kw`
  - `PTC T12+T9 kw`
  - `PTC T12+T12 kw`
  - `PTC T15+T12 kw`
  - `PTC T15+T15 kw`
  - `PTC T12+T12+T9 kw`
  - `PTC T12+T12+T12 kw`
  - `PTC T15+T12+T12 kw`
- `Wentylator NW` i `Wentylator W`:
  - `GR20V`
  - `GR25C 0,5 kW (0,78kW)`
  - `2 x GR25C 0,5 kW (0,78kW)`
  - `GR28C 0,78 kW`
  - `GR31C 0,78 kW`
  - `GR31C 1,35 kW`
  - `GR31C 2,5 kW`
  - `2 x GR31C 1,35 kW`
  - `2 x GR31C 2,5 kW`
  - `GR40C 3,9 kW`
  - `GR50C 3,5 kW`
  - `GR50C 5,4 kW`
- `Przepustnica na Wyciągu`:
  - `Na wlocie`
  - `Na wylocie`
- `Recyrkulacja`, `Presostat Filra`, `Presostat Wymiennika`, `Przetwornik ciśnienia went.`:
  - `Brak`
  - `Zamontować`

6. Ograniczenia źródła danych
Uwzględnij jawnie w implementacji:
- `BS-C-H-6` i `BS-C-H-7` mają wymiary, ale nie mają pełnego mapowania `Index`, więc UI ma zgłaszać brak danych i kierować użytkownika do edycji danych bazowych;
- `Matka+DB` i `DB+Matka` są osobnymi wartościami i nie wolno ich scalać automatycznie;
- część pozycji, np. `Nagrzewnica PTC` i `Złączki`, nie ma przypisanego typu kabla;
- jeśli w źródle są niespójności mapowania, pokaż ostrzeżenie w sekcji `Do potwierdzenia` lub `Problemy danych`.

7. Funkcje edycyjne wymagane już w MVP
MVP nie może być tylko kalkulatorem read-only.
Musi zawierać:
- dodawanie nowej wartości do grupy `konfiguracja`;
- edycję list słownikowych;
- edycję `indexMappings`;
- tworzenie nowej reguły;
- edycję istniejącej reguły;
- podgląd wyniku po zmianie reguły lub danych bazowych jeszcze przed zapisaniem;
- walidację przed zapisem.

8. UI logiki obliczeń
Dla każdego wiersza wyniku dodaj `Pokaż logikę`.
Widok logiki ma pokazać co najmniej:
- `groupCode`
- `allowedValues`
- aktualny wybór użytkownika
- informację `reguła aktywna / nieaktywna`
- `indexCode`
- `distanceFromPanelMm`
- `exitToElementMm`
- `slackInMm`
- `slackOutMm`
- `sumMm`
- `sumM`
- tekstowe wyjaśnienie

9. Trwałość danych
Jeśli repozytorium nie narzuca inaczej, użyj jednego z dwóch podejść:
- `SQLite` z prostym repozytorium danych;
- albo pliki `JSON` w katalogu danych aplikacji.

Dla MVP priorytetem jest prostota, czytelność i łatwa edycja.
Jeśli wybierzesz JSON, wydziel osobne pliki:
- `variants.json`
- `index-mappings.json`
- `option-groups.json`
- `option-values.json`
- `rules.json`
- `saved-configurations.json`

10. Testy wymagane obowiązkowo
Dodaj minimum:
- test silnika reguł dla aktywacji pozycji;
- test wyliczenia wzoru długości;
- test grupowania podsumowania wg typu kabla;
- test braku mapowania `variant + index`;
- test scenariusza referencyjnego zgodnego z Excelem.

Scenariusz referencyjny:
- `wlk = BS-C-H-2`
- `konfiguracja = DB+Matka`
- `Nagrzewnica = Wodna`
- `Wentylator NW = 2 x GR25C 0,5 kW (0,78kW)`
- `Wentylator W = GR25C 0,5 kW (0,78kW)`
- `Przepustnica na Wyciągu = Na wlocie`
- `Recyrkulacja = Zamontować`
- `Presostat Filra = Zamontować`
- `Presostat Wymiennika = Zamontować`
- `Przetwornik ciśnienia went. = Zamontować`

Oczekiwane podsumowanie scenariusza referencyjnego:
- `2x1mm = 6.7925 m`
- `3x1,5mm = 3.78 m`
- `3x1mm = 10.495 m`
- `3x2mm = 4.655 m`
- `6x1mm = 3.78 m`

11. Kryteria akceptacji MVP
MVP uznaj za gotowe tylko wtedy, gdy:
- da się lokalnie uruchomić aplikację;
- da się wybrać konfigurację i policzyć wynik;
- da się zobaczyć logikę obliczenia dla pozycji;
- da się edytować dane bazowe;
- da się dodać nową konfigurację biznesową;
- da się dodać lub zmienić regułę bez dotykania kodu;
- scenariusz referencyjny przechodzi zgodnie z oczekiwanym podsumowaniem;
- w przypadku brakujących danych aplikacja zwraca ostrzeżenia zamiast błędnych liczb.

12. Oczekiwany rezultat pracy
Na końcu dostarcz:
- działający kod MVP;
- zainicjalizowane dane startowe;
- testy;
- krótkie README z instrukcją uruchomienia;
- sekcję `Do potwierdzenia`, jeśli znajdziesz luki albo niespójności w danych źródłowych.
```

## Uzupełnienia po weryfikacji folderu

Poniższe wymagania wynikają bezpośrednio z analizy Excela i powinny zostać potraktowane jako obowiązkowe uzupełnienie promptu MVP.

### Dodatkowe wymagania funkcjonalne

- aplikacja musi pozwalać na edycję wszystkich czynników wpływających na długość, nie tylko `indexMappings`, ale też parametrów pochodnych typu `B/2`, `B obsługa`, `H petra`, stałych wyjścia do elementu oraz zapasów `IN/OUT`;
- aplikacja musi pozwalać na zmianę typu kabla przypisanego do reguły bez zmiany kodu;
- aplikacja musi pozwalać na definiowanie nowych zależności wpływających na kabel i długość przewodu;
- aplikacja musi wspierać podgląd wpływu zmian na scenariusze referencyjne przed zapisaniem;
- aplikacja musi walidować spójność danych przed publikacją zmian.

### Korekta modelu domenowego

Obecny model `RuleRecord` jest zbyt uproszczony. W praktyce reguła musi wspierać:
- wiele warunków aktywacji, nie tylko jedno `groupCode`;
- składniki długości o różnych źródłach: `index`, wymiar wariantu, parametr pochodny, stała;
- możliwość budowania wzoru z komponentów zamiast wyłącznie ze stałych pól liczbowych;
- jawne mapowanie typu kabla jako element wyniku reguły.

Minimalne rozszerzenie modelu:
- `lengthDrivers[]`
  - `id`
  - `code`
  - `label`
  - `unit`
  - `sourceType` (`constant`, `variant-dimension`, `derived-parameter`, `index-distance`)
  - `valueOrExpression`
  - `isEditable`
- `ruleConditions[]`
  - `field`
  - `operator`
  - `values[]`
- `ruleLengthComponents[]`
  - `driverCode`
  - `sign`
  - `notes`

### Dodatkowe ograniczenia danych źródłowych

- `Tabela_główna` zawiera tylko wariant `BS-C-H-2`, więc dla innych `wlk` dane są niepełne biznesowo;
- tabela `Index` ma duplikaty dla `BS-C-H-3` (`AR`, `AB`) oraz braki dla `BS-C-H-4`, `BS-C-H-6`, `BS-C-H-7`;
- w regułach występują dodatkowe grupy `Złączki wlot nawiewu` i `Złączki wylot nawiewu`, które trzeba jawnie zamodelować albo formalnie wykluczyć z zakresu;
- słownik `Typ_kabla` w Excelu jest pusty i wymaga uzupełnienia podczas migracji danych;
- istnieje niespójność słownikowa `2 x GR25C ...` vs `2xGR25C ...`, więc import musi zawierać warstwę walidacji i normalizacji.

### Dodatkowe kryteria akceptacji MVP

- da się edytować czynniki wpływające na długość bez zmiany kodu;
- da się zmienić typ kabla w regule bez zmiany kodu;
- da się dodać nową zależność wpływającą na wynik długości;
- aplikacja blokuje zapis paczki danych, jeśli wykryje duplikaty, brakujące mapowania albo odwołanie do nieistniejącego słownika;
- aplikacja pokazuje ostrzeżenia o jakości danych przed wykonaniem obliczeń i przy zapisie zmian.
