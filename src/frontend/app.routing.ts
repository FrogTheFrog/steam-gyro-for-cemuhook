import { RouterModule, Routes } from "@angular/router";

const appRoutes: Routes = [
    { path: "", redirectTo: "settings", pathMatch: "full" }
];

export const AppRouting = RouterModule.forRoot(appRoutes, {
    useHash: true,
});
