import { Prisma } from '@prisma/client'

export type LimitsWithAmount = Prisma.LimitGetPayload<{
  include: { amount: true }
}>

export type ExpenseWithAmount = Prisma.ExpenseGetPayload<{
  include: { amount: true }
}>

export type ExpenseWithAmountAndAccount = Prisma.ExpenseGetPayload<{
  include: { amount: true, account: true }
}>

export type ExpenseWithAmountAndCategory = Prisma.ExpenseGetPayload<{
  include: { amount: true, category: true }
}>

export type ExpenseWithAmountAccountAndCategory = Prisma.ExpenseGetPayload<{
  include: { amount: true, category: true, account: true }
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

export type CategoryWithLimitsAndFiles = Prisma.CategoryGetPayload<{
  include: {
    files: true,
    limits: {
      include: {
        amount: true,
      },
    }
  }
}>

export type CategoryWithLimitsAndExpenses = Prisma.CategoryGetPayload<{
  include: {
    limits: {
      include: {
        amount: true
      }
    },
    expenses: {
      include: {
        amount: true
        account: true
      }
    }
  }
}>

export type IncomeWithSalary = Prisma.IncomeGetPayload<{
  include: {
    salary: {
      include: {
        amount: true
      }
    }
  }
}>