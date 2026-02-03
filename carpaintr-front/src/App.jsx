import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";

import { GlobalCallbacksProvider } from "./components/GlobalCallbacksContext.jsx";
import { LocaleProvider } from "./localization/LocaleContext.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import ComponentLoadingPage from "./components/layout/ComponentLoadingPage.jsx";
import CatalogPage from "./components/pages/CatalogPage.jsx";
import { useVersionCheck } from "./version";
import ErrorBoundary from "./ErrorBoundary.jsx";
import CreateProcPage from "./components/pages/CreateProcPage.jsx";
import NotFoundPage from "./components/pages/NotFoundPage.jsx";

// Lazy-loaded pages
const LandingPage = lazy(() => import("./components/pages/LandingPage.jsx"));
const LoginPage = lazy(() => import("./components/pages/LoginPage.jsx"));
const RegistrationPage = lazy(
  () => import("./components/pages/RegistrationPage.jsx"),
);
const CalcPage = lazy(() => import("./components/pages/CalcPage.jsx"));
const CalcPageV2 = lazy(() => import("./components/pages/CalcPageV2.jsx"));
const AdminPage = lazy(() => import("./components/pages/AdminPage.jsx"));
const CompanyInfoPage = lazy(
  () => import("./components/pages/CompanyInfoPage.jsx"),
);
const CabinetPage = lazy(() => import("./components/pages/CabinetPage.jsx"));
const FileEditorPage = lazy(
  () => import("./components/pages/FileEditorPage.jsx"),
);
const UsersDashboard = lazy(
  () => import("./components/pages/UsersDashboard.jsx"),
);
const WipPage = lazy(() => import("./components/pages/WipPage.jsx"));
const ContactSupport = lazy(
  () => import("./components/pages/ContactSupport.jsx"),
);
const TemplatesPage = lazy(
  () => import("./components/pages/TemplatesPage.jsx"),
);

// Static content — no need for lazy-loading simple components
const HistoryPage = () => <h2>History Page</h2>;
const AboutUsPage = () => <h2>About Us Page</h2>;

function App() {
  useVersionCheck();
  return (
    <LocaleProvider>
      <GlobalCallbacksProvider>
        <Router>
          <ScrollToTop />
          <ErrorBoundary>
            <Suspense fallback={<ComponentLoadingPage />}>
              <Routes>
                {/* Marketing landing page - only route at root level */}
                <Route path="/" element={<LandingPage />} />

                {/* All application routes under /app */}
                <Route path="/app/login" element={<LoginPage />} />
                <Route path="/app/register" element={<RegistrationPage />} />
                <Route path="/app/calc" element={<CalcPage />} />
                <Route path="/app/calc2/*" element={<CalcPageV2 />} />
                <Route path="/app/admin/*" element={<AdminPage />} />
                <Route path="/app/company" element={<CompanyInfoPage />} />
                <Route path="/app/catalog" element={<CatalogPage />} />
                <Route path="/app/history" element={<HistoryPage />} />
                <Route path="/app/aboutus" element={<AboutUsPage />} />
                <Route path="/app/cabinet" element={<CabinetPage />} />
                <Route path="/app/fileeditor" element={<FileEditorPage />} />
                <Route path="/app/dashboard" element={<UsersDashboard />} />
                <Route path="/app/wip" element={<WipPage />} />
                <Route path="/app/report" element={<ContactSupport />} />
                <Route path="/app/create-proc" element={<CreateProcPage />} />
                <Route path="/app/templates" element={<TemplatesPage />} />

                {/* 404 - Catch all unmatched routes */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </GlobalCallbacksProvider>
    </LocaleProvider>
  );
}

export default App;
