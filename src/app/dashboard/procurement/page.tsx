'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { ProcurementDashboardContent } from '@/components/dashboards/ProcurementDashboardContent';

export default function ProcurementDashboard() {
  return (
    <DashboardLayout>
      <ProcurementDashboardContent />
    </DashboardLayout>
  );
}
