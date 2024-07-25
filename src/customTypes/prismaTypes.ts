import { Book, Prisma, Role, User } from '@prisma/client'

export type BookWithRole = Book & {
  role: Role
}

export type BookWithRoleAndOwner = Book & {
  role: Role
  owner: User
}

export type ByncUser = Prisma.UserGetPayload<{
  include: {
    books: true,
    conversation: true
  }
}> & {
  bookSelected: BookWithRole | null
}