import { Navigate, createBrowserRouter } from 'react-router-dom';
import AppShell from './layout/AppShell';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import TournamentsPage from '../pages/TournamentsPage';

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
