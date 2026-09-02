import { ReactNode } from 'react';
import { RoleGuard } from './RoleGuard';

interface RHAccessGuardProps {
  children: ReactNode;
  requiredPermission: 
    | 'canViewSalaries'
    | 'canEditSalaries'
    | 'canViewRHDocuments'
    | 'canUploadRHDocuments'
    | 'canViewRHObjectifs'
    | 'canEditRHObjectifs'
    | 'canViewAllAbsences'
    | 'canManageAbsences'
    | 'canExportPayroll';
  showFallback?: boolean;
}

export function RHAccessGuard({ 
  children, 
  requiredPermission,
  showFallback = true 
}: RHAccessGuardProps) {
  return (
    <RoleGuard 
      requiredPermission={requiredPermission}
      showFallback={showFallback}
    >
      {children}
    </RoleGuard>
  );
}
