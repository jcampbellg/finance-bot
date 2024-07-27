import { $Enums, Book, Prisma, Role, User } from '@prisma/client'

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

export type ByncUser = Prisma.UserGetPayload<{
  include: {
    conversation: true
  }
}> & {
  bookSelected: BookWithRole | null
  books: BookWithRole[]
  canPrepareBudget: boolean
}

export type RoleCreate = {
  bookId: string
  toUserId: string
  role: $Enums.Permission
}