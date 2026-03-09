import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '../models/modal.model';
import { MediaItem } from '../models/file.model';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-details-modal',
  standalone: true,
  imports: [CommonModule],
  template: `

<div class="details-container">

  <div class="preview-container">

    <!-- VIDEO -->
    <video *ngIf="isVideo" controls class="viewer">
      <source [src]="fileSource">
      Tu navegador no soporta video.
    </video>

    <!-- IMAGEN -->
    <img *ngIf="isImage"
         [src]="fileSource"
         class="viewer"/>

    <!-- AUDIO -->
    <audio *ngIf="isAudio" controls class="viewer">
      <source [src]="fileSource">
      Tu navegador no soporta audio.
    </audio>

    <!-- PDF -->
    <iframe *ngIf="isPdf"
            [src]="fileSource"
            class="viewer pdf">
    </iframe>

    <!-- OTROS -->
    <div *ngIf="isOther" class="other-file">
      <p>Este archivo no se puede previsualizar.</p>
      <a [href]="fileSource" target="_blank" class="btn btn-primary">
        Descargar archivo
      </a>
    </div>

  </div>


  <div class="details-info">

  
  <h2 class="title">{{file?.title}}</h2>

    <div class="detail-row">
      <span class="label">Descripción</span>
      <span class="value">{{file?.description}}</span>
    </div>

    <div class="detail-row">
      <span class="label">Año</span>
      <span class="value">{{file?.publication_year}}</span>
    </div>

    
    <div class="detail-row" *ngIf="canViewPaths">
      <span class="label">Ruta</span>
      <span class="value">{{file?.media_path}}</span>
    </div>

  </div>

  <div class="buttons">
    <button class="btn btn-secondary" (click)="close()">Cerrar</button>
  </div>

</div>

`,
  styles: [`
.details-container{
  display:flex;
  flex-direction:column;
  gap:22px;
  min-width:650px;
  max-width:900px;
}

/* VISOR MULTIMEDIA */

.preview-container{
  width:100%;
  display:flex;
  justify-content:center;
  align-items:center;
  background:var(--surface-secondary);
  border-radius:10px;
  padding:16px;
  border:1px solid var(--border-color);
}

.viewer{
  width:100%;
  height:100%;
  object-fit:contain;
  aspect-ratio:1/1;
  max-width:100%;
  max-height:420px;
  border-radius:8px;
  box-shadow:0 4px 16px rgba(0,0,0,0.2);
}

.pdf{
  width:100%;
  height:520px;
  border:none;
  border-radius:6px;
}

.title{
    color:var(--text-primary);
    font-size:normal;
    padding:8px 10px 12px 10px;
    border-bottom: 2px solid var(--border-soft);
    }

/* INFORMACIÓN */

.details-info{
display:flex;
flex-direction:column;
  
  padding:8px 0;
}

.detail-row{
  display:flex;
  flex-direction:column;
  gap:3px;
  padding:8px 10px;
  background:var(--surface-secondary);
  border-radius:6px;
  border:1px solid var(--border-color);
}

.label{
  font-size:12px;
  font-weight:600;
  letter-spacing:0.5px;
  text-transform:uppercase;
  color:var(--text-secondary);
}

.value{
  font-size:14px;
  color:var(--text-primary);
  word-break:break-word;
}

/* BOTONES */

.buttons{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:8px;
}

.btn{
  padding:7px 14px;
  border-radius:6px;
  font-size:13px;
  border:none;
  cursor:pointer;
  transition:all 0.15s ease;
}

/* botón primario */

.btn-primary{
  background:var(--btn-primary-bg);
  color:var(--btn-primary-text);
}

.btn-primary:hover{
  background:var(--btn-primary-hover);
  transform:translateY(-1px);
}

/* botón secundario */

.btn-secondary{
  background:var(--btn-secondary-bg);
  border:1px solid var(--btn-secondary-border);
  color:var(--text-primary);
}

.btn-secondary:hover{
  background:var(--btn-secondary-hover);
  transform:translateY(-1px);
}

/* ARCHIVO NO PREVISUALIZABLE */

.other-file{
  text-align:center;
  padding:30px;
  color:var(--text-secondary);
  display:flex;
  flex-direction:column;
  gap:14px;
  align-items:center;
}

/* RESPONSIVE */

@media (max-width:700px){

  .details-container{
    min-width:auto;
  }
    
  .detail-row{
    padding:0;
    margin:0;
  }

 .title {
    padding:0px 0px 8px 0px;
  }

  .viewer{
    max-height:300px;
  }

}

@media(max-width:500px){
    .title{

    font-size:small;
    
    }
}

`]
})
export class DetailsModalComponent implements OnInit {

  constructor(private fileService: FileService) { }

  @Input() modalRef?: ModalRef;
  @Input() file!: MediaItem;

  isVideo = false;
  isImage = false;
  isAudio = false;
  isPdf = false;
  isOther = false;

  canViewPaths = false;

  fileSource: string | null = null;

  ngOnInit() {
    if (!this.file?.media_path) return;

    const ext = this.file.media_path.split('.').pop()?.toLowerCase();

    this.fileSource = this.fileService.getFile(this.file)

    if (!ext) return;

    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) this.isVideo = true;
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) this.isImage = true;
    else if (['mp3', 'wav', 'ogg'].includes(ext)) this.isAudio = true;
    else if (['pdf'].includes(ext)) this.isPdf = true;
    else this.isOther = true;
  }

  close() {
    this.modalRef?.close();
  }

}