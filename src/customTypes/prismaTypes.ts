import { Conversation, Prisma } from '@prisma/client'

export type Edit = {
  bookId?: string
  description?: string
  amount?: number
  currency?: string
  accountId?: string
  categoryId?: string
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

type UserUpdateInput = Omit<Prisma.UserUpdateInput, 'id' | 'telegramId'>
type UserUncheckedUpdateInput = Omit<Prisma.UserUncheckedUpdateInput, 'id' | 'telegramId'>
export type UserUpdate = Prisma.XOR<UserUpdateInput, UserUncheckedUpdateInput>

type BookUpdateInput = Omit<Prisma.BookUpdateInput, 'id'>
type BookUncheckedUpdateInput = Omit<Prisma.BookUncheckedUpdateInput, 'id'>
export type BookUpdate = Prisma.XOR<BookUpdateInput, BookUncheckedUpdateInput>