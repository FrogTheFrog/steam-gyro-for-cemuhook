import { ModuleWithProviders } from '@angular/core';
import { Routes as AngularRoutes, RouterModule } from '@angular/router';

import { HomeComponent, SettingsComponent, SteamDevicesComponent } from './components';

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
        path: 'steam-devices',
        component: SteamDevicesComponent
    }
];

export const Routes: ModuleWithProviders = RouterModule.forRoot(AppRouter, {
    useHash: true
});