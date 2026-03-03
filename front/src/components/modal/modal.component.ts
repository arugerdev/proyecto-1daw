import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  Injectable,
  Injector,
  Type,
} from '@angular/core';
import { ModalConfig, ModalRef } from '../../app/models/modal.model';
import { ModalContainerComponent } from './modal-container.component';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private modalRef?: ModalRef;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) { }

  open<T>(
    component: Type<T>,
    config: ModalConfig
  ): ModalRef {
    const containerRef = this.createModalContainer(config);

    const contentRef = this.createContent(component, containerRef, config);

    this.setupCommunication(containerRef, contentRef);

    this.modalRef = new ModalRef(containerRef);
    return this.modalRef;
  }

  private createModalContainer(config: ModalConfig): ComponentRef<any> {
    const hostElement = document.createElement('div');
    hostElement.classList.add('modal-host');
    document.body.querySelector('app-root')?.appendChild(hostElement);

    const containerRef = createComponent(ModalContainerComponent, {
      environmentInjector: this.injector,
      hostElement,
    });

    Object.assign(containerRef.instance, config);
    containerRef.instance.modalRef = new ModalRef(containerRef);

    this.appRef.attachView(containerRef.hostView);

    return containerRef;
  }

  private createContent<T>(
    component: Type<T>,
    containerRef: ComponentRef<any>,
    config: ModalConfig
  ): ComponentRef<T> {
    // Crear vista para el contenido
    const contentRef = createComponent(component, {
      environmentInjector: this.injector,
      hostElement: containerRef.instance.contentHost.nativeElement,
    });

    if (config.data) {
      Object.assign(contentRef.instance as object, config.data);
    }
    this.appRef.attachView(contentRef.hostView);

    return contentRef;
  }

  private setupCommunication(
    containerRef: ComponentRef<any>,
    contentRef: ComponentRef<any>
  ): void {
    // Suscribirse a eventos del contenido
    if (contentRef.instance['modalClose']) {
      contentRef.instance['modalClose'].subscribe((result: any) => {
        containerRef.instance.close(result);
      });
    }

    // Pasar referencia del modal al contenido
    contentRef.instance['modalRef'] = containerRef.instance.modalRef;
  }
}