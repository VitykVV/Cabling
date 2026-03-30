# Decyzje biznesowe do zatwierdzenia

Stan na: `2026-03-27`

Cel: ta lista ma umożliwić rozpoczęcie implementacji bez domyślania się kluczowych założeń biznesowych.

## Decyzje z rekomendacją

1. Forma produktu
- Rekomendacja: `lokalna aplikacja webowa single-user`, uruchamiana na jednym stanowisku, z lokalną bazą `SQLite`.
- Uzasadnienie: najmniejsza złożoność wdrożenia, łatwa edycja danych, brak kosztu infrastruktury.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

2. Tryb wdrożenia
- Rekomendacja: `MVP bez wieloużytkownikowości i bez synchronizacji sieciowej`.
- Uzasadnienie: obecny materiał źródłowy nie definiuje ról, uprawnień ani procesu współdzielenia danych.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

3. Zakres dokumentu wynikowego
- Rekomendacja: w MVP generować:
  - tabelę pozycji przewodów;
  - podsumowanie metrów wg typu kabla;
  - sekcję ostrzeżeń danych;
  - eksport `PDF`;
  - eksport `XLSX`.
- Poza MVP zostawić:
  - pełny `BOM`;
  - etykiety;
  - marszruty produkcyjne;
  - kalkulację kosztów.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

4. Model edycji zależności wpływających na długość
- Rekomendacja: `kreator nazwanych składników długości`, a nie dowolne formuły tekstowe wpisywane ręcznie.
- Przykłady składników: `indexDistance`, `B_half`, `B_service`, `H_petra`, `exitConstant`, `slackIn`, `slackOut`.
- Uzasadnienie: bezpieczniejsze, prostsze do walidacji i audytu niż pełny mini-język formuł.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

5. Zmiana typu kabla
- Rekomendacja: `typ kabla jest wynikiem reguły i polem edytowalnym w danych`, bez wpływu na koszt i bez dodatkowej walidacji elektrycznej w MVP.
- Uzasadnienie: dokładnie odpowiada obecnemu Excelowi i nie rozszerza niepotrzebnie zakresu.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

6. Status grup `Złączki wlot nawiewu` i `Złączki wylot nawiewu`
- Rekomendacja: traktować je jako `wewnętrzne grupy reguł`, widoczne w ekranie `Reguły` i `Dane bazowe`, ale nie jako główne pola na ekranie konfiguratora.
- Uzasadnienie: w Excelu występują jako logika pomocnicza zależna od konfiguracji, a nie jako osobny wybór użytkownika.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

7. Polityka jednostek i prezentacji wyniku
- Rekomendacja:
  - zapis danych źródłowych i obliczeń w `mm`;
  - wynik logiczny przechowywany w `mm` i `m`;
  - raport użytkownika pokazuje `m` z dokładnością do `4` miejsc po przecinku;
  - widok tabeli może pokazywać także wartość zaokrągloną użytkową.
- Uzasadnienie: źródło Excel zawiera dokładniejsze wartości niż widok drukowany.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

8. Walidacja danych przed zapisem
- Rekomendacja: `blokować zapis` przy błędach krytycznych i `dopuszczać zapis` przy ostrzeżeniach niekrytycznych.
- Błędy krytyczne:
  - duplikat klucza `variant + index`;
  - odwołanie reguły do nieistniejącej wartości słownikowej;
  - nieznany typ kabla;
  - brak wymaganego składnika długości.
- Ostrzeżenia:
  - brak typu kabla dla pozycji technicznej niewchodzącej do podsumowania;
  - brak pełnego pokrycia wariantów poza scenariuszem referencyjnym.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

9. Właściciel danych i zatwierdzanie zmian
- Rekomendacja: `jeden właściciel danych biznesowych` dla MVP, bez workflow akceptacji w aplikacji.
- Uzasadnienie: brak zdefiniowanego procesu organizacyjnego, więc workflow wieloetapowy tylko spowolni projekt.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

10. Warunek wejścia do wdrożenia produkcyjnego
- Rekomendacja: nie wypuszczać aplikacji jako produkcyjnej, dopóki nie będą zatwierdzone co najmniej `3` scenariusze referencyjne, w tym co najmniej `1` poza `BS-C-H-2`.
- Status domyślny do specyfikacji GO: `przyjęte założenie`.

## Decyzje, które nadal wymagają realnego potwierdzenia biznesowego

Te punkty zostały przyjęte roboczo w specyfikacji GO, ale powinny zostać potwierdzone przed wdrożeniem:

- czy wynik końcowy ma zawierać tylko długości, czy także dokumenty produkcyjne wyższego poziomu;
- czy w przyszłości aplikacja ma działać wieloużytkownikowo;
- czy typ kabla ma w kolejnej fazie wpływać na koszt, magazyn lub dobór osprzętu;
- czy dopuszczalne są własne formuły tekstowe użytkownika, czy tylko kreator zależności;
- kto formalnie zatwierdza czyszczenie danych `Index` i uzupełnienie słownika `Typ_kabla`.

## Rekomendacja operacyjna

Jeśli nie ma sprzeciwu do powyższych założeń, można przejść do implementacji `MVP foundation` według specyfikacji GO, ale nadal nie wolno oznaczać projektu jako gotowego do wdrożenia produkcyjnego.
