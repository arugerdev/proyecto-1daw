import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class App {
  // Eager instantiation: ensures the persisted theme is applied before first render.
  private readonly theme = inject(ThemeService);
}
