import { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AuthRole, getAuthRole, isAuthenticated } from '../lib/auth';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import AppShell from './layout/AppShell';
import JuryDashboardPage from '../pages/JuryDashboardPage';
import LeaderboardPage from '../pages/LeaderboardPage';
import LoginPage from '../pages/LoginPage';
import MessagesPage from '../pages/MessagesPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProfilePage from '../pages/ProfilePage';
import RegisterPage from '../pages/RegisterPage';
import TeamDashboardPage from '../pages/TeamDashboardPage';
import TeamsPage from '../pages/TeamsPage';
import TournamentDetailsPage from '../pages/TournamentDetailsPage';
import TournamentsPage from '../pages/TournamentsPage';

function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactElement;
  roles?: AuthRole[];
}) {
  if (!isAuthenticated()) {
    return <Navigate to="/app/login" replace />;
  }

  const role = getAuthRole();
  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/app" replace />;
  }

  return children;
}

function RoleDashboardRedirect() {
  const role = getAuthRole();

  if (role === 'TEAM') {
    return <Navigate to="/app/team" replace />;
  }

  if (role === 'JURY') {
    return <Navigate to="/app/jury" replace />;
  }

  if (role === 'ADMIN' || role === 'ORGANIZER') {
    return <Navigate to="/app/admin" replace />;
  }

  return <Navigate to="/app/tournaments" replace />;
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
        element: <Navigate to="/app/tournaments" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <RoleDashboardRedirect />
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournaments',
        element: <TournamentsPage />,
      },
      {
        path: 'tournaments/:tournamentId',
        element: <TournamentDetailsPage />,
      },
      {
        path: 'teams',
        element: <TeamsPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'leaderboard',
        element: <LeaderboardPage />,
      },
      {
        path: 'messages',
        element: (
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'team',
        element: (
          <ProtectedRoute roles={['TEAM']}>
            <TeamDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'jury',
        element: (
          <ProtectedRoute roles={['JURY']}>
            <JuryDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute roles={['ADMIN', 'ORGANIZER']}>
            <AdminDashboardPage />
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
    element: <Navigate to="/app" replace />,
  },
]);
