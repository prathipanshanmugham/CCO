import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui.jsx';
import { SessionProvider } from './lib/session.jsx';
import StudioPage from './features/studio/StudioPage.jsx';
import TrackPage, { TrackLookup } from './features/track/TrackPage.jsx';

// The staff console is code-split so the customer studio stays light.
const LoginPage = lazy(() => import('./console/Layout.jsx').then((m) => ({ default: m.LoginPage })));
const ConsoleLayout = lazy(() => import('./console/Layout.jsx').then((m) => ({ default: m.ConsoleLayout })));
const Dashboard = lazy(() => import('./console/Dashboard.jsx'));
const QuotesPage = lazy(() => import('./console/Quotes.jsx'));
const QuoteDetail = lazy(() => import('./console/QuoteDetail.jsx'));
const UsersPage = lazy(() => import('./console/Users.jsx'));
const AiPage = lazy(() => import('./console/AiPage.jsx'));
const SettingsPage = lazy(() => import('./console/Settings.jsx'));

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="login"><span className="spin" /></div>}>
            <Routes>
              <Route path="/" element={<StudioPage brand="CLELIA" />} />
              <Route path="/scorpling" element={<StudioPage brand="SCORPLING" />} />
              <Route path="/track" element={<TrackLookup />} />
              <Route path="/track/:ref" element={<TrackPage />} />
              <Route path="/staff/login" element={<LoginPage />} />
              <Route path="/staff" element={<ConsoleLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="quotes" element={<QuotesPage />} />
                <Route path="quotes/:id" element={<QuoteDetail />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="ai" element={<AiPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SessionProvider>
    </ToastProvider>
  );
}
