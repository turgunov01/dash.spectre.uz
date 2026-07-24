// Domain model for the Spectre car-wash + bar ERP backend.
// Source of truth: FRONTEND.md (§5 enums, §6 endpoints). Money/qty are numbers, dates are ISO UTC strings, ids are integers.

/* ------------------------------------------------------------------ *
 * Enums (§5) — runtime arrays + derived union types for selects/badges
 * ------------------------------------------------------------------ */

export const ROLES = ['OWNER', 'ADMIN', 'CASHIER', 'WASHER', 'ACCOUNTANT', 'VALET', 'FINANCIER'] as const
export type Role = typeof ROLES[number]

export const ORDER_STATUSES = [
  'NEW', 'QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'PAID', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'
] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const PAYMENT_METHODS = ['CASH', 'CARD', 'CLICK', 'PAYME', 'TRANSFER', 'DEBT'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]

export const DISCOUNT_TYPES = ['PERCENT', 'FIXED', 'PERSONAL', 'PROMO', 'CERTIFICATE', 'PROMOTION', 'PACKAGE'] as const
export type DiscountType = typeof DISCOUNT_TYPES[number]

export const DISCOUNT_STATUSES = ['ACTIVE', 'BLOCKED', 'USED'] as const
export type DiscountStatus = typeof DISCOUNT_STATUSES[number]

export const PURCHASE_STATUSES = [
  'DRAFT', 'CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FUNDED', 'PURCHASED', 'RECEIVED', 'CLOSED'
] as const
export type PurchaseStatus = typeof PURCHASE_STATUSES[number]

export const STOCK_REASONS = ['PURCHASE', 'WASH', 'SPOILAGE', 'EXPIRY', 'RECIPE', 'SALE', 'ADJUST', 'MANUAL'] as const
export type StockReason = typeof STOCK_REASONS[number]

export const CASH_OP_TYPES = ['SALE', 'REFUND', 'PURCHASE', 'DEPOSIT', 'WITHDRAWAL'] as const
export type CashOpType = typeof CASH_OP_TYPES[number]

export const NOTIF_LEVELS = ['INFO', 'WARN', 'CRITICAL'] as const
export type NotifLevel = typeof NOTIF_LEVELS[number]

/* ------------------------------------------------------------------ *
 * Order status machine (§5) — allowed transitions for status buttons.
 * NOTE: PAID is reached ONLY via POST /orders/:id/pay, never /status,
 * so the UI must not surface PAID as a plain status button.
 * ------------------------------------------------------------------ */

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['QUEUED', 'ASSIGNED', 'CANCELLED'],
  QUEUED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'QUEUED', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
}

// Statuses shown as cards in the live queue (§4): NEW…READY. Terminal ones drop out.
export const QUEUE_STATUSES: OrderStatus[] = ['NEW', 'QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PAYMENT', 'PAID', 'READY']

/** Selectable status transitions for the UI (PAID excluded — that goes through /pay). */
export function statusTransitions(status: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status]?.filter(s => s !== 'PAID') ?? []
}

/* ------------------------------------------------------------------ *
 * Purchase lifecycle (§6.9) — named actions available per status.
 * CREATED→SUBMITTED→APPROVED→FUNDED→PURCHASED→RECEIVED→CLOSED, SUBMITTED→REJECTED.
 * ------------------------------------------------------------------ */

export type PurchaseAction = 'submit' | 'approve' | 'reject' | 'fund' | 'purchased' | 'receive' | 'close'

export const PURCHASE_ACTIONS: Record<PurchaseStatus, PurchaseAction[]> = {
  DRAFT: ['submit'],
  CREATED: ['submit'],
  SUBMITTED: ['approve', 'reject'],
  APPROVED: ['fund'],
  REJECTED: [],
  FUNDED: ['purchased'],
  PURCHASED: ['receive'],
  RECEIVED: ['close'],
  CLOSED: []
}

/* ------------------------------------------------------------------ *
 * RBAC (§3) — write-action → roles allowed (OWNER always passes, handled in store).
 * UI hides buttons by these; the backend is the final authority (403).
 * ------------------------------------------------------------------ */

export type PermissionAction =
  | 'references'
  | 'clients.write'
  | 'clients.delete'
  | 'cars.create'
  | 'orders.write'
  | 'orders.create'
  | 'orders.assign'
  | 'orders.take'
  | 'cash.session'
  | 'cash.money'
  | 'orders.refund'
  | 'discounts.crud'
  | 'discounts.apply'
  | 'stock.write'
  | 'purchases.write'
  | 'purchases.approve'
  | 'logs.write'
  | 'reports.view'
  | 'dashboard.view'
  | 'employees.create'
  | 'washers.create'
  | 'washers.delete'
  | 'telegram.users'
  | 'backup'

export const PERMISSIONS: Record<PermissionAction, Role[]> = {
  'references': ['ADMIN'],
  'clients.write': ['ADMIN', 'CASHIER', 'WASHER'],
  'clients.delete': ['ADMIN'],
  'cars.create': ['ADMIN'], // only admin adds cars to the DB; others use walk-in orders

  'orders.write': ['ADMIN', 'CASHIER', 'WASHER'],
  'orders.create': ['ADMIN'], // creating a car order is admin-only (cashier removed)
  'orders.assign': ['VALET'], // only the valet assigns washers (owner via god-mode)
  'orders.take': ['WASHER'],
  // Cash is off-limits to ADMIN. View: cashier/accountant/owner; open/close/pay: cashier(+owner);
  // money in/out & refund: owner only (OWNER short-circuits in the store).
  'cash.session': ['CASHIER'],
  'cash.money': ['ACCOUNTANT'], // deposit/withdraw — owner + accountant
  'orders.refund': ['ACCOUNTANT'], // refund — owner + accountant
  'discounts.crud': [], // owner only — admin can view + apply, not create/edit/delete
  'discounts.apply': ['ADMIN', 'CASHIER', 'WASHER'],
  'stock.write': ['ACCOUNTANT'], // owner + accountant only (warehouse)
  'purchases.write': ['ADMIN'],
  'purchases.approve': ['ADMIN'],
  'logs.write': ['ADMIN'],
  'reports.view': ['ACCOUNTANT', 'ADMIN'],
  'dashboard.view': ['ACCOUNTANT', 'ADMIN', 'CASHIER'],
  'employees.create': ['ACCOUNTANT'], // employees managed by owner + accountant
  'washers.create': ['ACCOUNTANT'], // owner + accountant add washers on the salary page
  'washers.delete': ['ACCOUNTANT'], // owner + accountant remove washers (dismissal)
  'telegram.users': ['ADMIN'],
  'backup': [] // OWNER only (OWNER short-circuits in the store)
}

/* ------------------------------------------------------------------ *
 * API envelopes
 * ------------------------------------------------------------------ */

export interface ApiList<T> {
  data: T[]
  count?: number
  unreadCount?: number
}

export interface ApiItem<T> {
  data: T
}

export interface ApiError {
  error: {
    status: number
    code: string
    message: string
    details?: Array<{ path: string, message: string }>
  }
}

/* ------------------------------------------------------------------ *
 * Auth (§2)
 * ------------------------------------------------------------------ */

export interface AuthUser {
  id: number
  email: string
  name: string | null
  role: Role
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

/* ------------------------------------------------------------------ *
 * Reference books (§6.1)
 * ------------------------------------------------------------------ */

export interface BodyType {
  id: number
  name: string
  sortOrder?: number
  isActive?: boolean
}

export interface ServiceCategory {
  id: number
  name: string
  sortOrder?: number
}

export interface ServicePrice {
  bodyTypeId: number
  price: number
  bodyType?: BodyType
}

export interface Service {
  id: number
  name: string
  categoryId?: number | null
  category?: ServiceCategory | null
  description?: string | null
  durationMin?: number | null
  isActive?: boolean
  prices?: ServicePrice[]
}

export interface PackageDiscount {
  bodyTypeId: number
  discountPercent: number
  bodyType?: BodyType
}

export interface ServicePackage {
  id: number
  name: string
  description?: string | null
  photoUrl?: string | null
  isActive?: boolean
  services?: Service[]
  serviceIds?: number[]
  discounts?: PackageDiscount[]
}

/* ------------------------------------------------------------------ *
 * Clients & cars (§6.2)
 * ------------------------------------------------------------------ */

export interface Client {
  id: number
  name: string
  phone?: string | null
  comment?: string | null
  cars?: Car[]
  _count?: { cars?: number, orders?: number }
}

export interface Car {
  id: number
  plate: string
  bodyTypeId: number
  bodyType?: BodyType
  make?: string | null
  model?: string | null
  clientId?: number | null
  client?: Client | null
  comment?: string | null
}

/* ------------------------------------------------------------------ *
 * Orders (§6.3)
 * ------------------------------------------------------------------ */

export type OrderItemType = 'SERVICE' | 'PACKAGE'

export interface OrderItem {
  id: number
  type: OrderItemType
  refId: number
  name?: string
  qty: number
  price: number
  total: number
}

/* Car-state photo captured at intake (приёмка) — see order.photos */
export interface OrderPhoto {
  id: number
  url: string
  createdAt?: string
}

export interface Order {
  id: number
  number?: string
  status: OrderStatus
  carId?: number | null
  car?: Car | null
  plate?: string | null
  make?: string | null
  model?: string | null
  clientId?: number | null
  client?: Client | null
  clientName?: string | null
  phone?: string | null
  bodyTypeId?: number | null
  bodyType?: BodyType | null
  assignedWasherId?: number | null
  assignedWasher?: AuthUser | null
  items?: OrderItem[]
  photos?: OrderPhoto[]
  subtotal?: number
  discountAmount?: number
  total: number
  comment?: string | null
  // Live-queue only (internal namespace):
  position?: number
  waitSec?: number
  createdAt?: string
  updatedAt?: string
}

/* Public board row (§4) — privacy-limited */
export interface PublicQueueRow {
  orderId: number
  plate: string
  status: OrderStatus
  position: number
}

/* ------------------------------------------------------------------ *
 * Cash, payments, refunds (§6.4)
 * ------------------------------------------------------------------ */

export interface CashSession {
  id: number
  openedAt: string
  closedAt?: string | null
  openingBalance: number
  closingBalance?: number | null
  cashierId?: number
  cashier?: AuthUser | null
  status?: 'OPEN' | 'CLOSED'
}

export interface CashBreakdown {
  method: PaymentMethod
  amount: number
}

export interface CashTotals {
  cashBalance: number
  salesTotal: number
  washTotal: number
  refundsTotal: number
  purchasesTotal: number
  breakdown?: CashBreakdown[]
}

export interface CashCurrent {
  session: CashSession
  totals: CashTotals
}

export interface CashOperation {
  id: number
  type: CashOpType
  amount: number
  method?: PaymentMethod | null
  comment?: string | null
  createdAt: string
}

export interface Payment {
  id: number
  orderId: number
  method: PaymentMethod
  amount: number
  createdAt: string
}

export interface Refund {
  id: number
  orderId: number
  method: PaymentMethod
  amount: number
  reason: string
  createdAt: string
}

/* ------------------------------------------------------------------ *
 * Discounts (§6.5)
 * ------------------------------------------------------------------ */

export interface Discount {
  id: number
  name: string
  type: DiscountType
  value: number
  code?: string | null
  status: DiscountStatus
  clientId?: number | null
  client?: Client | null
  startsAt?: string | null
  endsAt?: string | null
  oneTime?: boolean
  reason?: string | null
}

/* ------------------------------------------------------------------ *
 * Stock (§6.7)
 * ------------------------------------------------------------------ */

export interface StockCategory {
  id: number
  name: string
}

export interface StockBatch {
  id: number
  qty: number
  expiresAt?: string | null
  receivedAt?: string
  note?: string | null
}

export interface StockItem {
  id: number
  name: string
  categoryId?: number | null
  category?: StockCategory | null
  unit?: string | null
  minQty?: number | null
  qty?: number
  lowStock?: boolean
  batches?: StockBatch[]
  movements?: StockMovement[]
}

export interface StockMovement {
  id: number
  stockItemId: number
  stockItem?: StockItem
  qty: number
  reason: StockReason
  comment?: string | null
  photoUrl?: string | null
  createdAt: string
}

/* ------------------------------------------------------------------ *
 * Purchases & suppliers (§6.9)
 * ------------------------------------------------------------------ */

export interface Supplier {
  id: number
  name: string
  phone?: string | null
  comment?: string | null
}

export interface PurchaseItem {
  id: number
  name: string
  stockItemId?: number | null
  unit?: string | null
  qty: number
  estPrice: number
  actualPrice?: number | null
  actualQty?: number | null
  expiresAt?: string | null
  photoUrl?: string | null
}

export interface Purchase {
  id: number
  status: PurchaseStatus
  supplierId?: number | null
  supplier?: Supplier | null
  reason?: string | null
  comment?: string | null
  estimatedTotal?: number
  actualTotal?: number
  items?: PurchaseItem[]
  createdAt?: string
}

/* ------------------------------------------------------------------ *
 * Notifications, reports, logs, files (§6.10 / §7)
 * ------------------------------------------------------------------ */

export interface Notification {
  id: number
  level: NotifLevel
  type?: string
  title?: string
  message: string
  read?: boolean
  createdAt: string
}

export interface TelegramUser {
  id: number
  chatId: string
  label?: string | null
}

export interface LogEntry {
  id: number
  entity: string
  entityId?: number
  action: string
  level: NotifLevel
  message?: string
  userId?: number
  user?: AuthUser | null
  createdAt: string
}

export interface FileUpload {
  url: string
  filename: string
  size: number
  mime: string
}

export interface DailyReport {
  date: string
  financial?: Record<string, number>
  wash?: Record<string, number>
  warehouse?: Record<string, number>
  tops?: Record<string, unknown>
  [key: string]: unknown
}

export interface WasherSalaryRow {
  washerId: number
  name: string
  cars: number
  rate: number
  salary: number
}

export interface WasherSalaryReport {
  from: string
  to: string
  rate: number
  washers: WasherSalaryRow[]
  totals: { cars: number, salary: number }
}

/** One car a washer was assigned (audit detail for payroll). */
export interface WasherCar {
  assignmentId: number
  assignedAt: string
  method: string
  orderNumber: string
  plate: string
  status: OrderStatus
}

export interface DashboardStats {
  cash?: CashTotals | null
  turnover?: number
  queue?: { total?: number, byStatus?: Partial<Record<OrderStatus, number>> }
  lowStock?: number
  activePurchases?: number
  [key: string]: unknown
}

/* ------------------------------------------------------------------ *
 * Typed page meta — role gate consumed by middleware/auth.global.ts
 * ------------------------------------------------------------------ */

declare module '#app' {
  interface PageMeta {
    roles?: Role[]
  }
}

export {}
