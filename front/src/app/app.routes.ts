import { Routes } from '@angular/router';
import { LoginPage } from './login/login';
import { IndexPage } from './index/index';
import { authGuard } from './guards/auth-guard';
import { DashboardPage } from './dashboard/dashboard';
import { roleGuard } from './guards/role-guard';


export const routes: Routes = [
    {
        path: '',
        component: IndexPage,
        canActivate: [authGuard]
    },
    {
        path: 'dashboard',
        component: DashboardPage,
        canActivate: [authGuard, roleGuard(['admin'])]
    },
    {
        path: 'login',
        component: LoginPage,
    },
    { path: '**', redirectTo: '/' },
];
