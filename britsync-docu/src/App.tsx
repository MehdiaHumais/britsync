import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import DocumentsList from './pages/DocumentsList';
import DocumentsNew from './pages/DocumentsNew';
import DocumentEditor from './pages/DocumentEditor';
import SendFlow from './pages/SendFlow';
import PublicSigning from './pages/PublicSigning';
import Templates from './pages/Templates';
import Contacts from './pages/Contacts';
import Reports from './pages/Reports';
import TeamManagement from './pages/TeamManagement';
import Settings from './pages/Settings';
import AuditVerification from './pages/AuditVerification';
import { CookieConsent } from './components/ui/CookieConsent';

export const App: React.FC = () => {
    return (
        <BrowserRouter basename="/docu">
            <Routes>
                {/* Public Landing */}
                <Route path="/" element={<LandingPage />} />
                
                {/* Auth */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Dashboard & Workspace */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/documents" element={<DocumentsList />} />
                <Route path="/documents/new" element={<DocumentsNew />} />
                <Route path="/documents/:id/editor" element={<DocumentEditor />} />
                <Route path="/documents/:id/send" element={<SendFlow />} />
                
                {/* Professional Features */}
                <Route path="/templates" element={<Templates />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/team" element={<TeamManagement />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/verify" element={<AuditVerification />} />
                
                {/* Recipient signing & downloads (Public, no login needed) */}
                <Route path="/public/sign/:secureToken" element={<PublicSigning />} />
                
                {/* Catch-all fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <CookieConsent />
        </BrowserRouter>
    );
};

export default App;
