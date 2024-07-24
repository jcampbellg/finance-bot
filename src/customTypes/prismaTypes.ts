import { Prisma } from '@prisma/client'

export type UserWithAll = Prisma.UserGetPayload<{
  include: {
    bookSelected: true,
    books: true,
    conversation: true
  }
}>