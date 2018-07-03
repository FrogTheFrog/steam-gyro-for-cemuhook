import { RouterModule, Routes } from "@angular/router";
import { SettingsPage } from "./pages/settings.page";

const usersRoutes: Routes = [
    {
        children: [
            { path: "", component: SettingsPage },
        ],
        path: "settings",
    },
];

export const SettingsRouting = RouterModule.forChild(usersRoutes);
