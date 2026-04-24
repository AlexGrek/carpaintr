import { lazy, Suspense, useState } from "react";
import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Loader } from "rsuite";
import ErrorBoundary from "../../ErrorBoundary";
import { registerTranslations } from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";
import { Car, Code2, Layers, Database } from "lucide-react";
import "./CatalogPage.css";

registerTranslations("ua", {
  Cars: "Автомобілі",
  Parts: "Запчастини",
  Data: "Дані",
  Catalog: "Каталог",
  Processors: "Процесори",
});

const PartsCatalog = lazy(() => import("../catalog/PartsCatalog"));
const CarCatalog = lazy(() => import("../catalog/CarCatalog"));
const ProcessorsCatalog = lazy(() => import("../catalog/ProcessorsCatalog"));

const TABS = [
  { key: "tab1", label: "Cars",       icon: Car },
  { key: "tab2", label: "Parts",      icon: Layers },
  { key: "tab3", label: "Processors", icon: Code2 },
  { key: "tab4", label: "Data",       icon: Database },
];

const CatalogPage = () => {
  useDocumentTitle("Document title: Catalog");
  const [activeKey, setActiveKey] = useState("tab1");
  const [loadedTabs, setLoadedTabs] = useState(new Set(["tab1"]));

  const handleSelect = (key) => {
    setActiveKey(key);
    setLoadedTabs((prev) => new Set([...prev, key]));
  };

  const renderContent = () => {
    if (!loadedTabs.has(activeKey)) return null;
    switch (activeKey) {
      case "tab1":
        return (
          <ErrorBoundary>
            <Suspense fallback={<Loader center content="Loading..." />}>
              <CarCatalog />
            </Suspense>
          </ErrorBoundary>
        );
      case "tab2":
        return (
          <ErrorBoundary>
            <Suspense fallback={<Loader center content="Loading..." />}>
              <PartsCatalog />
            </Suspense>
          </ErrorBoundary>
        );
      case "tab3":
        return (
          <ErrorBoundary>
            <Suspense fallback={<Loader center content="Loading..." />}>
              <ProcessorsCatalog />
            </Suspense>
          </ErrorBoundary>
        );
      case "tab4":
        return <Suspense fallback={<Loader />}></Suspense>;
      default:
        return null;
    }
  };

  return (
    <div className="catalog-page">
      <TopBarUser />
      <div className="catalog-body">
        <div className="catalog-hero">
          <h1 className="catalog-hero-title"><Trans>Catalog</Trans></h1>
          <div className="catalog-tabs" role="tablist">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeKey === key}
                className={`catalog-tab-btn${activeKey === key ? " active" : ""}`}
                onClick={() => handleSelect(key)}
              >
                <Icon size={15} aria-hidden />
                <Trans>{label}</Trans>
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-card fade-in-simple">
          <div className="catalog-tab-content">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
