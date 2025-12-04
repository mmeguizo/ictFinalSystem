import { Directive, inject, input, TemplateRef, ViewContainerRef, effect } from '@angular/core';
import { UserService } from '../../core/services/user.service';

/**
 * Has Role Directive
 * Conditionally shows/hides elements based on user role
 *
 * Usage:
 * <div *appHasRole="'ADMIN'">Admin only content</div>
 * <div *appHasRole="['ADMIN', 'DEVELOPER']">Admin or Developer content</div>
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private readonly userService = inject(UserService);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly templateRef = inject(TemplateRef<any>);

  // Input accepts single role string or array of roles
  appHasRole = input.required<string | string[]>();

  constructor() {
    // Effect runs whenever user or required roles change
    effect(() => {
      const requiredRoles = this.appHasRole();
      const currentUser = this.userService.currentUser();
      const userRole = currentUser?.role;

      // Convert to array for consistent handling
      const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

      // Show template if user has one of the allowed roles
      if (userRole && allowedRoles.includes(userRole)) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    });
  }
}
