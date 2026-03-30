# Weryfikacja gotowości projektu

Stan na: `2026-03-27`

## Decyzja

`NO-GO` dla startu pełnej implementacji produkcyjnej.

Masz wystarczająco dużo materiału, żeby:
- zamodelować domenę;
- przygotować migrację danych z Excela;
- doprecyzować prompt i architekturę MVP.

Nie masz jeszcze wystarczająco uporządkowanych danych i ustaleń, żeby bezpiecznie budować profesjonalną aplikację end-to-end bez ryzyka błędnych wyników.

## Co jest w folderze

- plik źródłowy: `B:\Cabling\BS-C Dlugosci przewodow2.xlsm`
- prompt techniczny MVP: `B:\Cabling\PROMPT_CODEX_MVP_TECHNICZNY.md`
- brak repozytorium `git`
- brak istniejącego kodu aplikacji

## Co zostało zweryfikowane w Excelu

- skoroszyt ma 2 arkusze: `lista_przewodów` i `Tabeli`
- tabela reguł to `Tabela_główna` i zawiera `58` wierszy
- scenariusz referencyjny z arkusza `lista_przewodów` zgadza się z promptem:
  - `2x1mm = 6.7925 m`
  - `3x1,5mm = 3.78 m`
  - `3x1mm = 10.495 m`
  - `3x2mm = 4.655 m`
  - `6x1mm = 3.78 m`
- wymiary `L/B/H` istnieją w skoroszycie, ale są zapisane poza tabelami, w zakresie `AN2:AP9`
- istnieją dodatkowe zależności długości:
  - `obliczenia_B`: m.in. `B/2`, `B obsługa`
  - `obliczenia_H`: m.in. `H petra`
- wzór długości nie opiera się wyłącznie na `index -> mm`; część pozycji korzysta z wyrażeń typu `B/2 + H petra + zapasy`

## Krytyczne braki i niespójności

1. Logika reguł jest potwierdzona tylko dla `BS-C-H-2`.
W `Tabela_główna` wszystkie wiersze mają `wlk = BS-C-H-2`, więc dla pozostałych wariantów masz wymiary i część mapowań, ale nie masz zweryfikowanych reguł biznesowych.

2. Tabela `Index` nie jest kompletna i nie jest czysta.
- `BS-C-H-6` i `BS-C-H-7` nie mają mapowania `Index`
- `BS-C-H-4` nie ma pozycji `AR` i `AB`
- `BS-C-H-3` ma duplikaty dla `AR` i `AB`

3. Masz niespójność słownika wentylatorów.
W słowniku jest `2 x GR25C 0,5 kW (0,78kW)`, a w jednej regule występuje `2xGR25C 0,5 kW (0,78kW)`.

4. Słownik typów kabli nie jest wypełniony.
Tabela `Typ_kabla` istnieje, ale jest pusta, mimo że reguły używają typów:
- `2x1mm`
- `3x1,5mm`
- `3x1mm`
- `3x2mm`
- `4x1,5mm`
- `4x2,5mm`
- `6x1mm`

5. Prompt nie obejmuje wszystkich grup biznesowych z Excela.
W źródle występują jeszcze:
- `Złączki wlot nawiewu`
- `Złączki wylot nawiewu`

6. Model reguły w promptcie jest zbyt uproszczony względem źródła.
Obecny model `RuleRecord` zakłada pojedynczy `groupCode`, jedną listę `allowedValues[]` i stałe pola liczbowe. To nie wystarcza do:
- zależności od wymiarów wariantu;
- zależności od parametrów pochodnych typu `B/2`, `B obsługa`, `H petra`;
- przyszłego dodawania nowych zależności wpływających na długość;
- kontroli zmian typu kabla bez duplikowania dużej liczby wierszy.

7. Nie ma formalnej polityki jednostek i zaokrągleń.
W Excelu część danych jest w `mm`, część w `m`, a arkusz wynikowy pokazuje wartości zaokrąglone, mimo że surowe sumy są dokładniejsze.

## Co trzeba dopisać do zakresu aplikacji

1. Edytor czynników długości.
Użytkownik musi móc zmieniać wszystkie składowe wpływające na długość:
- mapowanie `index -> mm`
- wymiary `L/B/H`
- parametry pochodne, np. `B/2`, `B obsługa`, `H petra`
- zapasy `IN` i `OUT`
- stałe wyjścia do elementu

2. Edytor zależności, nie tylko prostych reguł.
Reguła powinna obsługiwać wiele warunków i wiele składników obliczenia, np.:
- `jeśli konfiguracja in [...]`
- `jeśli wentylator = ...`
- `jeśli wariant = ...`
- `użyj składników: indexDistance + widthFactor + heightFactor + slackIn + slackOut`

3. Edytor typów kabli i mapowania typu kabla do reguły.
Zmiana typu kabla nie może wymagać edycji kodu ani ręcznego duplikowania rekordów.

4. Walidację danych źródłowych przed publikacją zmian.
Aplikacja powinna blokować publikację paczki danych, jeśli wykryje:
- duplikaty kluczy
- odwołanie do nieistniejącego słownika
- brak `indexMapping`
- nieznany typ kabla
- niespójne jednostki

5. Wersjonowanie i ślad zmian.
Profesjonalna aplikacja powinna pokazywać:
- kto zmienił regułę lub dane bazowe
- kiedy to zrobił
- jaki był wpływ zmiany na wynik scenariuszy referencyjnych

6. Dokument wyjściowy z rewizją.
Poza tabelą wyników warto przewidzieć:
- numer rewizji
- datę generacji
- nazwę konfiguracji
- ostrzeżenia danych
- eksport `PDF` i `Excel`

## Wnioski z podobnych rozwiązań w internecie

Stan źródeł: sprawdzone `2026-03-27`.

1. `RapidHarness`
Oficjalna strona podaje, że narzędzie automatycznie generuje dokumenty produkcyjne, takie jak `BOM`, `Wiring Tables`, `Cutlists`, etykiety i eksport do `PDF/Excel`, a także ma wbudowane wersjonowanie, `Rule Checker` i `Design Configurations`.
Źródło: [RapidHarness](https://rapidharness.com/)

2. `Siemens Capital Harness Designer`
Siemens opisuje narzędzie jako system do szczegółowych, walidowanych i gotowych do produkcji projektów wiązek, z automatycznym doborem materiałów i regułową integracją danych z wielu źródeł.
Źródło: [Siemens Capital Harness Designer](https://plm.sw.siemens.com/es-ES/capital/products/capital-wiring-harness-designer/)

3. `Zuken E3`
Zuken podkreśla zarządzanie wariantami i konfiguracjami modułowych wiązek oraz potrzebę wcześniejszego sprawdzania wariantów i zależności dla wielu konfiguracji produktu.
Źródło: [Zuken Automotive Engineering Solutions](https://www.zuken.com/en/solution/automotive/)

4. `Autodesk Inventor`
Dokumentacja Autodesk pokazuje, że długość wiązki w profesjonalnych narzędziach zwykle uwzględnia nie tylko długość bazową, ale także dodatkowe czynniki, takie jak `slack`, `round-up`, `embedded length` i `service loop`.
Źródło: [Autodesk Inventor - Harness length](https://help.autodesk.com/cloudhelp/2014/ENU/Inventor/files/GUID-A3AC3C83-52CB-4501-BF3F-48269199CEFD.htm)

## Minimalny zestaw brakujących decyzji przed startem implementacji

1. Czy aplikacja ma być lokalna desktopowa, lokalna webowa, czy wieloużytkownikowa?
2. Jaki dokładnie dokument ma być wynikiem: tylko tabela długości, czy też `BOM`, `cutlist`, etykiety i rewizja?
3. Czy grupy `Złączki ...` mają być jawnie widoczne w UI, czy traktowane jako reguły wewnętrzne?
4. Czy nowe zależności mają być definiowane jako:
- prosty kreator składników długości
- czy pełne wyrażenia/formuły?
5. Kto jest właścicielem danych bazowych i kto zatwierdza zmiany?
6. Czy dla wariantów innych niż `BS-C-H-2` masz zatwierdzone scenariusze referencyjne?
7. Czy zmiana typu kabla ma wpływać tylko na raport, czy też na dodatkowe reguły walidacyjne i dokument wyjściowy?

## Warunek startu prac

Rekomenduję rozpoczęcie implementacji dopiero po spełnieniu minimum:

- uzupełnienie i oczyszczenie danych `Index`
- uzgodnienie modelu zależności wpływających na długość
- uzupełnienie słownika typów kabli
- potwierdzenie statusu grup `Złączki ...`
- ustalenie formatu dokumentu końcowego
- przygotowanie co najmniej 2 dodatkowych scenariuszy referencyjnych poza `BS-C-H-2`
