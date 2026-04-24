import { useState, useMemo } from "react";
import { Tag, InputGroup, Input, SelectPicker, Button, IconButton } from "rsuite";
import { capitalizeFirstLetter } from "../../utils/utils";
import { Car, Search, SearchCheck, SortAsc, SortDesc, Tags, X } from "lucide-react";
import Trans from "../../localization/Trans";
import { registerTranslations, useLocale } from "../../localization/LocaleContext";

registerTranslations("ua", {
  "No data provided": "Дані відсутні",
  "Price: Low to High": "Ціна: від низької до високої",
  "Price: High to Low": "Ціна: від високої до низької",
  "Name: A to Z": "Назва: А до Я",
  "Name: Z to A": "Назва: Я до А",
  "Euro Class": "Євро Клас",
  "SUV First": "Позашляховики спочатку",
  "Body Type": "Тип кузова",
  Class: "Клас",
  Search: "Пошук",
  "Estimated price": "Орієнтовна ціна",
  Clear: "Очистити",
  "Models Found": "Знайдено моделей",
  "Filtered Models": "Відфільтровані моделі",
  "Total Models": "Всього моделей",
  "SUV Models": "Моделі позашляховиків",
  "Avg. Price": "Середня ціна",
  Total: "Всього",
  Filtered: "Відфільтровано",
  "Search by model name...": "Пошук за назвою моделі...",
  "Vehicle Catalog for": "Каталог автомобілів для",
  "Euro Classifications": "Класифікації Євро",
  "Body Types": "Типи кузовів",
  SUV: "Позашляховик",
  "Sort by": "Сортувати за",
  "No models found": "Моделей не знайдено",
  "Clear Search": "Очистити пошук",
  "Try adjusting your search term or clearing the search to see all models.":
    "Спробуйте змінити пошуковий запит або очистіть його, щоб побачити всі моделі.",
});

const CLASS_COLORS = {
  A: "green", B: "blue", C: "cyan", D: "yellow",
  E: "violet", "SUV 1": "orange", "SUV 2": "red", "SUV MAX": "red",
};

const SORT_ICONS = {
  "price-asc": <SortAsc size={14} />,
  "price-desc": <SortDesc size={14} />,
  "name-asc": <SortAsc size={14} />,
  "name-desc": <SortDesc size={14} />,
  class: <Tags size={14} />,
  "suv-first": <Car size={14} />,
};

const CLASS_ORDER = { A: 1, B: 2, C: 3, E: 4, "SUV 1": 5, "SUV 2": 6, "SUV MAX": 7 };

const formatPrice = (price) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(price);

const CarDataDisplay = ({ data, make }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState("price-asc");
  const { str } = useLocale();

  const sortOptions = [
    { label: str("Price: Low to High"), value: "price-asc" },
    { label: str("Price: High to Low"), value: "price-desc" },
    { label: str("Name: A to Z"),       value: "name-asc" },
    { label: str("Name: Z to A"),       value: "name-desc" },
    { label: str("Euro Class"),         value: "class" },
    { label: str("SUV First"),          value: "suv-first" },
  ];

  const filteredAndSortedData = useMemo(() => {
    let entries = Object.entries(data || {});
    if (searchTerm.trim()) {
      entries = entries.filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    entries.sort(([nameA, carA], [nameB, carB]) => {
      switch (sortMode) {
        case "price-asc":  return carA.estimated_price - carB.estimated_price;
        case "price-desc": return carB.estimated_price - carA.estimated_price;
        case "name-asc":   return nameA.localeCompare(nameB);
        case "name-desc":  return nameB.localeCompare(nameA);
        case "class":      return (CLASS_ORDER[carA.euro_class] || 99) - (CLASS_ORDER[carB.euro_class] || 99);
        case "suv-first":
          if (carA.is_suv && !carB.is_suv) return -1;
          if (!carA.is_suv && carB.is_suv) return 1;
          return carA.estimated_price - carB.estimated_price;
        default: return 0;
      }
    });
    return entries;
  }, [data, searchTerm, sortMode]);

  if (!data || typeof data !== "object") {
    return <div><Trans>No data provided</Trans></div>;
  }

  const avgPrice = filteredAndSortedData.length
    ? Math.round(filteredAndSortedData.reduce((s, [, c]) => s + c.estimated_price, 0) / filteredAndSortedData.length)
    : 0;

  return (
    <div>
      {/* Make heading */}
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>
        <Trans>Vehicle Catalog for</Trans>{" "}
        <span style={{ color: "#ea580c" }}>{capitalizeFirstLetter(make)}</span>
      </h2>

      {/* Controls */}
      <div className="car-data-controls">
        <div className="car-data-search">
          <InputGroup inside>
            <Input
              placeholder={str("Search by model name...")}
              value={searchTerm}
              onChange={setSearchTerm}
            />
            <InputGroup.Addon>
              {searchTerm
                ? <IconButton icon={<X size={14} />} onClick={() => setSearchTerm("")} />
                : <IconButton icon={<Search size={14} />} />
              }
            </InputGroup.Addon>
          </InputGroup>
        </div>

        <div className="car-data-sort">
          <span className="car-data-sort-label"><Trans>Sort by</Trans>:</span>
          <SelectPicker
            data={sortOptions}
            value={sortMode}
            onChange={setSortMode}
            cleanable={false}
            searchable={false}
            style={{ width: 190 }}
            renderValue={(v) => (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {SORT_ICONS[v]}
                {sortOptions.find((o) => o.value === v)?.label}
              </span>
            )}
          />
        </div>

        <div className="car-data-count">
          <Trans>Total</Trans>: <strong>{filteredAndSortedData.length}</strong>
        </div>
      </div>

      {/* Model rows */}
      {filteredAndSortedData.length === 0 ? (
        <div className="car-empty-state">
          <SearchCheck className="car-empty-state-icon" />
          <h4><Trans>No models found</Trans></h4>
          <p><Trans>Try adjusting your search term or clearing the search to see all models.</Trans></p>
          {searchTerm && (
            <Button appearance="primary" size="sm" onClick={() => setSearchTerm("")} style={{ marginTop: 8 }}>
              <Trans>Clear Search</Trans>
            </Button>
          )}
        </div>
      ) : (
        <div className="car-model-list">
          {filteredAndSortedData.map(([modelName, carData]) => (
            <div key={modelName} className="car-model-row">
              <div className="car-model-name">
                {modelName}
                {carData.is_suv && <span className="car-suv-badge">SUV</span>}
              </div>

              <div className="car-model-sep" />

              <div className="car-model-field">
                <span className="car-model-field-label"><Trans>Estimated price</Trans></span>
                <span className="car-model-price">{formatPrice(carData.estimated_price)}</span>
              </div>

              <div className="car-model-sep" />

              <div className="car-model-field">
                <span className="car-model-field-label"><Trans>Class</Trans></span>
                <Tag color={CLASS_COLORS[carData.euro_class] || "gray"} size="sm" style={{ fontWeight: 600 }}>
                  {carData.euro_class}
                </Tag>
              </div>

              <div className="car-model-sep" />

              <div className="car-model-field" style={{ flex: 1, minWidth: 140 }}>
                <span className="car-model-field-label"><Trans>Body Types</Trans></span>
                <div className="car-model-tags">
                  {carData.body.map((b, i) => (
                    <Tag key={i} color="blue" size="sm" style={{ textTransform: "capitalize", fontSize: "0.7rem" }}>{b}</Tag>
                  ))}
                </div>
              </div>

              <div className="car-model-sep" />

              <div className="car-model-field" style={{ flex: 1, minWidth: 140 }}>
                <span className="car-model-field-label"><Trans>Euro Classifications</Trans></span>
                <div className="car-model-tags">
                  {carData.euro_body_types.map((e, i) => (
                    <Tag key={i} color="cyan" size="sm" style={{ textTransform: "capitalize", fontSize: "0.7rem" }}>{e}</Tag>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats bar */}
      {filteredAndSortedData.length > 0 && (
        <div className="car-stats-bar">
          <div className="car-stat">
            <div className="car-stat-value blue">{filteredAndSortedData.length}</div>
            <div className="car-stat-label">
              <Trans>{searchTerm ? "Filtered" : "Total"} Models</Trans>
            </div>
          </div>
          <div className="car-stat-sep" />
          <div className="car-stat">
            <div className="car-stat-value accent">
              {filteredAndSortedData.filter(([, c]) => c.is_suv).length}
            </div>
            <div className="car-stat-label"><Trans>SUV Models</Trans></div>
          </div>
          <div className="car-stat-sep" />
          <div className="car-stat">
            <div className="car-stat-value green">{formatPrice(avgPrice)}</div>
            <div className="car-stat-label"><Trans>Avg. Price</Trans></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarDataDisplay;
