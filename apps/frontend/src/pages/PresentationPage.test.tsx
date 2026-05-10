import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import PresentationPage from './PresentationPage';

function renderPresentationPage() {
  return render(
    <MemoryRouter initialEntries={['/app/presentation']}>
      <I18nProvider>
        <PresentationPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('PresentationPage', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('falconarena_language', 'uk');
  });

  it('renders the product presentation with embedded YouTube player', () => {
    renderPresentationPage();

    expect(
      screen.getByRole('heading', { name: 'Презентація FalconArena' }),
    ).toBeInTheDocument();

    const iframe = screen.getByTitle('Відеопрезентація FalconArena');
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/tVMOHUrgPZ4?rel=0&modestbranding=1',
    );

    expect(screen.queryByRole('link', { name: 'Відкрити на YouTube' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'До сторінки Про нас' })).toHaveAttribute(
      'href',
      '/app/about',
    );
  });
});
