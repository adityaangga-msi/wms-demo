import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { APP_SHORTCUTS } from '../../../core/utils/shortcuts';

@Component({
  selector: 'app-shortcuts-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './shortcuts-dialog.html',
  styleUrl: './shortcuts-dialog.scss',
})
export class ShortcutsDialog {
  private readonly dialogRef = inject(MatDialogRef<ShortcutsDialog>);
  private readonly router = inject(Router);

  readonly shortcuts = APP_SHORTCUTS;

  close(): void {
    this.dialogRef.close();
  }

  openGuide(): void {
    this.dialogRef.close();
    void this.router.navigateByUrl('/settings/demo-data');
  }
}
