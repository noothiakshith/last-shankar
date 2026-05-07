'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { FinanceDashboardContent } from '@/components/dashboards/FinanceDashboardContent';

export default function FinanceDashboard() {
  return (
    <DashboardLayout>
      <FinanceDashboardContent />
    </DashboardLayout>
  );
}
