import './App.css'
import LoginPage from './components/pages/LoginPage'
import AdminPage from './components/pages/AdminPage'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/pages/LandingPage.jsx'
import CompanyInfoPage from './components/pages/CompanyInfoPage.jsx'
import CalcPage from './components/pages/CalcPage.jsx';
import {GlobalCallbacksProvider} from './components/GlobalCallbacksContext.jsx'
import CabinetPage from './components/pages/CabinetPage.jsx';
import RegistrationPage from './components/pages/RegistrationPage.jsx';


const HistoryPage = () => <h2>History Page</h2>;
const AboutUsPage = () => <h2>About Us Page</h2>;

function App() {
  return (
    <GlobalCallbacksProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/calc" element={<CalcPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/company" element={<CompanyInfoPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/aboutus" element={<AboutUsPage />} />
          <Route path="/cabinet" element={<CabinetPage />} />
        </Routes>
      </Router>
    </GlobalCallbacksProvider>
  )
}

export default App
