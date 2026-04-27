import { ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AuthRole, getAuthRole, isAuthenticated } from '../lib/auth';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import AdminUsersPage from '../pages/AdminUsersPage';
import AppErrorPage from '../pages/AppErrorPage';
import ArchivePage from '../pages/ArchivePage';
import AboutPage from '../pages/AboutPage';
import AppShell from './layout/AppShell';
import CertificatePreviewPage from '../pages/CertificatePreviewPage';
import JuryDashboardPage from '../pages/JuryDashboardPage';
import LeaderboardPage from '../pages/LeaderboardPage';
import LoginPage from '../pages/LoginPage';
import MessagesPage from '../pages/MessagesPage';
import MonitoringPage from '../pages/MonitoringPage';
import NotFoundPage from '../pages/NotFoundPage';
import OAuthCallbackPage from '../pages/OAuthCallbackPage';
import ProfilePage from '../pages/ProfilePage';
import RegisterPage from '../pages/RegisterPage';
import SystemIntegrationsPage from '../pages/SystemIntegrationsPage';
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
    path: '/app/certificates',
    errorElement: <AppErrorPage />,
    element: (
      <ProtectedRoute roles={['ADMIN', 'ORGANIZER']}>
        <CertificatePreviewPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/app',
    errorElement: <AppErrorPage />,
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
        path: 'about',
        element: <AboutPage />,
      },
      {
        path: 'archive',
        element: <ArchivePage />,
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
        path: 'oauth/callback',
        element: <OAuthCallbackPage />,
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
        path: 'users',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'integrations',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <SystemIntegrationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'monitoring',
        element: (
          <ProtectedRoute roles={['ADMIN']}>
            <MonitoringPage />
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
