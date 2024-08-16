import { $Enums } from '@prisma/client'

export const MAX_OWN_BOOKS = 5
export const MAX_ACCOUNTS = 6
export const MAX_INCOMES = 5
export const MAX_PAYMENTS = 50
export const MAX_CATEGORIES = 50
export const MAX_FILES = 5

export const TRANSACTION_TYPE: Record<$Enums.TransactionType, string> = {
  'DEPOSIT': '🟢 Depósito',
  'EXPENSE': '🔴 Gasto',
  'INCOME': '🤑 Ingreso',
  'PAYMENT': '💵 Pago Fijo',
  'TRANSFER_IN': '🟢 Transferencia',
  'TRANSFER_OUT': '🔴 Transferencia'
}

export const TRANSACTION_TYPE_ICON: Record<$Enums.TransactionType, string> = {
  'DEPOSIT': '🟢',
  'EXPENSE': '🔴',
  'INCOME': '🤑',
  'PAYMENT': '💵',
  'TRANSFER_IN': '🟢',
  'TRANSFER_OUT': '🔴'
}

export const FILL_COLOR = '#d3d3d3'
export const LABEL_COLOR = '#5e5e5e'