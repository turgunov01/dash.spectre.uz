// Formatting + label/color maps for Spectre domain values. Auto-imported (app/utils).
import type {
  CashOpType,
  DiscountStatus,
  DiscountType,
  NotifLevel,
  OrderStatus,
  PaymentMethod,
  PurchaseStatus,
  Role,
  StockReason
} from '~/types/spectre'

export type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const moneyFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** Money is a plain number of сум (§1). Renders "373 000 сум". */
export function formatMoney(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${moneyFmt.format(value)} сум`
}

/** Number without the currency suffix (for compact stats). */
export function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return moneyFmt.format(value)
}

function toDate(iso?: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDate(iso?: string | null): string {
  const d = toDate(iso)
  if (!d) return '—'
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function formatDateTime(iso?: string | null): string {
  const d = toDate(iso)
  if (!d) return '—'
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTime(iso?: string | null): string {
  const d = toDate(iso)
  if (!d) return '—'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "5 мин", "1 ч 20 мин" from a seconds count (queue waitSec). */
export function formatWait(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || seconds < 0) return '—'
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  return `${h} ч ${m % 60} мин`
}

/* --------------------------- Labels (RU) --------------------------- */

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  CASHIER: 'Кассир',
  WASHER: 'Мойщик',
  ACCOUNTANT: 'Бухгалтер',
  VALET: 'Перегонщик',
  FINANCIER: 'Финансист'
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'Новый',
  QUEUED: 'В очереди',
  ASSIGNED: 'Назначен',
  IN_PROGRESS: 'В работе',
  AWAITING_PAYMENT: 'Ждёт оплаты',
  PAID: 'Оплачен',
  READY: 'Готов',
  DELIVERED: 'Выдан',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён'
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, BadgeColor> = {
  NEW: 'neutral',
  QUEUED: 'info',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  AWAITING_PAYMENT: 'warning',
  PAID: 'success',
  READY: 'success',
  DELIVERED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'error'
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Наличные',
  CARD: 'Карта',
  CLICK: 'Click',
  PAYME: 'Payme',
  TRANSFER: 'Перечисление',
  DEBT: 'В долг'
}

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = {
  PERCENT: 'Процент',
  FIXED: 'Фикс. сумма',
  PERSONAL: 'Персональная',
  PROMO: 'Промокод',
  CERTIFICATE: 'Сертификат',
  PROMOTION: 'Акция',
  PACKAGE: 'Пакет'
}

export const DISCOUNT_STATUS_LABEL: Record<DiscountStatus, string> = {
  ACTIVE: 'Активна',
  BLOCKED: 'Заблокирована',
  USED: 'Использована'
}

export const DISCOUNT_STATUS_COLOR: Record<DiscountStatus, BadgeColor> = {
  ACTIVE: 'success',
  BLOCKED: 'error',
  USED: 'neutral'
}

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  DRAFT: 'Черновик',
  CREATED: 'Создана',
  SUBMITTED: 'На согласовании',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
  FUNDED: 'Профинансирована',
  PURCHASED: 'Закуплена',
  RECEIVED: 'Оприходована',
  CLOSED: 'Закрыта'
}

export const PURCHASE_STATUS_COLOR: Record<PurchaseStatus, BadgeColor> = {
  DRAFT: 'neutral',
  CREATED: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'info',
  REJECTED: 'error',
  FUNDED: 'warning',
  PURCHASED: 'warning',
  RECEIVED: 'success',
  CLOSED: 'success'
}

export const PURCHASE_ACTION_LABEL: Record<string, string> = {
  submit: 'На согласование',
  approve: 'Одобрить',
  reject: 'Отклонить',
  fund: 'Профинансировать',
  purchased: 'Отметить закупку',
  receive: 'Оприходовать',
  close: 'Закрыть'
}

export const CASH_OP_TYPE_LABEL: Record<CashOpType, string> = {
  SALE: 'Продажа',
  REFUND: 'Возврат',
  PURCHASE: 'Закупка',
  DEPOSIT: 'Внесение',
  WITHDRAWAL: 'Изъятие'
}

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  PURCHASE: 'Закупка',
  WASH: 'Мойка',
  SPOILAGE: 'Порча',
  EXPIRY: 'Истёк срок',
  RECIPE: 'Рецептура',
  SALE: 'Продажа',
  ADJUST: 'Корректировка',
  MANUAL: 'Вручную'
}

export const NOTIF_LEVEL_COLOR: Record<NotifLevel, BadgeColor> = {
  INFO: 'info',
  WARN: 'warning',
  CRITICAL: 'error'
}

export const NOTIF_LEVEL_LABEL: Record<NotifLevel, string> = {
  INFO: 'Инфо',
  WARN: 'Внимание',
  CRITICAL: 'Критично'
}

/* ------------------------- Error envelope ------------------------- */

/** Pull a human message out of a thrown $fetch error (§1 error envelope). */
/** Human-readable wait hint for a rate-limited response (uses invariant "сек."/"мин." — no plural forms). */
function formatRetryWait(sec?: number): string {
  if (!sec || sec <= 0) return 'Попробуйте позже.'
  if (sec < 60) return `Подождите ${sec} сек.`
  return `Подождите ${Math.ceil(sec / 60)} мин.`
}

export function apiErrorMessage(err: unknown, fallback = 'Произошла ошибка'): string {
  const error = (err as { data?: { error?: { message?: string, code?: string, retryAfterSec?: number } } })?.data?.error
  // Rate limiting (429) — show a precise, localized wait time from the backend.
  if (error?.code === 'RATE_LIMITED') {
    return `Слишком много попыток. ${formatRetryWait(error.retryAfterSec)}`
  }
  if (error?.message) return error.message
  const msg = (err as { message?: string })?.message
  return msg || fallback
}

/** Field-level validation errors (code: "VALIDATION"). */
export function apiErrorDetails(err: unknown): Array<{ path: string, message: string }> {
  const details = (err as { data?: { error?: { details?: Array<{ path: string, message: string }> } } })?.data?.error?.details
  return Array.isArray(details) ? details : []
}
