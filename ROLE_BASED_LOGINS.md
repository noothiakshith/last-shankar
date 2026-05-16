# Role-Based Login Credentials

All demo accounts for NexisERP with role-specific access.

## 🔐 Login Credentials

All passwords are: `password`

### 👑 ADMIN
- **Email**: `admin@nexiserp.com`
- **Password**: `password`
- **Access**: Full system access, all dashboards
- **Department**: IT

### 📊 SALES ANALYST
- **Email**: `sales@nexiserp.com`
- **Password**: `password`
- **Name**: Sam Sales
- **Access**: Sales dashboard, forecast management, CSV upload
- **Department**: Sales

### 🏭 PRODUCTION PLANNER
- **Email**: `paula@nexiserp.com`
- **Password**: `password`
- **Name**: Paula Planner
- **Access**: Production dashboard, production authorization
- **Department**: Production

### 📦 INVENTORY MANAGER
- **Email**: `ivan@nexiserp.com`
- **Password**: `password`
- **Name**: Ivan Inventory
- **Access**: Inventory dashboard, material management
- **Department**: Warehouse

### 🛒 PROCUREMENT OFFICER
- **Email**: `oscar@nexiserp.com`
- **Password**: `password`
- **Name**: Oscar Procurement
- **Access**: Procurement dashboard, supplier management, PO creation
- **Department**: Procurement

### 💰 FINANCE MANAGER
- **Email**: `fiona@nexiserp.com`
- **Password**: `password`
- **Name**: Fiona Finance
- **Access**: Finance dashboard, budget management, PO approval
- **Department**: Finance

### 👔 EXECUTIVE
- **Email**: `eve@nexiserp.com`
- **Password**: `password`
- **Name**: Eve Executive
- **Access**: Executive dashboard, high-level overview
- **Department**: Executive

---

## 🔄 Workflow Roles

### Approval Gates by Role:

1. **SALES_ANALYST**: Approves forecasts
2. **FINANCE_MANAGER**: Approves purchase orders (PO_APPROVAL gate)
3. **PRODUCTION_PLANNER**: Authorizes production (PRODUCTION_AUTHORIZATION gate)

### Typical Workflow:

1. **Sales Analyst** uploads CSV → generates forecast → approves forecast
2. System creates workflow → generates POs
3. **Finance Manager** reviews and approves POs in batches
4. **Production Planner** authorizes production
5. **Procurement Officer** manages suppliers and PO execution
6. **Inventory Manager** tracks materials and stock levels

---

## 🎯 Testing Different Roles

### To test Finance Manager batch PO approval:
1. Login as `fiona@nexiserp.com` / `password`
2. Go to Finance Dashboard
3. See PO batches grouped by workflow
4. Select POs and approve/reject

### To test Sales Analyst forecast:
1. Login as `sales@nexiserp.com` / `password`
2. Go to Sales Dashboard
3. Upload CSV file
4. Review and approve forecast

### To test Production Authorization:
1. Login as `paula@nexiserp.com` / `password`
2. Go to Orchestrator Dashboard
3. Find workflows in PENDING_PRODUCTION_AUTH state
4. Authorize production

---

## 📝 Notes

- All accounts are created during database seeding (`npm run seed`)
- Passwords are hashed with bcrypt
- JWT tokens expire after 24 hours (configurable via `JWT_TTL` env var)
- Role-based access control is enforced at API level via `withAuth()` middleware
- ADMIN role has access to all endpoints regardless of role restrictions

---

## 🔧 Technical Details

### Role Enum (from Prisma schema):
```prisma
enum Role {
  ADMIN
  SALES_ANALYST
  PRODUCTION_PLANNER
  INVENTORY_MANAGER
  PROCUREMENT_OFFICER
  FINANCE_MANAGER
  EXECUTIVE
}
```

### Authentication Flow:
1. User submits credentials via login form
2. NextAuth validates against database (bcrypt comparison)
3. JWT token issued with user ID, email, and role
4. Token stored in session cookie
5. Protected routes check token and role via middleware
6. API endpoints use `withAuth()` to enforce role-based access

---

**Last Updated**: May 13, 2026
