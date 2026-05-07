'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { OrchestratorDashboardContent } from '@/components/dashboards/OrchestratorDashboardContent';

export default function OrchestratorDashboard() {
  return (
    <DashboardLayout>
      <OrchestratorDashboardContent />
    </DashboardLayout>
  );
}
