import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { initialize } from '@microsoft/power-apps/app';

import Layout from '@/pages/_layout';
import { queryClient } from '@/lib/query-client';
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from '@/components/system/error-boundary';
import { UnsavedChangesProvider } from '@/components/unsaved-changes-guard';


import HomePage from '@/pages/index';
import ContactsPage from '@/pages/contacts';
import ApplicationsPage from '@/pages/applications';
import FollowUpsPage from '@/pages/follow-ups';
import InteractionsPage from '@/pages/interactions';
import NotFoundPage from '@/pages/not-found';

function App() {
  useEffect(() => {
    initialize();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary resetQueryCache>
        <JotaiProvider>
          <Toaster richColors />
          <Router>
            <UnsavedChangesProvider>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="contacts" element={<ContactsPage />} />
                  <Route path="applications" element={<ApplicationsPage />} />
                  <Route path="interactions" element={<InteractionsPage />} />
                  <Route path="follow-ups" element={<FollowUpsPage />} />

                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>

            </UnsavedChangesProvider>
          </Router>
        </JotaiProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
