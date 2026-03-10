import { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';
import AppShell from './layout/AppShell';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import TournamentsPage from '../pages/TournamentsPage';

function ProtectedRoute({ children }: { children: ReactElement }) {
  return isAuthenticated() ? children : <Navigate to="/app/login" replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app/tournaments" replace />,
  },
  {
    path: '/app',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/app/tournaments" replace />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'tournaments',
        element: (
          <ProtectedRoute>
            <TournamentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/app/tournaments" replace />,
  },
]);
