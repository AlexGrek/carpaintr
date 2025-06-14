import './App.css'
import LoginPage from './components/pages/LoginPage'
import AdminPage from './components/pages/AdminPage'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/pages/LandingPage.jsx'
import CompanyInfoPage from './components/pages/CompanyInfoPage.jsx'
import CalcPage from './components/pages/CalcPage.jsx';
import { GlobalCallbacksProvider } from './components/GlobalCallbacksContext.jsx'
import CabinetPage from './components/pages/CabinetPage.jsx';
import RegistrationPage from './components/pages/RegistrationPage.jsx';
import FileEditorPage from './components/pages/FileEditorPage.jsx';
import UsersDashboard from './components/pages/UsersDashboard.jsx';
import { LocaleProvider } from './localization/LocaleContext.jsx';
import WipPage from './components/pages/WipPage.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import ContactSupport from './components/pages/ContactSupport.jsx';

const HistoryPage = () => <h2>History Page</h2>;
const AboutUsPage = () => <h2>About Us Page</h2>;

function App() {
  return (
    <LocaleProvider>
      <GlobalCallbacksProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/calc" element={<CalcPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="/company" element={<CompanyInfoPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/aboutus" element={<AboutUsPage />} />
            <Route path="/cabinet" element={<CabinetPage />} />
            <Route path="/fileeditor" element={<FileEditorPage />} />
            <Route path="/dashboard" element={<UsersDashboard />} />
            <Route path="/wip" element={<WipPage />} />
            <Route path="/report" element={<ContactSupport />} />
          </Routes>
        </Router>
      </GlobalCallbacksProvider>
    </LocaleProvider>
  )
}

export default App
