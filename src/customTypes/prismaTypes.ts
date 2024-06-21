import { Prisma } from '@prisma/client'

export type LimitsWithAmount = Prisma.LimitGetPayload<{
  include: { amount: true }
}>

export type ExpenseWithAmount = Prisma.ExpenseGetPayload<{
  include: { amount: true }
}>

export type ExpenseWithAll = Prisma.ExpenseGetPayload<{
  include: {
    account: true,
    amount: true,
    category: true,
    createdBy: true,
    files: true
  }
}>