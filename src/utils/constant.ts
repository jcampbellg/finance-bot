import { Edit } from '@customTypes/prismaTypes'

export const MAX_OWN_BOOKS = 5
export const MAX_BOOK_ACCESS = 10
export const MAX_ACCOUNTS = 5

export const TRANS_SUBJECT: Record<string, Edit['type']> = {
  trans_deposit_new: 'deposit',
  trans_expense_new: 'expense',
  trans_income_new: 'income',
  trans_payment_new: 'payment',
  trans_transfer_new: 'transfer'
}