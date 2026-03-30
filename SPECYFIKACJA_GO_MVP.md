# Specyfikacja GO dla MVP

Stan na: `2026-03-27`
Status: `CONDITIONAL GO`

Interpretacja statusu:
- `GO` dla rozpoczęcia implementacji fundamentu aplikacji;
- `NO-GO` dla wdrożenia produkcyjnego, dopóki dane źródłowe nie zostaną oczyszczone i potwierdzone.

## Cel produktu

Aplikacja ma zastąpić skoroszyt Excel używany do wyliczania długości przewodów wiązki kablowej dla central `BS-C` i generować czytelny dokument wynikowy na podstawie konfiguracji wybranej przez użytkownika.

## Założenia przyjęte do startu implementacji

Przyjęto założenia z dokumentu `DECYZJE_BIZNESOWE_DO_ZATWIERDZENIA.md`:
- aplikacja lokalna, webowa, single-user;
- lokalna baza `SQLite`;
- eksport `PDF` i `XLSX` w MVP;
- brak wieloużytkownikowości i workflow akceptacji w MVP;
- edycja zależności przez kreator składników długości, bez pełnego języka formuł;
- typ kabla wpływa na raport i grupowanie, ale nie na koszt i nie na walidację elektryczną w MVP;
- `Złączki ...` są wewnętrznymi grupami reguł.

## Zakres MVP

### W zakresie

1. Konfigurator
- wybór `wlk`;
- wybór `konfiguracja`;
- wybór `Nagrzewnica`;
- wybór `Wentylator NW`;
- wybór `Wentylator W`;
- wybór `Przepustnica na Wyciągu`;
- wybór `Recyrkulacja`;
- wybór `Presostat Filra`;
- wybór `Presostat Wymiennika`;
- wybór `Przetwornik ciśnienia went.`;
- zapis konfiguracji pod nazwą;
- duplikacja i usuwanie konfiguracji.

2. Wynik obliczeń
- lista aktywnych pozycji przewodów;
- podsumowanie metrów wg typu kabla;
- pełna logika obliczeń dla każdego wiersza;
- sekcja `Problemy danych` i `Do potwierdzenia`;
- eksport `PDF` i `XLSX`.

3. Dane bazowe
- edycja wariantów `wlk`;
- edycja wymiarów `L/B/H`;
- edycja mapowań `index -> mm`;
- edycja parametrów pochodnych długości;
- edycja słowników opcji;
- edycja typów kabli.

4. Reguły
- lista reguł;
- tworzenie i edycja reguł;
- przypisywanie typu kabla do reguły;
- definiowanie warunków aktywacji;
- definiowanie składników długości;
- testowanie reguły na bieżącej konfiguracji;
- podgląd wpływu zmian przed zapisem.

5. Walidacja
- walidacja danych wejściowych przy imporcie i edycji;
- blokowanie zapisu przy błędach krytycznych;
- ostrzeganie o niepełnych lub podejrzanych danych.

### Poza zakresem MVP

- pełny `BOM` materiałowy;
- etykiety produkcyjne;
- kalkulacja kosztów;
- wieloużytkownikowość;
- zarządzanie uprawnieniami;
- synchronizacja sieciowa;
- integracje z ERP, PLM lub CAD;
- dowolny język formuł użytkownika.

## Rekomendowana architektura

### Stack

- `TypeScript`
- `React`
- `Vite`
- `Node.js`
- `SQLite`
- `Zod` do walidacji modeli i danych wejściowych
- `Vitest` do testów jednostkowych
- `Playwright` do krytycznego scenariusza end-to-end

### Moduły

- `src/app/` - shell aplikacji, routing, layout
- `src/features/configurator/` - konfigurator i zapis konfiguracji
- `src/features/results/` - wynik, podsumowania, eksport
- `src/features/reference-data/` - warianty, indeksy, słowniki, typy kabli, parametry długości
- `src/features/rules/` - CRUD reguł i testowanie reguł
- `src/domain/reference-data/` - modele referencyjne i walidacja
- `src/domain/rules/` - modele reguł i parser składników
- `src/domain/cable-calculation/` - silnik obliczeń
- `src/lib/persistence/` - repozytoria SQLite
- `src/lib/import/` - import i normalizacja danych z Excela
- `tests/` - testy domenowe i E2E

## Model domenowy

### ReferenceData

- `variants[]`
  - `id`
  - `code`
  - `lengthMm`
  - `widthMm`
  - `heightMm`
  - `isActive`
- `indexMappings[]`
  - `id`
  - `variantCode`
  - `indexCode`
  - `distanceMm`
- `lengthDrivers[]`
  - `id`
  - `code`
  - `label`
  - `unit`
  - `sourceType` (`constant`, `variant-dimension`, `derived-parameter`, `index-distance`)
  - `valueOrExpression`
  - `isEditable`
  - `isActive`
- `optionGroups[]`
  - `id`
  - `code`
  - `label`
  - `type`
  - `isVisibleInConfigurator`
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

### RuleRecord

- `id`
- `element`
- `description`
- `showInReport`
- `variantCodes[]`
- `conditions[]`
  - `field`
  - `operator`
  - `values[]`
- `lengthComponents[]`
  - `driverCode`
  - `operation` (`add`)
- `cableTypeCode`
- `notes`
- `isActive`

### SavedConfiguration

- `id`
- `name`
- `selections`
- `createdAt`
- `updatedAt`

### CalculationRow

- `lp`
- `element`
- `wlk`
- `cableType`
- `indexCode`
- `distanceFromPanelMm`
- `resolvedComponents[]`
- `sumMm`
- `sumM`
- `activatedBy`
- `explanation`
- `warnings[]`

## Zasady działania silnika

### Aktywacja reguły

- reguła jest aktywna, gdy wszystkie jej warunki są spełnione;
- warunki mogą dotyczyć zarówno grup widocznych w konfiguratorze, jak i grup wewnętrznych;
- grupa `standard` jest zawsze aktywna;
- brakujące dane nie mogą być cicho ignorowane.

### Obliczanie długości

- każdy składnik długości jest rozwiązywany do wartości w `mm`;
- `index-distance` bierze wartość z `indexMappings` dla `variantCode + indexCode`;
- `variant-dimension` bierze wartość z `L`, `B` lub `H`;
- `derived-parameter` bierze wartość z nazwanego parametru, np. `B_half`;
- `constant` jest zapisaną wartością liczbową;
- `sumMm` jest sumą resolved components;
- `sumM = sumMm / 1000`.

### Wyjaśnialność

Dla każdego wiersza wynikowego system ma pokazać:
- które warunki aktywowały regułę;
- które warunki jej nie wykluczyły;
- jakie składniki weszły do wzoru;
- z jakich tabel pochodzi każda wartość;
- jaki jest wynik końcowy w `mm` i `m`.

## Walidacja i jakość danych

### Błędy krytyczne

- duplikat `variantCode + indexCode`;
- brak mapowania dla wymaganego indeksu;
- reguła odwołuje się do nieistniejącej wartości słownikowej;
- reguła wskazuje nieistniejący `lengthDriver`;
- reguła wskazuje nieistniejący typ kabla.

### Ostrzeżenia

- brak typu kabla dla pozycji technicznej niewchodzącej do podsumowania;
- niepełne pokrycie wariantów poza scenariuszem referencyjnym;
- dane zaimportowane z niespójnej wartości, którą system znormalizował.

### Normalizacja importu

Import z Excela ma umieć wykryć i oznaczyć co najmniej:
- `2 x GR25C 0,5 kW (0,78kW)` vs `2xGR25C 0,5 kW (0,78kW)`;
- puste słowniki techniczne;
- duplikaty w `Index`;
- warianty mające wymiary, ale bez pełnych mapowań.

## Ekrany aplikacji

### Konfigurator

- formularz wyboru konfiguracji;
- zapis i odczyt zapisanych konfiguracji;
- szybkie uruchomienie obliczeń.

### Wynik

- tabela pozycji;
- grupowanie wg typu kabla;
- rozwijane `Pokaż logikę`;
- ostrzeżenia danych;
- eksport dokumentów.

### Dane bazowe

- warianty `wlk`;
- mapowania `index`;
- parametry długości;
- słowniki opcji;
- typy kabli.

### Reguły

- lista reguł;
- warunki aktywacji;
- składniki długości;
- przypisanie typu kabla;
- test reguły na żywo.

## Migracja danych z Excela

### Źródła potwierdzone

- `Tabela_główna`
- `Index`
- `Konfigoracja`
- `Nagrzewnica`
- `Wentylator`
- `Przepustnica_wyciąg`
- `brak`
- zakres `AN2:AP9` dla `L/B/H`
- `obliczenia_B`
- `obliczenia_H`

### Ograniczenia znane na starcie

- pełna logika reguł jest potwierdzona tylko dla `BS-C-H-2`;
- `BS-C-H-6` i `BS-C-H-7` nie mają mapowań `Index`;
- `BS-C-H-4` ma niepełne mapowanie `Index`;
- `BS-C-H-3` zawiera duplikaty mapowań;
- słownik `Typ_kabla` wymaga uzupełnienia ręcznego lub kontrolowanego importu.

## Testy obowiązkowe

1. Test aktywacji reguły.
2. Test sumowania składników długości.
3. Test rozwiązywania `index-distance`.
4. Test rozwiązywania parametru pochodnego.
5. Test grupowania wyników wg typu kabla.
6. Test błędu dla brakującego `variant + index`.
7. Test wykrycia duplikatu `variant + index`.
8. Test scenariusza referencyjnego `BS-C-H-2` zgodnego z Excelem.
9. Test importu i normalizacji niespójnej wartości wentylatora.
10. Test E2E: użytkownik zmienia czynnik długości i widzi zmianę wyniku przed zapisem.

## Kryteria wejścia do implementacji

Można rozpocząć implementację, jeśli:
- akceptujesz założenia z tej specyfikacji;
- zgadzasz się, że MVP jest lokalne i single-user;
- zgadzasz się na kreator składników długości zamiast dowolnych formuł;
- zgadzasz się, że dane produkcyjne zostaną jeszcze oczyszczone równolegle.

## Kryteria wyjścia z implementacji MVP

MVP można uznać za gotowe technicznie, gdy:
- aplikacja uruchamia się lokalnie;
- użytkownik może policzyć scenariusz referencyjny zgodny z Excelem;
- użytkownik może edytować czynniki wpływające na długość;
- użytkownik może zmienić typ kabla bez zmiany kodu;
- użytkownik może dodać nową zależność wpływającą na wynik;
- system pokazuje pełną logikę obliczeń;
- system blokuje zapis przy błędach krytycznych;
- eksport `PDF` i `XLSX` działa dla scenariusza referencyjnego.

## Kryteria wejścia do wdrożenia produkcyjnego

Wdrożenie produkcyjne pozostaje zablokowane do czasu:
- oczyszczenia tabeli `Index`;
- uzupełnienia słownika `Typ_kabla`;
- formalnego potwierdzenia statusu grup `Złączki ...`;
- zatwierdzenia co najmniej `3` scenariuszy referencyjnych;
- potwierdzenia polityki zaokrągleń i formatu dokumentu końcowego.
