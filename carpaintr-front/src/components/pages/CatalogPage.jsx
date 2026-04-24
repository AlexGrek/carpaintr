import { lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopBarUser from "../layout/TopBarUser";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Loader } from "rsuite";
import ErrorBoundary from "../../ErrorBoundary";
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
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
  { slug: "cars",       label: "Cars",       icon: Car },
  { slug: "parts",      label: "Parts",      icon: Layers },
  { slug: "processors", label: "Processors", icon: Code2 },
  { slug: "data",       label: "Data",       icon: Database },
];

const CatalogPage = () => {
  useDocumentTitle("Document title: Catalog");
  const { tab = "cars" } = useParams();
  const navigate = useNavigate();
  const { str } = useLocale();

  const activeSlug = TABS.some((t) => t.slug === tab) ? tab : "cars";

  const renderTabContent = (slug) => {
    const loading = <Loader center content={str("Loading...")} />;
    switch (slug) {
      case "cars":
        return (
          <ErrorBoundary>
            <Suspense fallback={loading}>
              <CarCatalog />
            </Suspense>
          </ErrorBoundary>
        );
      case "parts":
        return (
          <ErrorBoundary>
            <Suspense fallback={loading}>
              <PartsCatalog />
            </Suspense>
          </ErrorBoundary>
        );
      case "processors":
        return (
          <ErrorBoundary>
            <Suspense fallback={loading}>
              <ProcessorsCatalog />
            </Suspense>
          </ErrorBoundary>
        );
      case "data":
        return null;
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
            {TABS.map(({ slug, label, icon: Icon }) => (
              <button
                key={slug}
                type="button"
                role="tab"
                data-testid={`catalog-tab-${slug}`}
                aria-selected={activeSlug === slug}
                className={`catalog-tab-btn${activeSlug === slug ? " active" : ""}`}
                onClick={() => navigate(`/app/catalog/${slug}`)}
              >
                <Icon size={15} aria-hidden />
                <Trans>{label}</Trans>
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-card fade-in-simple">
          <div className="catalog-tab-content">
            {renderTabContent(activeSlug)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
