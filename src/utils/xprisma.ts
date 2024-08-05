import { AccountWithBalance, BookUpdate, BookWithOwner, BookWithOwnerAndShares, ByncUser, Category, ConversationUpdateInput, CurrencyWithBalance, Edit, FileCreate, PaymentIncome, TransactionCreate, TransactionUpdate, TransactionWithAll, UserUpdate } from '@customTypes/prismaTypes'
import { PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

const prisma = new PrismaClient()

const userInclude = {
  bookSelected: { include: { owner: true, shares: true } },
  booksOwn: true,
  booksAccess: { include: { book: true } },
  conversation: true
}

const accountInclude = { currency: { include: { balance: true } } }

const transactionInclude = {
  account: { include: { currency: true } },
  category: true,
  files: { include: { items: true } },
  groupNotifications: true,
  splits: true,
  transferIn: true,
  transferOut: true
}

const paymentIncomeInclude = { limits: true, transactions: true }

const categoryInclude = { limits: true, transactions: true, split: { include: { transaction: true } } }

const xprisma = prisma.$extends({
  model: {
    user: {
      async auth(chatId: number): Promise<ByncUser> {
        const user = await prisma.user.upsert({
          where: {
            telegramId: chatId
          },
          create: {
            timezone: '',
            telegramId: chatId,
            conversation: {
              create: {
                subject: 'start',
                subSubject: 'country'
              }
            }
          },
          update: {},
          include: userInclude
        })

        const isOwner = user.booksOwn.length > 0

        const bookSelected = !!user.bookSelected ? { ...user.bookSelected, isOwner } : null

        let clearBookSelected = false

        if (bookSelected) {
          const notOwnerNorShare = !isOwner && !bookSelected.shares.find(share => share.userId === user.id)

          if (notOwnerNorShare) {
            await prisma.user.update({ where: { id: user.id }, data: { bookSelectedId: null } })
            clearBookSelected = true
          }
        }

        return {
          ...user,
          bookSelected: clearBookSelected ? null : (user.bookSelected ? { ...user.bookSelected, isOwner } : null),
          conversation: {
            ...user.conversation,
            edit: user.conversation.edit as Edit
          }
        }
      },
      async update(chatId: number, data: UserUpdate): Promise<ByncUser> {
        const user = await prisma.user.update({
          where: {
            telegramId: chatId
          },
          data: data,
          include: userInclude
        })

        const isOwner = !!user.booksOwn.find(book => book.id === user.bookSelected?.id)

        return {
          ...user,
          bookSelected: user.bookSelected ? { ...user.bookSelected, isOwner } : null,
          conversation: {
            ...user.conversation,
            edit: user.conversation.edit as Edit
          }
        }
      },
      async findUnique(id: string) {
        const user = await prisma.user.findUnique({
          where: { id }
        })

        return user
      }
    },
    conversation: {
      async newSubject(id: string, data: Pick<ConversationUpdateInput, 'subject' | 'subSubject'>) {
        return await prisma.conversation.update({
          where: {
            id: id
          },
          data: {
            edit: {},
            subject: data.subject,
            subSubject: !!data.subSubject ? data.subSubject : ''
          }
        })
      },
      async update(id: string, data: ConversationUpdateInput) {
        return await prisma.conversation.update({
          where: {
            id: id
          },
          data: data
        })
      },
      async waiting(id: string) {
        return await prisma.conversation.update({
          where: {
            id: id
          },
          data: {
            subject: 'waiting',
            subSubject: '',
            edit: {}
          }
        })
      }
    },
    book: {
      async create(user: ByncUser, title: string): Promise<BookWithOwner> {
        const book = await prisma.book.create({
          data: {
            title: title,
            ownerId: user.id
          },
          include: { owner: true }
        })

        return {
          ...book,
          isOwner: true
        }
      },
      async findMany(user: ByncUser): Promise<BookWithOwner[]> {
        const books = await prisma.book.findMany({
          where: {
            OR: [
              { ownerId: user.id },
              { shares: { some: { userId: user.id } } }
            ]
          },
          include: { owner: true }
        })

        return books.map(book => ({
          ...book,
          isOwner: book.ownerId === user.id
        }))
      },
      async findUnique(user: ByncUser, id: string): Promise<BookWithOwnerAndShares | null> {
        const book = await prisma.book.findUnique({
          where: { id },
          include: { owner: true, shares: { include: { user: true } } }
        })

        if (!book) {
          return null
        }

        const isShare = book.shares.some(share => share.userId === user.id)
        const isOwner = book.ownerId === user.id

        if (!isShare && !isOwner) {
          return null
        }

        return {
          ...book,
          isOwner
        }
      },
      async update(user: ByncUser, id: string, data: BookUpdate): Promise<BookWithOwner | null> {
        const book = await prisma.book.findUnique({
          where: { id },
          include: { owner: true, shares: true }
        })

        if (!book) {
          return null
        }

        const isShare = book.shares.some(share => share.userId === user.id)
        const isOwner = book.ownerId === user.id

        if (!isShare && !isOwner) {
          return null
        }

        const updatedBook = await prisma.book.update({
          where: { id },
          data,
          include: { owner: true }
        })

        return {
          ...updatedBook,
          isOwner
        }
      },
      async delete(user: ByncUser, id: string): Promise<boolean> {
        const book = await prisma.book.findUnique({
          where: { id },
          include: { owner: true, shares: true }
        })

        if (!book) {
          return false
        }

        const isShare = book.shares.some(share => share.userId === user.id)
        const isOwner = book.ownerId === user.id

        if (!isShare && !isOwner) {
          // User is not owner nor have access to book
          return false
        }

        if (isOwner) {
          await prisma.split.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.file.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.transfer.deleteMany({ where: { OR: [{ transactionOut: { account: { bookId: id } } }, { transactionIn: { account: { bookId: id } } }] } })
          await prisma.item.deleteMany({ where: { file: { transaction: { account: { bookId: id } } } } })
          await prisma.groupNotification.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.transaction.deleteMany({ where: { account: { bookId: id } } })
          await prisma.balance.deleteMany({ where: { currency: { account: { bookId: id } } } })
          await prisma.currency.deleteMany({ where: { account: { bookId: id } } })
          await prisma.account.deleteMany({ where: { bookId: id } })
          await prisma.limit.deleteMany({ where: { category: { bookId: id } } })
          await prisma.category.deleteMany({ where: { bookId: id } })
          await prisma.share.deleteMany({ where: { bookId: id } })

          await prisma.book.update({
            where: { id: book.id },
            data: { groupChats: { set: [] }, selectedByUser: { set: [] } }
          })

          await prisma.book.delete({
            where: { id: id }
          })

          return true
        }

        // Remove share
        await prisma.share.deleteMany({
          where: { bookId: id, userId: user.id }
        })

        if (user.bookSelectedId === id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { bookSelectedId: null }
          })
        }

        return true
      }
    },
    share: {
      async create(bookId: string, userId: string) {
        const share = await prisma.share.findFirst({
          where: { AND: [{ bookId }, { userId }] }
        })

        if (!share) {
          return await prisma.share.create({
            data: {
              bookId,
              userId
            }
          })
        }

        return share
      },
      async delete(bookId: string, userId: string) {
        const share = await prisma.share.findFirst({
          where: { AND: [{ bookId }, { userId }] }
        })

        if (!!share) {
          await prisma.share.delete({
            where: { id: share.id }
          })
          return true
        }

        return true
      }
    },
    account: {
      async create(user: ByncUser, description: string): Promise<AccountWithBalance | null> {
        if (!user.bookSelected) return null

        const account = await prisma.account.create({
          data: { description, bookId: user.bookSelected.id },
          include: accountInclude
        })

        return account
      },
      async findUnique(user: ByncUser, id: string): Promise<AccountWithBalance | null> {
        if (!user.bookSelected) return null

        const account = await prisma.account.findUnique({
          where: { id },
          include: accountInclude
        })

        if (!account) return null

        if (account.bookId !== user.bookSelected.id) return null

        return account
      },
      async findMany(user: ByncUser): Promise<AccountWithBalance[]> {
        if (!user.bookSelected) return []

        const accounts = await prisma.account.findMany({
          where: { bookId: user.bookSelected.id },
          include: accountInclude
        })

        return accounts
      }
    },
    currency: {
      async findOrCreate(user: ByncUser, accountId: string, symbol: string): Promise<CurrencyWithBalance | null> {
        if (!user.bookSelected) return null

        const exists = await prisma.currency.findFirst({
          where: { AND: [{ accountId }, { symbol }, { account: { bookId: user.bookSelected.id } }] },
          include: { account: true, balance: true }
        })

        if (!!exists) {
          return exists
        } else {
          const newCurrency = await prisma.currency.create({
            data: { symbol, accountId },
            include: { account: true, balance: true }
          })

          return newCurrency
        }
      }
    },
    balance: {
      async sum(user: ByncUser, currencyId: string, transactionId: string): Promise<boolean> {
        if (!user.bookSelected) return false

        const lastBalance = await prisma.balance.findFirst({
          where: { currencyId },
          include: { currency: { include: { account: true } } },
          orderBy: { createdAt: 'desc' }
        })

        if (lastBalance && lastBalance.currency.account.bookId !== user.bookSelected.id) return false

        const transaction = await prisma.transaction.findFirst({
          where: { AND: [{ id: transactionId }, { account: { currency: { some: { id: currencyId } } } }] }
        })

        if (!transaction) return false

        const lastAmount = !!lastBalance ? lastBalance.amount : 0
        const sum = (transaction.type === 'EXPENSE' || transaction.type === 'PAYMENT') ? -transaction.amount : transaction.amount

        await prisma.balance.create({
          data: {
            amount: lastAmount + sum,
            currencyId,
            transactionId
          }
        })

        return true
      },
      async fix(user: ByncUser, currencyId: string, amountToFix: number): Promise<boolean> {
        if (!user.bookSelected) return false

        const lastBalance = await prisma.balance.findFirst({
          where: { currencyId },
          include: { currency: { include: { account: true } } },
          orderBy: { createdAt: 'desc' }
        })

        if (lastBalance && lastBalance.currency.account.bookId !== user.bookSelected.id) return false

        const lastAmount = !!lastBalance ? lastBalance.amount : 0

        await prisma.balance.create({
          data: {
            amount: lastAmount + amountToFix,
            currencyId,
            isFromUpdateOrDelete: true
          }
        })

        return true
      }
    },
    transaction: {
      async create(user: ByncUser, data: TransactionCreate): Promise<TransactionWithAll | null> {
        if (!user.bookSelected) return null

        const account = await prisma.account.findFirst({
          where: { AND: [{ id: data.accountId }, { bookId: user.bookSelected.id }] },
        })

        if (!account) return null

        const newTransaction = await prisma.transaction.create({
          data: data,
          include: transactionInclude
        })

        return newTransaction
      },
      async findUnique(user: ByncUser, id: string): Promise<TransactionWithAll | null> {
        if (!user.bookSelected) return null

        const transaction = await prisma.transaction.findFirst({
          where: { AND: [{ id: id }, { account: { bookId: user.bookSelected.id } }] },
          include: transactionInclude
        })

        if (!transaction) return null

        return transaction
      },
      async update(user: ByncUser, id: string, data: TransactionUpdate): Promise<TransactionWithAll | null> {
        if (!user.bookSelected) return null

        const transaction = await prisma.transaction.findFirst({
          where: { AND: [{ id: id }, { account: { bookId: user.bookSelected.id } }] },
        })

        if (!transaction) return null

        const updatedTransaction = await prisma.transaction.update({
          where: { id },
          data: data,
          include: transactionInclude
        })

        return updatedTransaction
      },
      async delete(user: ByncUser, id: string): Promise<boolean> {
        if (!user.bookSelected) return false

        const transaction = await prisma.transaction.findFirst({
          where: { AND: [{ id: id }, { account: { bookId: user.bookSelected.id } }] },
        })

        if (!transaction) return false

        await prisma.transaction.delete({
          where: { id }
        })

        return true
      },
    },
    category: {
      async create(user: ByncUser, description: string): Promise<Category | null> {
        if (!user.bookSelected) return null

        const category = await prisma.category.create({
          data: { description, bookId: user.bookSelected.id, type: 'CATEGORY' },
          include: categoryInclude
        })

        return category
      },
      async findUnique(user: ByncUser, id: string): Promise<Category | null> {
        if (!user.bookSelected) return null

        const category = await prisma.category.findUnique({
          where: { id },
          include: categoryInclude
        })

        if (!category) return null
        if (category.type !== 'CATEGORY') return null

        if (category.bookId !== user.bookSelected.id) return null

        return category
      },
      async findMany(user: ByncUser): Promise<Category[]> {
        if (!user.bookSelected) return []

        const monthTZStart = dayjs().tz(user.timezone).startOf('month')

        const category = await prisma.category.findMany({
          where: { AND: [{ bookId: user.bookSelected.id }, { type: 'CATEGORY' }] },
          include: { ...categoryInclude, transactions: { where: { createdAt: { gte: monthTZStart.format() } } } }
        })

        return category
      }
    },
    payment: {
      async create(user: ByncUser, description: string): Promise<PaymentIncome | null> {
        if (!user.bookSelected) return null

        const payment = await prisma.category.create({
          data: { description, bookId: user.bookSelected.id, type: 'PAYMENT' },
          include: paymentIncomeInclude
        })

        return payment
      },
      async findUnique(user: ByncUser, id: string): Promise<PaymentIncome | null> {
        if (!user.bookSelected) return null

        const payment = await prisma.category.findUnique({
          where: { id },
          include: paymentIncomeInclude
        })

        if (!payment) return null
        if (payment.type !== 'PAYMENT') return null

        if (payment.bookId !== user.bookSelected.id) return null

        return payment
      },
      async findMany(user: ByncUser): Promise<PaymentIncome[]> {
        if (!user.bookSelected) return []

        const monthTZStart = dayjs().tz(user.timezone).startOf('month')

        const payments = await prisma.category.findMany({
          where: { AND: [{ bookId: user.bookSelected.id }, { type: 'PAYMENT' }] },
          include: { ...paymentIncomeInclude, transactions: { where: { createdAt: { gte: monthTZStart.format() } } } }
        })

        return payments
      }
    },
    income: {
      async create(user: ByncUser, description: string): Promise<PaymentIncome | null> {
        if (!user.bookSelected) return null

        const income = await prisma.category.create({
          data: { description, bookId: user.bookSelected.id, type: 'INCOME' },
          include: paymentIncomeInclude
        })

        return income
      },
      async findUnique(user: ByncUser, id: string): Promise<PaymentIncome | null> {
        if (!user.bookSelected) return null

        const income = await prisma.category.findUnique({
          where: { id },
          include: paymentIncomeInclude
        })

        if (!income) return null
        if (income.type !== 'INCOME') return null

        if (income.bookId !== user.bookSelected.id) return null

        return income
      },
      async findMany(user: ByncUser): Promise<PaymentIncome[]> {
        if (!user.bookSelected) return []

        const monthTZStart = dayjs().tz(user.timezone).startOf('month')

        const incomes = await prisma.category.findMany({
          where: { AND: [{ bookId: user.bookSelected.id }, { type: 'INCOME' }] },
          include: { ...paymentIncomeInclude, transactions: { where: { createdAt: { gte: monthTZStart.format() } } } }
        })

        return incomes
      }
    },
    file: {
      async create(user: ByncUser, data: FileCreate): Promise<boolean> {
        if (!user.bookSelected) return false

        try {
          await prisma.file.create({
            data: data
          })
          return true
        } catch (error) {
          return false
        }
      },
      delete: async (id: string) => {
        try {
          await prisma.file.delete({ where: { id } })
        } catch (error) {
          console.error(error)
        }
      }
    }
  }
})

export default xprisma