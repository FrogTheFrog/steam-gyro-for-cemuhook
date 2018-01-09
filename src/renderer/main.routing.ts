import { ModuleWithProviders } from '@angular/core';
import { Routes as AngularRoutes, RouterModule } from '@angular/router';

import { HomeComponent, SettingsComponent, SteamDevicesComponent, ErrorComponent } from './components';

const AppRouter: AngularRoutes = [
    {
        path: '',
        component: HomeComponent
    },
    {
        path: 'settings',
        component: SettingsComponent
    },
    {
        path: 'error',
        component: ErrorComponent
    },
    {
        path: 'steam-devices',
        component: SteamDevicesComponent
    }
];

export const Routes: ModuleWithProviders = RouterModule.forRoot(AppRouter, {
    useHash: true
});