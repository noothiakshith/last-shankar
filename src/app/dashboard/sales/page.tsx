'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { SalesDashboardContent } from '@/components/dashboards/SalesDashboardContent';

export default function SalesDashboard() {
  return (
    <DashboardLayout>
      <SalesDashboardContent />
    </DashboardLayout>
  );
}
