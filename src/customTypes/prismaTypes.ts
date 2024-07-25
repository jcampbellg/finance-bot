import { Book, Prisma, Role } from '@prisma/client'

export type BookWithRole = Book & {
  role: Role
}

export type ByncUser = Prisma.UserGetPayload<{
  include: {
    books: true,
    conversation: true
  }
}> & {
  bookSelected: BookWithRole | null
}