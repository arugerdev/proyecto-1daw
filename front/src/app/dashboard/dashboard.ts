import { Component, signal } from '@angular/core';
import { Header } from '../../components/header/header.component';

@Component({
    selector: 'dashboard-page',
    imports: [Header],
    templateUrl: './page.html',
    styleUrl: './style.css'
})
export class DashboardPage {
    protected readonly title = signal('Administración del sistem');
}
