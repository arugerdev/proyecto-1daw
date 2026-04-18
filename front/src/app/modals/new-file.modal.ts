// Legacy modal — superseded by upload.modal.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-content-modal',
  standalone: true,
  imports: [CommonModule],
  template: ''
})
export class ContentModalComponent {
  @Input() data: any = {};
}
