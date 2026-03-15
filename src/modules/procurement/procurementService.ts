import prisma from '@/lib/prisma';
import { POStatus } from '@prisma/client';
import { orchestratorService } from '@/modules/orchestrator/orchestratorService';
import { inventoryService } from '@/modules/inventory/inventoryService';
import { ApprovalGateType, Role } from '@prisma/client';

export interface Supplier {
  id: string;
  name: string;
  leadTimeDays: number;
  unitCost: number;
}

export interface CreatePOInput {
  supplierId: string;
  materialId: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  materialId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  status: POStatus;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  deliveredAt: Date | null;
}

export class ProcurementService {
  /**
   * Find qualified suppliers for a material.
   * Returns only suppliers that have a SupplierMaterial record for the material.
   * 
   * Requirements: 9.1
   */
  async findSuppliers(materialId: string): Promise<Supplier[]> {
    // Verify material exists
    const material = await prisma.material.findUnique({
      where: { id: materialId }
    });

    if (!material) {
      throw new Error(`Material ${materialId} not found`);
    }

    // Query SupplierMaterial join to get qualified suppliers
    const supplierMaterials = await prisma.supplierMaterial.findMany({
      where: { materialId },
      include: {
        supplier: true
      }
    });

    // Map to Supplier interface with unitCost
    return supplierMaterials.map(sm => ({
      id: sm.supplier.id,
      name: sm.supplier.name,
      leadTimeDays: sm.supplier.leadTimeDays,
      unitCost: sm.unitCost
    }));
  }

  /**
   * Create a purchase order with status DRAFT.
   * Computes totalCost = quantity × unitCost.
   * 
   * Requirements: 9.2
   */
  async createPurchaseOrder(po: CreatePOInput): Promise<PurchaseOrder> {
    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: po.supplierId }
    });

    if (!supplier) {
      throw new Error(`Supplier ${po.supplierId} not found`);
    }

    // Verify material exists
    const material = await prisma.material.findUnique({
      where: { id: po.materialId }
    });

    if (!material) {
      throw new Error(`Material ${po.materialId} not found`);
    }

    // Verify supplier is qualified for this material
    const supplierMaterial = await prisma.supplierMaterial.findUnique({
      where: {
        supplierId_materialId: {
          supplierId: po.supplierId,
          materialId: po.materialId
        }
      }
    });

    if (!supplierMaterial) {
      throw new Error(`Supplier ${po.supplierId} is not qualified for material ${po.materialId}`);
    }

    // Compute total cost
    const totalCost = po.quantity * po.unitCost;

    // Create PO with DRAFT status
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        supplierId: po.supplierId,
        materialId: po.materialId,
        quantity: po.quantity,
        unitCost: po.unitCost,
        totalCost,
        status: POStatus.DRAFT
      }
    });

    return purchaseOrder;
  }

  /**
   * Get purchase order status.
   * 
   * Requirements: 9.3
   */
  async getPOStatus(poId: string): Promise<PurchaseOrder> {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId }
    });

    if (!po) {
      throw new Error(`Purchase order ${poId} not found`);
    }

    return po;
  }

  /**
   * Get all pending purchase orders.
   * 
   * Requirements: 9.3
   */
  async getPendingPOs(): Promise<PurchaseOrder[]> {
    return prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: [POStatus.DRAFT, POStatus.PENDING_APPROVAL, POStatus.APPROVED, POStatus.ORDERED]
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Submit a purchase order for approval.
   * Sets status to PENDING_APPROVAL and requests PO_APPROVAL gate from orchestrator.
   * 
   * Requirements: 9.4
   */
  async submitPOForApproval(poId: string, workflowRunId?: string): Promise<PurchaseOrder> {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId }
    });

    if (!po) {
      throw new Error(`Purchase order ${poId} not found`);
    }

    if (po.status !== POStatus.DRAFT) {
      throw new Error(`Purchase order ${poId} is not in DRAFT status`);
    }

    // Update PO status to PENDING_APPROVAL
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: POStatus.PENDING_APPROVAL }
    });

    // Request approval gate from orchestrator only if explicit context provided
    if (workflowRunId) {
      await orchestratorService.requestApproval(
        workflowRunId,
        ApprovalGateType.PO_APPROVAL,
        Role.FINANCE_MANAGER
      );
    }

    return updatedPO;
  }

  /**
   * Confirm delivery of a purchase order.
   * Sets PO status to DELIVERED and triggers inventory stock update.
   * 
   * Requirements: 9.5, 9.6
   */
  async confirmDelivery(poId: string, receivedQty: number): Promise<PurchaseOrder> {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId }
    });

    if (!po) {
      throw new Error(`Purchase order ${poId} not found`);
    }

    if (po.status !== POStatus.APPROVED && po.status !== POStatus.ORDERED) {
      throw new Error(`Purchase order ${poId} is not in APPROVED or ORDERED status`);
    }

    // Update PO status to DELIVERED
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: POStatus.DELIVERED,
        deliveredAt: new Date()
      }
    });

    // Trigger inventory stock update with received quantity
    await inventoryService.updateStock(
      po.materialId,
      receivedQty,
      'PO_DELIVERY',
      poId
    );

    return updatedPO;
  }

  /**
   * Reject a purchase order.
   * Sets PO status to REJECTED.
   * 
   * Requirements: 9.6
   */
  async rejectPO(poId: string): Promise<PurchaseOrder> {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId }
    });

    if (!po) {
      throw new Error(`Purchase order ${poId} not found`);
    }

    // Update PO status to REJECTED
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: POStatus.REJECTED }
    });

    return updatedPO;
  }
}

export const procurementService = new ProcurementService();
