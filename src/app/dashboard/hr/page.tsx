'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { HRDashboardContent } from '@/components/dashboards/HRDashboardContent';

export default function HRDashboard() {
  return (
    <DashboardLayout>
      <HRDashboardContent />
    </DashboardLayout>
  );
}
