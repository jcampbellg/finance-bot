import { Conversation, Prisma, $Enums } from '@prisma/client'

export type Edit = {
  bookId?: string
  description?: string
  amount?: number
  currency?: string
  accountId?: string
  categoryId?: string
  transactionId?: string
  type?: $Enums.TransactionType
  objectId?: string
}

export type ConversationWithEdit = Omit<Conversation, 'edit'> & { edit: Edit }

export type ConversationUpdateInput = Omit<Prisma.ConversationUpdateInput, 'id' | 'edit'> & {
  edit?: Edit | {}
}

export type ByncUser = Prisma.UserGetPayload<{
  include: {
    booksOwn: true,
    booksAccess: {
      include: {
        book: true
      }
    }
  }
}> & {
  bookSelected: BookWithOwner | null
  conversation: ConversationWithEdit
}

export type BookWithOwner = Prisma.BookGetPayload<{
  include: {
    owner: true
  }
}> & {
  isOwner: boolean
}

export type BookWithOwnerAndShares = Prisma.BookGetPayload<{
  include: {
    owner: true,
    shares: {
      include: { user: true }
    }
  }
}> & {
  isOwner: boolean
}

type UserUpdateInput = Omit<Prisma.UserUpdateInput, 'id' | 'telegramId'>
type UserUncheckedUpdateInput = Omit<Prisma.UserUncheckedUpdateInput, 'id' | 'telegramId'>
export type UserUpdate = Prisma.XOR<UserUpdateInput, UserUncheckedUpdateInput>

type BookUpdateInput = Omit<Prisma.BookUpdateInput, 'id'>
type BookUncheckedUpdateInput = Omit<Prisma.BookUncheckedUpdateInput, 'id'>
export type BookUpdate = Prisma.XOR<BookUpdateInput, BookUncheckedUpdateInput>

export type AccountWithBalance = Prisma.AccountGetPayload<{
  include: { currency: { include: { balance: true } } }
}>

export type TransactionWithAll = Prisma.TransactionGetPayload<{
  include: {
    account: { include: { currency: true } },
    category: true,
    files: true,
    groupNotifications: true,
    splits: true,
    transferIn: true,
    transferOut: true
  }
}>

type TransactionCreateInput = Omit<Prisma.TransactionCreateInput, 'id'>
type TransactionUncheckedCreateInput = Omit<Prisma.TransactionUncheckedCreateInput, 'id'>
export type TransactionCreate = Prisma.XOR<TransactionCreateInput, TransactionUncheckedCreateInput>

type TransactionUpdateInput = Omit<Prisma.TransactionUpdateInput, 'id'>
type TransactionUncheckedUpdateInput = Omit<Prisma.TransactionUncheckedUpdateInput, 'id'>
export type TransactionUpdate = Prisma.XOR<TransactionUpdateInput, TransactionUncheckedUpdateInput>

type FileCreateInput = Omit<Prisma.FileCreateInput, 'id'>
type FileUncheckedCreateInput = Omit<Prisma.FileUncheckedCreateInput, 'id'>
export type FileCreate = Prisma.XOR<FileCreateInput, FileUncheckedCreateInput>

export type Payment = Prisma.CategoryGetPayload<{
  include: {
    limits: true,
  }
}>

export type CurrencyWithBalance = Prisma.CurrencyGetPayload<{
  include: {
    balance: true,
    account: true
  }
}>