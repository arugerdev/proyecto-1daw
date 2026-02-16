import { Routes } from '@angular/router';
import { LoginPage } from './login/login';
import { IndexPage } from './index/index';

export const routes: Routes = [
    {
        path: '',
        component: IndexPage
    },
    {
        path: 'login',
        component: LoginPage,
    },
    { path: '**', redirectTo: '/' },
];
