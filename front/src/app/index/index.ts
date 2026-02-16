import { Component, signal } from '@angular/core';
import { Header } from '../../components/header/header';

@Component({
    selector: 'index-page',
    imports: [Header],
    templateUrl: './page.html',
    styleUrl: './style.css'
})
export class IndexPage {
    protected readonly title = signal('Sistema de Gestión Multimedia');
}
