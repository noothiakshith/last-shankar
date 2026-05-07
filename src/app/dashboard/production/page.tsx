'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { ProductionDashboardContent } from '@/components/dashboards/ProductionDashboardContent';

export default function ProductionDashboard() {
  return (
    <DashboardLayout>
      <ProductionDashboardContent />
    </DashboardLayout>
  );
}
