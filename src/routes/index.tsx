import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import RootLayout from './RootLayout';

import MainPage from '@/pages/general/main/index';
import NotFoundPage from '@/pages/general/error/index';

const routes: RouteObject[] = [
    {
        path: '/',
        element: <RootLayout />,
        children: [
            // ────────────────────────
            // General
            // ────────────────────────
            { path: '*', element: <NotFoundPage /> },
            { path: '/', element: <MainPage /> },
        ],
    },
];

export const router = createBrowserRouter(routes);
