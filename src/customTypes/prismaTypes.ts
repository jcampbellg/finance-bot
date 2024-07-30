import { $Enums, Book, Conversation, Prisma, Role, User } from '@prisma/client'

export type RoleWithUser = Prisma.RoleGetPayload<{
  include: {
    user: true
  }
}>

export type BookWithRole = Book & {
  role: Role
}

export type BookWithRolesAndOwner = Book & {
  role: Role
  roles: RoleWithUser[]
  owner: User
  isSelected: boolean
}

export type ConversationWithEdit = Conversation & { edit: Edit }

export type ConversationUpdateInput = Omit<Prisma.ConversationUpdateInput, 'id' | 'edit'> & {
  edit?: Edit | {}
}

export type TransactionCreateInput = Pick<Prisma.TransactionCreateArgs['data'], 'description' | 'amount' | 'currency' | 'accountId'>

export type Edit = {
  bookId?: string
  description?: string
  amount?: number
  currency?: string
  accountId?: string
  categoryId?: string
}

export type ByncUser = User & {
  conversation: ConversationWithEdit
  bookSelected: BookWithRole | null
  books: BookWithRole[]
  canPrepareBudget: boolean
}

export type RoleCreate = {
  bookId: string
  toUserId: string
  role: $Enums.Permission
}

export type AccountWithBookAndCurrency = Prisma.AccountGetPayload<{
  include: {
    book: true,
    currency: {
      include: { balance: true }
    }
  }
}>