import { Routes } from '@angular/router';
import { LoginPage } from './login/login';
import { IndexPage } from './index/index';
import { authGuard } from './guards/auth-guard';


export const routes: Routes = [
    {
        path: '',
        component: IndexPage,
        canActivate: [authGuard]
    },
    {
        path: 'login',
        component: LoginPage,
    },
    { path: '**', redirectTo: '/' },
];
