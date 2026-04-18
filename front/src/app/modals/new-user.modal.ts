// Legacy modal — superseded by inline user form in dashboard
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-modal',
  standalone: true,
  imports: [CommonModule],
  template: ''
})
export class UserModalComponent {
  @Input() data: any = {};
}
