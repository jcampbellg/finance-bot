import { $Enums } from '@prisma/client'

export const MAX_OWN_BOOKS = 5
export const MAX_BOOK_ACCESS = 10
export const MAX_ACCOUNTS = 5

export const TRANSACTION_TYPE: Record<$Enums.TransactionType, string> = {
  'DEPOSIT': 'Depósito',
  'EXPENSE': 'Gasto',
  'INCOME': 'Ingreso',
  'PAYMENT': 'Pago Fijo',
}