// Legacy modal — superseded by inline filesystem browser in dashboard
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-route-modal',
  standalone: true,
  imports: [CommonModule],
  template: ''
})
export class RouteModalComponent {
  @Input() data: any = {};
}
