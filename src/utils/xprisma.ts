import { AccountUpdate, AccountWithBalance, BookUpdate, BookWithOwner, BookWithOwnerAndShares, ByncUser, Category, CategoryUpdate, CategoryPDF, ConversationUpdateInput, CurrencyWithBalance, Edit, FileCreate, PaymentIncome, TransactionCreate, TransactionUpdate, TransactionWithAll, UserUpdate } from '@customTypes/prismaTypes'
import { $Enums, PrismaClient, Prisma, Currency } from '@prisma/client'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { MAX_ACCOUNTS, MAX_CATEGORIES, MAX_FILES, MAX_INCOMES, MAX_OWN_BOOKS, MAX_PAYMENTS } from '@utils/constant'
import parseEmoji from './parseEmoji'

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

const accountInclude = { currency: { orderBy: { symbol: 'desc' as Prisma.SortOrder }, include: { balance: { orderBy: { createdAt: 'desc' as Prisma.SortOrder } } } } }

const transactionInclude = {
  account: { include: { currency: true } },
  category: true,
  files: { include: { items: true } },
  groupNotifications: true,
  transferIn: true,
  transferOut: true,
  parentSplit: { include: { parent: true } },
  splits: { include: { childrens: true } }
}

const paymentIncomeInclude = { limits: true, transactions: true }

const categoryInclude = { limits: true, transactions: true }

const yprisma = prisma.$extends({
  model: {
    balance: {
      async create(user: ByncUser, transaction: TransactionWithAll): Promise<boolean> {
        if (!user.bookSelected) return false

        if (transaction.paidAt === null) return false

        const currency = await prisma.currency.findFirst({
          where: { AND: [{ symbol: transaction.currency }, { account: { id: transaction.accountId } }] }
        })

        if (!currency) return false

        const lastBalance = await prisma.balance.findFirst({
          where: { currencyId: currency.id },
          include: { currency: { include: { account: true } } },
          orderBy: { createdAt: 'desc' }
        })

        const lastAmount = !!lastBalance ? lastBalance.amount : 0
        const sum = (transaction.type === 'EXPENSE' || transaction.type === 'PAYMENT' || transaction.type === 'TRANSFER_OUT') ? -transaction.amount : transaction.amount

        await prisma.balance.create({
          data: {
            amount: lastAmount + sum,
            currencyId: currency.id,
            transactionId: transaction.id
          }
        })

        return true
      },
      async update(user: ByncUser, oldTransaction: TransactionWithAll, newTransaction: TransactionWithAll): Promise<boolean> {
        if (!user.bookSelected) return false

        const currency = await prisma.currency.findFirst({
          where: { AND: [{ symbol: oldTransaction.currency }, { account: { id: oldTransaction.accountId } }] }
        })

        if (!currency) return false

        const balance = await prisma.balance.findFirst({
          where: { transactionId: oldTransaction.id }
        })

        if (!balance) return false

        const oldValue = (oldTransaction.type === 'EXPENSE' || oldTransaction.type === 'PAYMENT' || oldTransaction.type === 'TRANSFER_OUT') ? -oldTransaction.amount : oldTransaction.amount
        const newValue = (newTransaction.type === 'EXPENSE' || newTransaction.type === 'PAYMENT' || newTransaction.type === 'TRANSFER_OUT') ? -newTransaction.amount : newTransaction.amount

        const sum = newValue - oldValue

        if (sum === 0) return true

        await prisma.balance.updateMany({
          where: { createdAt: { gte: balance.createdAt }, currencyId: currency.id },
          data: { amount: { increment: sum } }
        })

        return true
      },
      async delete(user: ByncUser, oldTransaction: TransactionWithAll): Promise<boolean> {
        if (!user.bookSelected) return false

        const currency = await prisma.currency.findFirst({
          where: { AND: [{ symbol: oldTransaction.currency }, { account: { id: oldTransaction.accountId } }] }
        })

        if (!currency) return false

        const balance = await prisma.balance.findFirst({
          where: { transactionId: oldTransaction.id }
        })

        if (!balance) return false

        const increment = (oldTransaction.type === 'EXPENSE' || oldTransaction.type === 'PAYMENT' || oldTransaction.type === 'TRANSFER_OUT') ? oldTransaction.amount : -oldTransaction.amount

        await prisma.balance.updateMany({
          where: { createdAt: { gte: balance.createdAt }, currencyId: currency.id },
          data: { amount: { increment: increment } }
        })

        await prisma.balance.delete({
          where: { id: balance.id }
        })

        return true
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
    }
  }
})

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
      async findUnique(id: string): Promise<ByncUser | null> {
        const user = await prisma.user.findUnique({
          where: { id },
          include: userInclude
        })

        if (!user) {
          return null
        }

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
      countOwn: async (user: ByncUser): Promise<number> => {
        return await prisma.book.count({
          where: { ownerId: user.id }
        })
      },
      async create(user: ByncUser, title: string): Promise<BookWithOwner | null> {
        const count = await prisma.book.count({
          where: { ownerId: user.id }
        })

        if (count + 1 > MAX_OWN_BOOKS) {
          return null
        }

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
          await prisma.split.deleteMany({ where: { parent: { account: { bookId: id } } } })
          await prisma.file.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.transfer.deleteMany({ where: { OR: [{ out: { account: { bookId: id } } }, { in: { account: { bookId: id } } }] } })
          await prisma.item.deleteMany({ where: { file: { transaction: { account: { bookId: id } } } } })
          await prisma.groupNotification.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.transaction.deleteMany({ where: { account: { bookId: id } } })
          await prisma.balance.deleteMany({ where: { currency: { account: { bookId: id } } } })
          await prisma.currency.deleteMany({ where: { account: { bookId: id } } })
          await prisma.account.deleteMany({ where: { bookId: id } })
          await prisma.amountCurrency.deleteMany({ where: { category: { bookId: id } } })
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
      async create(owner: ByncUser, bookId: string, userId: string) {
        if (!owner.booksOwn.some(book => book.id === bookId)) {
          return null
        }

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
      async delete(owner: ByncUser, bookId: string, userId: string) {
        if (!owner.booksOwn.some(book => book.id === bookId)) {
          return null
        }

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
      async currencies(user: ByncUser): Promise<Currency[]> {
        if (!user.bookSelected) return []

        const currencies = await prisma.currency.findMany({ where: { account: { bookId: user.bookSelected?.id } } })

        return currencies
      },
      async count(user: ByncUser): Promise<number> {
        if (!user.bookSelected) return 0

        return await prisma.account.count({ where: { bookId: user.bookSelected.id } })
      },
      async create(user: ByncUser, description: string): Promise<AccountWithBalance | null> {
        if (!user.bookSelected) return null

        const count = await prisma.account.count({ where: { bookId: user.bookSelected.id } })

        if (count + 1 > MAX_ACCOUNTS) {
          return null
        }

        const account = await prisma.account.create({
          data: { description, bookId: user.bookSelected.id },
          include: accountInclude
        })

        return { ...account, type: 'ACCOUNT' }
      },
      async findUnique(user: ByncUser, id: string): Promise<AccountWithBalance | null> {
        if (!user.bookSelected) return null

        const account = await prisma.account.findUnique({
          where: { id },
          include: accountInclude
        })

        if (!account) return null

        if (account.bookId !== user.bookSelected.id) return null

        return { ...account, type: 'ACCOUNT' }
      },
      async findMany(user: ByncUser): Promise<AccountWithBalance[]> {
        if (!user.bookSelected) return []

        const accounts = await prisma.account.findMany({
          where: { bookId: user.bookSelected.id },
          include: accountInclude
        })

        return accounts.map(account => ({ ...account, type: 'ACCOUNT' }))
      },
      async update(user: ByncUser, id: string, data: AccountUpdate): Promise<AccountWithBalance | null> {
        if (!user.bookSelected) return null

        const account = await prisma.account.findUnique({
          where: { id },
          include: accountInclude
        })

        if (!account) return null

        if (account.bookId !== user.bookSelected.id) return null

        const updatedAccount = await prisma.account.update({
          where: { id },
          data: data,
          include: accountInclude
        })

        return { ...updatedAccount, type: 'ACCOUNT' }
      },
      async delete(user: ByncUser, id: string): Promise<boolean> {
        if (!user.bookSelected) return false

        const account = await prisma.account.findUnique({
          where: { id },
          include: { transaction: true }
        })

        if (!account) return false
        if (account?.transaction.length > 0) return false
        if (account.bookId !== user.bookSelected.id) return false

        await prisma.account.delete({ where: { id } })
        return true
      }
    },
    balance: {
      async userSet(user: ByncUser, { amount, symbol, accountId }: { amount: number, symbol: string, accountId: string }): Promise<boolean> {
        if (!user.bookSelected) return false

        const monthTZStart = dayjs().tz(user.timezone).startOf('month')

        const currency = await prisma.currency.findFirst({
          where: { AND: [{ symbol: symbol }, { account: { id: accountId } }] }
        })

        if (!currency) {
          // Create currency With Balance
          await prisma.currency.create({
            data: { symbol, accountId, balance: { create: { amount, isUserInput: true } } }
          })

          return true
        }

        const lastBalance = await prisma.balance.findFirst({
          where: { currencyId: currency.id },
          include: { currency: { include: { account: true } } },
          orderBy: { createdAt: 'desc' }
        })

        if (!lastBalance) {
          // Create balance
          await prisma.balance.create({
            data: { amount, currencyId: currency.id, isUserInput: true }
          })

          return true
        }

        const sum = amount - (lastBalance?.amount || 0)

        await prisma.balance.updateMany({
          where: { AND: [{ createdAt: { lte: lastBalance.createdAt, gt: monthTZStart.format() } }, { currencyId: currency.id }] },
          data: { amount: { increment: sum } }
        })

        return true
      },
    },
    split: {
      create: async (user: ByncUser, parent: TransactionWithAll, children: TransactionWithAll): Promise<boolean> => {
        if (!user.bookSelected) return false
        if (parent.account.bookId !== user.bookSelected.id) return false

        if (parent.parentSplit) {
          await prisma.split.update({
            where: { id: parent.parentSplit.id },
            data: {
              childrens: {
                connect: { id: children.id }
              }
            }
          })

          return true
        }

        await prisma.split.create({
          data: {
            parentId: parent.id,
            childrens: {
              connect: { id: children.id }
            }
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

        await yprisma.currency.findOrCreate(user, newTransaction.accountId, newTransaction.currency)
        await yprisma.balance.create(user, newTransaction)

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
      async findMany(user: ByncUser, where: Prisma.TransactionWhereInput): Promise<TransactionWithAll[]> {
        if (!user.bookSelected) return []

        const transaction = await prisma.transaction.findMany({
          where: {
            AND: [{ account: { bookId: user.bookSelected.id } }, where]
          },
          include: transactionInclude,
          take: 50,
          orderBy: [
            {
              paidAt: 'desc',
            },
            {
              createdAt: 'desc'
            }
          ],
        })

        if (!transaction) return []

        return transaction
      },
      async update(user: ByncUser, id: string, data: TransactionUpdate): Promise<TransactionWithAll | null> {
        if (!user.bookSelected) return null

        const transaction = await prisma.transaction.findFirst({
          where: { AND: [{ id: id }, { account: { bookId: user.bookSelected.id } }] },
          include: transactionInclude
        })

        if (!transaction) return null

        const updatedTransaction = await prisma.transaction.update({
          where: { id },
          data: data,
          include: transactionInclude
        })

        if (transaction.paidAt === null && updatedTransaction.paidAt !== null) {
          // Create balance
          await yprisma.balance.create(user, transaction)
        }

        if (updatedTransaction.paidAt === null && transaction.paidAt !== null) {
          // Delete balance
          await yprisma.balance.delete(user, updatedTransaction)
        }

        await yprisma.balance.update(user, transaction, updatedTransaction)

        return updatedTransaction
      },
      async delete(user: ByncUser, id: string): Promise<boolean> {
        if (!user.bookSelected) return false

        const transaction = await prisma.transaction.findFirst({
          where: { AND: [{ id: id }, { account: { bookId: user.bookSelected.id } }] },
          include: transactionInclude
        })

        if (!transaction) return false

        await yprisma.balance.delete(user, transaction)

        await prisma.transaction.delete({
          where: { id }
        })

        return true
      },
    },
    category: {
      async count(user: ByncUser): Promise<number> {
        if (!user.bookSelected) return 0

        return await prisma.category.count({ where: { AND: [{ bookId: user.bookSelected.id }, { type: 'CATEGORY' }] } })
      },
      async create(user: ByncUser, description: string): Promise<Category | null> {
        if (!user.bookSelected) return null

        const count = await prisma.category.count({ where: { AND: [{ bookId: user.bookSelected.id }, { type: 'CATEGORY' }] } })
        if (count + 1 > MAX_CATEGORIES) return null

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
          include: { ...categoryInclude, transactions: { where: { paidAt: { gte: monthTZStart.format() } } } },
          orderBy: { transactions: { _count: 'desc' } }
        })

        return category.sort((a, b) => b.transactions.length - a.transactions.length)
      },
      async findUniqueById(user: ByncUser, id: string): Promise<Category | PaymentIncome | null> {
        if (!user.bookSelected) return null

        const item = await prisma.category.findUnique({
          where: { id },
          include: paymentIncomeInclude
        })

        if (!item) return null

        if (item.bookId !== user.bookSelected.id) return null

        return item
      },
      async findManyByType(user: ByncUser, type: $Enums.CategoryType): Promise<Category[] | PaymentIncome[]> {
        if (!user.bookSelected) return []

        const monthTZStart = dayjs().tz(user.timezone).startOf('month')

        const category = await prisma.category.findMany({
          where: { AND: [{ bookId: user.bookSelected.id }, { type: type }] },
          include: { ...categoryInclude, transactions: { where: { OR: [{ paidAt: { gte: monthTZStart.format() } }, { AND: [{ createdAt: { gte: monthTZStart.format() } }, { paidAt: null }] }] } } },
          orderBy: { transactions: { _count: 'desc' } }
        })

        return category.sort((a, b) => b.transactions.length - a.transactions.length)
      },
      async findManyAll(user: ByncUser): Promise<Category[] | PaymentIncome[]> {
        if (!user.bookSelected) return []

        const monthTZStart = dayjs().tz(user.timezone).startOf('month')

        const category = await prisma.category.findMany({
          where: { AND: [{ bookId: user.bookSelected.id }] },
          include: { ...categoryInclude, transactions: { where: { OR: [{ paidAt: { gte: monthTZStart.format() } }, { AND: [{ createdAt: { gte: monthTZStart.format() } }, { paidAt: null }] }] } } },
          orderBy: { transactions: { _count: 'desc' } }
        })

        return category.sort((a, b) => b.transactions.length - a.transactions.length)
      },
      async update(user: ByncUser, id: string, data: CategoryUpdate): Promise<Category | PaymentIncome | null> {
        if (!user.bookSelected) return null

        const item = await prisma.category.findUnique({
          where: { id },
        })

        if (!item) return null

        if (item.bookId !== user.bookSelected.id) return null

        const update = await prisma.category.update({
          where: { id },
          data: data,
          include: paymentIncomeInclude
        })

        return update
      },
      async delete(user: ByncUser, id: string): Promise<boolean> {
        if (!user.bookSelected) return false

        const item = await prisma.category.findUnique({
          where: { id },
          include: { transactions: true }
        })

        if (!item) return false
        if (item.bookId !== user.bookSelected.id) return false

        if (item.type === 'INCOME' || item.type === 'PAYMENT') {
          await prisma.transaction.updateMany({
            where: { categoryId: id },
            data: {
              type: item.type === 'INCOME' ? 'DEPOSIT' : 'EXPENSE',
              categoryId: null
            }
          })
        }

        await prisma.category.delete({ where: { id } })
        return true
      },
      async updateLimit(user: ByncUser, category: Category, data: { amount: number, currency: string }): Promise<Boolean> {
        if (!user.bookSelected) return false

        if (category.bookId !== user.bookSelected.id) return false

        const currency = category.limits.find(l => l.currency === data.currency)

        if (currency) {
          await prisma.amountCurrency.update({
            where: { id: currency.id },
            data: { amount: data.amount }
          })
          return true
        }

        await prisma.category.update({
          where: { id: category.id },
          data: { limits: { create: data } }
        })

        return true
      },
      async findManyPDF(user: ByncUser, type: $Enums.CategoryType): Promise<CategoryPDF[]> {
        if (!user.bookSelected) return []

        const monthTZStart = dayjs().tz(user.timezone).startOf('month')

        const category = await prisma.category.findMany({
          where: { AND: [{ bookId: user.bookSelected.id }, { type: type }] },
          include: { ...categoryInclude, transactions: { where: { OR: [{ paidAt: { gte: monthTZStart.format() } }, { AND: [{ createdAt: { gte: monthTZStart.format() } }, { paidAt: null }] }] } } },
          orderBy: { transactions: { _count: 'desc' } }
        })

        return await Promise.all(category.map(async c => {
          const parsedDescription = await parseEmoji(c.description, {
            bold: true
          })
          const totals: Record<string, number> = c.transactions.reduce((acc: Record<string, number>, t) => {
            const symbol = t.currency
            const amount = t.amount

            if (!acc[symbol]) {
              acc[symbol] = 0
            }
            acc[symbol] += amount
            return acc
          }, {})

          const transactions = await Promise.all(c.transactions.map(async t => {
            const parsedDescription = await parseEmoji(t.description)

            return {
              ...t,
              parsedDescription
            }
          }))

          return {
            ...c,
            parsedDescription,
            totals,
            transactions
          }
        })).then(categories => categories.sort((a, b) => {
          const sumA = Object.values(a.totals).reduce((acc, curr) => acc + curr, 0)
          const sumB = Object.values(b.totals).reduce((acc, curr) => acc + curr, 0)

          return sumB - sumA
        }))
      },
    },
    payment: {
      async count(user: ByncUser): Promise<number> {
        if (!user.bookSelected) return 0

        return await prisma.category.count({ where: { AND: [{ bookId: user.bookSelected.id }, { type: 'PAYMENT' }] } })
      },
      async create(user: ByncUser, description: string): Promise<PaymentIncome | null> {
        if (!user.bookSelected) return null

        const count = await prisma.category.count({ where: { AND: [{ bookId: user.bookSelected.id }, { type: 'PAYMENT' }] } })
        if (count + 1 > MAX_PAYMENTS) return null

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
      }
    },
    income: {
      async count(user: ByncUser): Promise<number> {
        if (!user.bookSelected) return 0

        return await prisma.category.count({ where: { AND: [{ bookId: user.bookSelected.id }, { type: 'INCOME' }] } })
      },
      async create(user: ByncUser, description: string): Promise<PaymentIncome | null> {
        if (!user.bookSelected) return null

        const count = await prisma.category.count({ where: { AND: [{ bookId: user.bookSelected.id }, { type: 'INCOME' }] } })
        if (count + 1 > MAX_INCOMES) return null

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
      }
    },
    file: {
      async count(user: ByncUser, transactionId: string): Promise<number> {
        if (!user.bookSelected) return 0

        return await prisma.file.count({ where: { transactionId: transactionId } })
      },
      async create(user: ByncUser, data: FileCreate): Promise<boolean> {
        if (!user.bookSelected) return false

        const count = await prisma.file.count({ where: { transactionId: data.transactionId } })

        if (count + 1 > MAX_FILES) return false

        try {
          await prisma.file.create({
            data: data
          })
          return true
        } catch (error) {
          return false
        }
      },
      async delete(id: string) {
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