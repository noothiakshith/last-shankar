'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { InventoryDashboardContent } from '@/components/dashboards/InventoryDashboardContent';

export default function InventoryDashboard() {
  return (
    <DashboardLayout>
      <InventoryDashboardContent />
    </DashboardLayout>
  );
}
