// Legacy modal — superseded by media-viewer.modal.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-details-modal',
  standalone: true,
  imports: [CommonModule],
  template: ''
})
export class DetailsModalComponent {
  @Input() data: any = {};
}
