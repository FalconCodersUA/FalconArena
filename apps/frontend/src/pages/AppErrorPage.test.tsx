import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import AppErrorPage from './AppErrorPage';

function renderWithError(error: Error) {
  const router = createMemoryRouter(
    [
      {
        path: '/app',
        errorElement: <AppErrorPage />,
        children: [
          {
            index: true,
            loader: () => {
              throw error;
            },
            element: <div>App</div>,
          },
        ],
      },
    ],
    {
      initialEntries: ['/app'],
    },
  );

  return render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  );
}

describe('AppErrorPage', () => {
  it('renders a friendly fallback instead of a raw router error', async () => {
    localStorage.setItem('falconarena_language', 'en');

    renderWithError(new Error('Team workspace failed to load'));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Team workspace failed to load')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to tournaments' })).toBeInTheDocument();
  });
});
