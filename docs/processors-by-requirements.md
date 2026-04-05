# Processors: Implementation Status by Algorithm Block

Source document: `~/Downloads/ОПИСАНИЕ АЛГОРИТМА.docx`

Processors live in `backend-service-rust/data/common/procs/`.

---

## Implemented Processors

### Block 3 — Зняти/Встановити для ремонту
**File:** `СНЯТИЕ_УСТАНОВКА_ДЛЯ_РЕМОНТА.js`  
**Repair types:** Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони, Ремонт без фарбування, Розтонування фарби  
**Table:** `Арматурные работы` → columns `СНЯТИЕ ДЛЯ РЕМОНТА`, `УСТАНОВКА ДЛЯ РЕМОНТА`  
**Rows:** Зняти «деталь» для ремонту / Встановити «деталь» після ремонту  
**orderingNum:** 100

---

### Block 4 — Розібрати/Зібрати для ремонту
**File:** `Роботи_арматурні_зібрати_для_ремонту_.js`  
**Repair types:** Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони, Ремонт без фарбування, Розтонування фарби  
**Table:** `Арматурные работы` → columns `РАЗОБРАТЬ ДЛЯ РЕМОНТА`, `СОБРАТЬ ДЛЯ РЕМОНТА`  
**Rows:** Розібрати «деталь» для ремонту / Зібрати «деталь» після ремонту  
**orderingNum:** 200

---

### Block 5 — Розібрати/Зібрати для заміни
**File:** `Розібрати_зібрати_для_заміни.js`  
**Repair types:** Заміна оригінал деталь з фарбуванням, Заміна Не оригінал деталь з фарбуванням, Заміна без фарбування  
**Table:** `Арматурные работы` → columns `РАЗОБРАТЬ ДЛЯ ЗАМЕНЫ`, `СОБРАТЬ ДЛЯ ЗАМЕНЫ`  
**Rows:** Розібрати «деталь» для заміни / Зібрати «деталь» після заміни  
**orderingNum:** 300

---

### Block 6 — Зняти/Встановити для заміни
**File:** `РАБОТЫ_АРМАТУРНЫЕ.js`  
**Repair types:** Заміна оригінал деталь з фарбуванням, Заміна Не оригінал деталь з фарбуванням, Заміна без фарбування  
**Table:** `Арматурные работы` → columns `СНЯТИЕ ДЛЯ ЗАМЕНЫ`, `УСТАНОВКА ДЛЯ ЗАМЕНЫ`  
**Rows:** Зняти «деталь» для заміни / Встановити «деталь» після заміни  
**orderingNum:** 400

---

### Block 7 — Демонтаж/Монтаж для заміни
**File:** `ДЕМОНТАЖ_МОНТАЖ_ДЛЯ_ЗАМЕНЫ.js`  
**Repair types:** Заміна оригінал деталь з фарбуванням, Заміна Не оригінал деталь з фарбуванням, Заміна без фарбування  
**Table:** `Работы рихтовочніе демонтаж монтаж` → columns `МЕТАЛЛ`, `АЛЮМИНИЙ`  
**Rows:** Демонтаж/Монтаж, Зварювання «деталь» (метал) / (алюміній)  
**orderingNum:** 500  
**TODO:** Branch by material type (метал/алюміній) — currently outputs both rows. Requires material param in processor API.

---

### Block 8 — Регулювання зазорів
**File:** `РЕГУЛЮВАННЯ_ЗАЗОРІВ.js`  
**Repair types:** Заміна оригінал, Заміна Не оригінал, Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони, Ремонт без фарбування  
**Table:** `Работы регулировка зазоров`  
**Column selection (by repairAction):**
- Заміна оригінал → `Зазори Заміна оригінал деталь`
- Заміна Не оригінал → `Зазри Заміна Неоригінал деталь`
- Ремонт → `Зазори ремонт`

**orderingNum:** 600

---

### Block 9 — Обробка зварювальних швів
**File:** `ОБРОБКА_ЗВАРЮВАЛЬНИХ_ШВІВ.js`  
**Repair types:** Заміна оригінал деталь з фарбуванням, Заміна Не оригінал деталь з фарбуванням  
**Table:** `Обробка зварювальних швів` → columns `н.г. обробка оловом`, `н.г. обробка епоксидною шпаклівкою`  
**Rows:** Обробка оловом / Обробка епоксидною шпаклівкою  
**orderingNum:** 700

---

### Block 10 — Обробка герметиком
**File:** `ОБРОБКА_ГЕРМЕТИКОМ.js`  
**Repair types:** Заміна оригінал деталь з фарбуванням, Заміна Не оригінал деталь з фарбуванням  
**Table:** `Обробка герметиком` → column `н.г. обробка герметиком`  
**orderingNum:** 800

---

### Block 12 — Рихтування
**File:** `РИХТУВАННЯ.js`  
**Repair types:** Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони, Ремонт без фарбування  
**Table:** `нормы ремонта на 1 квадрат` → columns `рихтовка металл`, `рихтовка алюминий`, `ремонт пластик`, `рихтовка інше`  
**Formula:** `sum(норма * к-сть квадратів по типу деформації) + константа добавочная рихтовка`  
**orderingNum:** 1200  
**TODO:** Multiply per-square norm by actual grid square count per deformation type. Requires grid data in processor API. Branch by material — currently outputs all 4 material rows.

---

### Block 13 — Шпаклювання
**File:** `ШПАКЛЮВАННЯ.js`  
**Repair types:** Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони  
**Table:** `нормы ремонта на 1 квадрат` → column `шпаклювання`  
**Formula:** `sum(норма шпаклювання * к-сть квадратів) + константа добавочная шпаклевание`  
**orderingNum:** 1300  
**TODO:** Multiply by grid square count once grid data is available.

---

### Block 14 — Видалення ЛКП
**File:** `ВИДАЛЕННЯ_ЛКП.js`  
**Repair types:** Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони  
**Table:** `удаление поврежденной краски` → column named by rounded % (`"10"`, `"20"`, `"25"`, `"30"`, `"50"`, `"75"`, `"100"`)  
**Formula:**  
```
% = (квадрати ремонту + квадрати ушкодження фарби поза зоною) / всього квадратів × 100
Rounded %: ≤10→10, ≤20→20, ≤25→25, ≤30→30, ≤50→50, ≤75→75, else→100
```
**orderingNum:** 1400  
**TODO:** Replace placeholder `damagePercent = 50` with actual grid paint damage calculation once grid data is available.

---

### Грунтування після рихтовки
**File:** `ГРУНТУВАННЯ.js`  
**Repair types:** Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони  
**Table:** `Нормы материалов и работ для покраски` → columns `н.г грунтування первинне`, `н.г грунтування порозаповнювачем`, `н.г шліфування для фарбування`  
**Rows:** Грунтування первинне / Грунтування порозаповнювачем / Шліфування для фарбування  
**orderingNum:** 1500  
**TODO:** Skip if grid damage % == 0. Branch Грунтування первинне by material (метал/алюміній/пластик).

---

### Фарбування
**File:** `ФАРБУВАННЯ.js`  
**Repair types:** Заміна оригінал, Заміна Не оригінал, Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони, Розтонування фарби  
**Table:** `Нормы материалов и работ для покраски`  
**Conditional rows:**

| Condition | Row added |
|-----------|-----------|
| isReplacement | Грунтування первинне (column `н.ч. грунтование первичное`) |
| isBrightColor OR isThreeLayer OR isHighQuality | Грунтування в тон фарби (column `н.ч. грунтование в цвет`) |
| always | Фарбування (column `н.ч. покраска`) |
| always | Фарба 1 шар (column `расход л. краски1`) |
| always | Фарба 2 шар (column `расход л. краски2`) |
| always | Лак (column `расхода л. Лак`) |
| NOT needsPrimer AND NOT isReplacement | Грунт аерозольний (column `грунт аерозольний`) |

**Quality detection:** `pricing.quality` containing `"офіційного СТО"` / `"Офіційне СТО"` = high quality  
**Bright color detection:** `paint.toLowerCase().includes("яскрав")`  
**3-layer detection:** `pricing.paintType.includes("3шарове")`  
**orderingNum:** 1600  
**TODO:** Restrict Грунтування первинне to знімна деталь only — requires removability in processor API.

---

### Полірування після фарбування
**File:** `ПОЛІРУВАННЯ_ПІСЛЯ_ФАРБУВАННЯ.js`  
**Repair types:** Заміна оригінал, Заміна Не оригінал, Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони  
**Table:** `Таблица 1` → column `н.ч. полировка после покраски`  
**shouldRun:** only if table value ≠ 0 AND quality contains `"полірування"` / `"офіційного СТО"` / `"Офіційне СТО"`  
**orderingNum:** 1700

---

### Полірування (самостійний вид ремонту)
**File:** `ПОЛІРУВАННЯ.js`  
**Repair types:** Полірування  
**Table:** `Таблица 1` → column `н.ч. полировка`  
**orderingNum:** 1750

---

### Антикорозійна обробка після заміни (висока якість)
**File:** `АНТИКОРОЗІЯ_ПІСЛЯ_ЗАМІНИ.js`  
**Repair types:** Заміна оригінал деталь з фарбуванням, Заміна Не оригінал деталь з фарбуванням  
**Table:** `Таблица 1` → column `н.ч. антикор`  
**shouldRun:** only if quality = Наближена до офіційного СТО / Офіційне СТО  
**orderingNum:** 1810  
**TODO:** Restrict to металеві деталі once material param is available.

---

### Антикорозійна обробка зварювання після ремонту (розрив)
**File:** `АНТИКОРОЗІЯ_ПІСЛЯ_РЕМОНТУ.js`  
**Repair types:** Ремонт з зовнішнім фарбуванням, Ремонт з фарбуваням 2 сторони  
**Value:** константа 0.3 н.г.  
**orderingNum:** 1820  
**TODO:** Restrict to метал + grid "Розрив" deformation once both are available in processor API.

---

### Антикорозійна обробка несъемних деталей при заміні (стандартна якість)
**File:** `АНТИКОРОЗІЯ_НЕСЪЕМНИХ.js`  
**Repair types:** Заміна оригінал деталь з фарбуванням, Заміна Не оригінал деталь з фарбуванням  
**Value:** константа 0.4 н.г.  
**shouldRun:** only if quality is NOT Наближена до офіційного СТО / Офіційне СТО  
**orderingNum:** 1830  
**TODO:** Restrict to несъемні деталі once removability is available in processor API.

---

## Not Yet Implemented

### Загальні роботи (once per calculation, not per part)
- Мийка автомобіля
- Маскування для фарбування
- Мийка фарбувального обладнання
- Підбір фарби (for painting repair types — from table indexed by paint type)
- Перевірка обтяжки колес
- Регулювання світла фар (for bumper replacement)
- Вартість сушки
- Materials: плівка маскувальна, стрічка малярна, воронки фільтри, розчинник промивочний, папір, валики

These are per-calculation (not per-part) operations. The current processor API runs per selected part, so these require either a dedicated "general" part in the UI or a mechanism to run a processor once per calculation.

---

## Pending API Extensions

The following processor features require changes to the processor API signature before they can be fully implemented:

| Feature | Affected processors | Required change |
|---------|---------------------|-----------------|
| Material type (метал/алюміній/пластик/інше) | РИХТУВАННЯ, ДЕМОНТАЖ_МОНТАЖ, ГРУНТУВАННЯ, АНТИКОРОЗІЯ_ПІСЛЯ_ЗАМІНИ | Add `material` param to `run()`/`shouldRun()` |
| Grid square counts by deformation type | РИХТУВАННЯ, ШПАКЛЮВАННЯ, ВИДАЛЕННЯ_ЛКП, ГРУНТУВАННЯ | Add `gridData` param (squares per deformation level) |
| Grid paint damage % | ВИДАЛЕННЯ_ЛКП | Add `paintDamageSquares` count |
| Part removability (знімна/несъемна) | ФАРБУВАННЯ, АНТИКОРОЗІЯ_НЕСЪЕМНИХ | Add `removable: bool` to `carPart` |
| Grid "Розрив" deformation present | АНТИКОРОЗІЯ_ПІСЛЯ_РЕМОНТУ | Add `gridData` with deformation type flags |
