import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

export type SalaryAccessType = 'VIEW' | 'EXPORT' | 'CREATE' | 'UPDATE' | 'DELETE';

interface SalaryAuditParams {
  targetProfileId?: string;
  targetEmployeeName?: string;
  accessType: SalaryAccessType;
  salaryMonth?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an access to sensitive salary data for GDPR compliance.
 * Called automatically by useRHSalaires and salary-related components.
 */
export async function logSalaryAccess({
  targetProfileId,
  targetEmployeeName,
  accessType,
  salaryMonth,
  details,
}: SalaryAuditParams): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Don't block on audit logging - fire and forget
    supabase.from('salary_access_log').insert({
      accessor_user_id: session.user.id,
      accessor_email: session.user.email,
      target_profile_id: targetProfileId,
      target_employee_name: targetEmployeeName,
      access_type: accessType,
      salary_month: salaryMonth,
      details: details ? JSON.stringify(details) : null,
      user_agent: navigator.userAgent,
    }).then(({ error }) => {
      if (error && import.meta.env.DEV) {
        debug.warn('Salary audit log failed:', error.message);
      }
    });
  } catch (error) {
    // Audit logging should never block the main flow
    if (import.meta.env.DEV) {
      debug.warn('Salary audit logging error:', error);
    }
  }
}

/**
 * Log a batch view of salary data (e.g., viewing all salaries for a month)
 */
export async function logSalaryBatchView(
  month: string,
  employeeCount: number
): Promise<void> {
  return logSalaryAccess({
    accessType: 'VIEW',
    salaryMonth: month,
    details: { batch_view: true, employee_count: employeeCount },
  });
}

/**
 * Log an export of salary data
 */
export async function logSalaryExport(
  month: string,
  format: 'csv' | 'xlsx' | 'pdf',
  employeeCount: number
): Promise<void> {
  return logSalaryAccess({
    accessType: 'EXPORT',
    salaryMonth: month,
    details: { export_format: format, employee_count: employeeCount },
  });
}
