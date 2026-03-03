export interface ModalConfig {
    title: string;
    description?: string;
    buttons?: ModalButton[];
    showCloseButton?: boolean;
    closeOnOverlayClick?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    data?: any;
}

export interface ModalButton {
    text: string;
    type?: 'button' | 'submit';
    variant?: 'primary' | 'secondary' | 'danger';
    handler?: (modalRef: ModalRef) => void;
    closeOnClick?: boolean;
}

import { ComponentRef } from '@angular/core';
import { Subject } from 'rxjs';

export class ModalRef {
    private afterClosedSubject = new Subject<any>();
    afterClosed$ = this.afterClosedSubject.asObservable();

    constructor(private componentRef: ComponentRef<any>) { }

    close(result?: any): void {
        this.componentRef.destroy();
        this.afterClosedSubject.next(result);
        this.afterClosedSubject.complete();
    }
}