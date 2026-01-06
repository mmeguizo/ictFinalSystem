import { Pipe, PipeTransform } from '@angular/core';

/**
 * Role Label Pipe
 * Converts role enum values to human-readable labels
 *
 * Usage:
 * {{ user.role | roleLabel }}
 * ADMIN -> Administrator
 * DEVELOPER -> Developer
 */
@Pipe({
  name: 'roleLabel',
  standalone: true,
})
export class RoleLabelPipe implements PipeTransform {
  private readonly roleLabels: Record<string, string> = {
    ADMIN: 'Administrator',
    DEVELOPER: 'Developer',
    TECHNICAL: 'Technical Support',
    MIS_HEAD: 'MIS Head',
    ITS_HEAD: 'ITS Head',
    SECRETARY: 'Secretary',
    DIRECTOR: 'Director',
    USER: 'User',
  };

  transform(role: string | null | undefined): string {
    if (!role) return 'Unknown';
    return this.roleLabels[role] || role;
  }
}
