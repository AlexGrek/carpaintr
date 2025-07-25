import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';

import { GlobalCallbacksProvider } from './components/GlobalCallbacksContext.jsx';
import { LocaleProvider } from './localization/LocaleContext.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import ComponentLoadingPage from './components/layout/ComponentLoadingPage.jsx';
import CatalogPage from './components/pages/CatalogPage.jsx';
import { useVersionCheck } from './version';
import ErrorBoundary from './ErrorBoundary.jsx';
import CreateProcPage from './components/pages/CreateProcPage.jsx';

// Lazy-loaded pages
const LandingPage = lazy(() => import('./components/pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('./components/pages/LoginPage.jsx'));
const RegistrationPage = lazy(() => import('./components/pages/RegistrationPage.jsx'));
const CalcPage = lazy(() => import('./components/pages/CalcPage.jsx'));
const CalcPageV2 = lazy(() => import('./components/pages/CalcPageV2.jsx'));
const AdminPage = lazy(() => import('./components/pages/AdminPage.jsx'));
const CompanyInfoPage = lazy(() => import('./components/pages/CompanyInfoPage.jsx'));
const CabinetPage = lazy(() => import('./components/pages/CabinetPage.jsx'));
const FileEditorPage = lazy(() => import('./components/pages/FileEditorPage.jsx'));
const UsersDashboard = lazy(() => import('./components/pages/UsersDashboard.jsx'));
const WipPage = lazy(() => import('./components/pages/WipPage.jsx'));
const ContactSupport = lazy(() => import('./components/pages/ContactSupport.jsx'));

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
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegistrationPage />} />
                <Route path="/calc" element={<CalcPage />} />
                <Route path="/calc2/*" element={<CalcPageV2 />} />
                <Route path="/admin/*" element={<AdminPage />} />
                <Route path="/company" element={<CompanyInfoPage />} />
                <Route path="/catalog" element={<CatalogPage />} />
                <Route path="/company" element={<CompanyInfoPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/aboutus" element={<AboutUsPage />} />
                <Route path="/cabinet" element={<CabinetPage />} />
                <Route path="/fileeditor" element={<FileEditorPage />} />
                <Route path="/dashboard" element={<UsersDashboard />} />
                <Route path="/wip" element={<WipPage />} />
                <Route path="/report" element={<ContactSupport />} />
                <Route path="/create-proc" element={<CreateProcPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </GlobalCallbacksProvider>
    </LocaleProvider>
  );
}

export default App;
