import { AccountWithBalanceAndFiles, BookUpdate, BookWithOwner, BookWithOwnerAndShares, ByncUser, ConversationUpdateInput, Edit, TransactionCreate, TransactionWithAll, UserUpdate } from '@customTypes/prismaTypes'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const userInclude = {
  bookSelected: { include: { owner: true, shares: true } },
  booksOwn: true,
  booksAccess: { include: { book: true } },
  conversation: true
}

const accountInclude = { currency: { include: { balance: true } }, files: true }

const transactionInclude = {
  account: true,
  category: true,
  files: true,
  groupNotifications: true,
  items: true,
  splits: true,
  transferA: true,
  transferB: true
}

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
          await prisma.file.deleteMany({ where: { OR: [{ transaction: { account: { bookId: id } } }, { account: { bookId: id } }, { category: { bookId: id } }] } })
          await prisma.item.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.groupNotification.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.transaction.deleteMany({ where: { account: { bookId: id } } })
          console.log('Transactions deleted')
          await prisma.balance.deleteMany({ where: { currency: { account: { bookId: id } } } })
          await prisma.currency.deleteMany({ where: { account: { bookId: id } } })
          await prisma.account.deleteMany({ where: { bookId: id } })
          await prisma.category.deleteMany({ where: { bookId: id } })
          await prisma.exchangeRate.deleteMany({ where: { bookId: id } })
          console.log('Accounts deleted')
          await prisma.share.deleteMany({ where: { bookId: id } })
          console.log('Shares deleted')
          await prisma.limit.deleteMany({ where: { budget: { bookId: id } } })
          await prisma.budgetRule.deleteMany({ where: { bookId: id } })
          console.log('Budgets deleted')

          await prisma.book.update({
            where: { id: book.id },
            data: { groupChats: { set: [] }, selectedByUser: { set: [] } }
          })

          console.log('Group chats and selected by user deleted')

          await prisma.book.delete({
            where: { id: id }
          })

          console.log('Book deleted')

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
      async create(user: ByncUser, description: string): Promise<AccountWithBalanceAndFiles | null> {
        if (!user.bookSelected) return null

        const account = await prisma.account.create({
          data: { description, bookId: user.bookSelected.id },
          include: accountInclude
        })

        return account
      },
      async findUnique(user: ByncUser, id: string): Promise<AccountWithBalanceAndFiles | null> {
        if (!user.bookSelected) return null

        const account = await prisma.account.findUnique({
          where: { id },
          include: accountInclude
        })

        if (!account) return null

        if (account.bookId !== user.bookSelected.id) return null

        return account
      },
      async findMany(user: ByncUser): Promise<AccountWithBalanceAndFiles[]> {
        if (!user.bookSelected) return []

        const accounts = await prisma.account.findMany({
          where: { bookId: user.bookSelected.id },
          include: accountInclude
        })

        return accounts
      }
    },
    transaction: {
      create: async (user: ByncUser, data: TransactionCreate): Promise<TransactionWithAll | null> => {
        if (!user.bookSelected) return null

        const account = await prisma.account.findFirst({
          where: { AND: [{ id: data.accountId }, { bookId: user.bookSelected.id }] },
        })

        if (!account) return null

        return prisma.transaction.create({
          data: data,
          include: transactionInclude
        })
      }
    },
    currency: {
      async create(user: ByncUser, accountId: string, symbol: string): Promise<boolean> {
        if (!user.bookSelected) return false

        const exists = await prisma.currency.findFirst({
          where: { accountId, symbol },
          include: { account: true }
        })

        if (exists) {
          if (exists.account.bookId !== user.bookSelected.id) return false
        } else {
          await prisma.currency.create({
            data: { symbol, accountId }
          })
        }

        return true
      }
    }
  }
})

export default xprisma