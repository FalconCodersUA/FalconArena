import { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';
import AppShell from './layout/AppShell';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import TeamDashboardPage from '../pages/TeamDashboardPage';
import TournamentsPage from '../pages/TournamentsPage';

function ProtectedRoute({ children }: { children: ReactElement }) {
  return isAuthenticated() ? children : <Navigate to="/app/login" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
  {
    path: '/app',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <TournamentsPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'team',
        element: (
          <ProtectedRoute>
            <TeamDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournaments',
        element: <Navigate to="/app" replace />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/app" replace />,
  },
]);
