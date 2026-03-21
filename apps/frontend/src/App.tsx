import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { NotificationsProvider } from './app/notifications/NotificationsProvider';
import { I18nProvider } from './i18n/I18nProvider';

export default function App() {
  return (
    <I18nProvider>
      <NotificationsProvider>
        <RouterProvider router={router} />
      </NotificationsProvider>
    </I18nProvider>
  );
}
