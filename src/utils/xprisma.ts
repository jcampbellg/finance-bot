import { AccountWithBookAndCurrency, BookWithRolesAndOwner, ByncUser, ConversationUpdateInput, RoleCreate, RoleWithUser, TransactionCreateInput } from '@customTypes/prismaTypes'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const userInclude = () => ({
  bookSelected: {
    include: {
      roles: true
    }
  },
  roles: {
    include: {
      book: true
    }
  },
  conversation: true
})

const bookInclude = () => ({
  roles: {
    include: {
      user: true
    }
  }
})

const xprisma = prisma.$extends({
  model: {
    user: {
      async auth(userId: number): Promise<ByncUser> {
        const user = await prisma.user.upsert({
          where: {
            telegramId: userId
          },
          create: {
            timezone: '',
            telegramId: userId,
            conversation: {
              create: {
                subject: 'start',
                subSubject: 'country'
              }
            }
          },
          update: {},
          include: userInclude()
        })

        const role = user.bookSelected?.roles.find(r => r.userId === user.id)

        if (!role) {
          await prisma.user.update({ where: { id: user.id }, data: { bookSelectedId: null } })
        }

        return {
          ...user,
          bookSelected: !!user.bookSelected ? (role ? {
            ...user.bookSelected,
            role: role
          } : null) : null,
          books: user.roles.map(r => ({ ...r.book, role: r })),
          canPrepareBudget: role?.permission !== 'SPENDER',
          conversation: {
            ...user.conversation,
            edit: user.conversation.edit || {}
          }
        }
      },
      async update(userId: number, data: Omit<Prisma.UserUpdateInput, 'id' | 'telegramId'>): Promise<ByncUser> {
        const user = await prisma.user.update({
          where: {
            telegramId: userId
          },
          data: data,
          include: userInclude()
        })

        const role = user.bookSelected?.roles.find(r => r.userId === user.id)

        if (!role) {
          await prisma.user.update({ where: { id: user.id }, data: { bookSelectedId: null } })
        }

        return {
          ...user,
          bookSelected: !!user.bookSelected ? (role ? {
            ...user.bookSelected,
            role: role
          } : null) : null,
          books: user.roles.map(r => ({ ...r.book, role: r })),
          canPrepareBudget: role?.permission !== 'SPENDER',
          conversation: {
            ...user.conversation,
            edit: user.conversation.edit || {}
          }
        }
      }
    },
    conversation: {
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
      async create(user: ByncUser, data: Omit<Prisma.BookCreateInput, 'user' | 'userId' | 'role'>): Promise<BookWithRolesAndOwner> {
        const newBook = await prisma.book.create({
          data: {
            ...data,
            roles: {
              create: {
                permission: 'OWNER',
                userId: user.id
              }
            }
          },
          include: bookInclude()
        })

        const role = newBook.roles.find(r => r.userId === user.id) as RoleWithUser

        return {
          ...newBook,
          role: role,
          owner: role.user,
          isSelected: false
        }
      },
      async findManyWithAccess(user: ByncUser): Promise<BookWithRolesAndOwner[]> {
        const books = await prisma.book.findMany({
          where: {
            roles: { some: { userId: user.id } }
          },
          include: bookInclude()
        })

        return books.map((book) => {
          const role = book.roles.find(r => r.userId === user.id) as RoleWithUser
          const owner = book.roles.find(r => r.permission === 'OWNER') as RoleWithUser

          return {
            ...book,
            role: role,
            owner: owner.user,
            isSelected: !!user.bookSelected && user.bookSelected.id === book.id
          }
        })
      },
      async findUniqueWithAccess(user: ByncUser, id: string): Promise<BookWithRolesAndOwner | null> {
        const book = await prisma.book.findUnique({
          where: { id: id },
          include: bookInclude()
        })

        if (!book) {
          return null
        }

        const role = book.roles.find(r => r.userId === user.id)

        if (!role) {
          // User does not have access to this book
          return null
        }

        const owner = book.roles.find(r => r.permission === 'OWNER') as RoleWithUser

        return {
          ...book,
          role,
          owner: owner.user,
          isSelected: !!user.bookSelected && user.bookSelected.id === book.id
        }
      },
      async update(user: ByncUser, id: string, data: Omit<Prisma.BookUpdateInput, 'id' | 'user'>): Promise<BookWithRolesAndOwner | null> {
        const bookSearch = await prisma.book.findUnique({
          where: { id: id },
          include: bookInclude()
        })

        if (!bookSearch) {
          return null
        }

        const role = bookSearch.roles.find(r => r.userId === user.id)

        if (!role || role.permission === 'SPENDER') {
          // User does not have access to update this book
          return null
        }

        const book = await prisma.book.update({
          where: { id: id },
          data: data,
          include: bookInclude()
        })

        const owner = book.roles.find(r => r.permission === 'OWNER') as RoleWithUser

        return {
          ...book,
          role,
          owner: owner.user,
          isSelected: !!user.bookSelected && user.bookSelected.id === book.id
        }
      },
      async delete(user: ByncUser, id: string): Promise<boolean> {
        const book = await prisma.book.findUnique({
          where: { id: id },
          include: bookInclude()
        })

        if (!book) {
          return false
        }

        const role = book.roles.find(r => r.userId === user.id)

        if (!role || role.permission !== 'OWNER') {
          // User does not have access to delete this book
          return false
        }

        await prisma.file.deleteMany({ where: { OR: [{ transaction: { account: { bookId: id } } }, { account: { bookId: id } }, { category: { bookId: id } }] } })
        await prisma.item.deleteMany({ where: { transaction: { account: { bookId: id } } } })
        await prisma.groupNotification.deleteMany({ where: { transaction: { account: { bookId: id } } } })
        await prisma.transaction.deleteMany({ where: { account: { bookId: id } } })
        await prisma.balance.deleteMany({ where: { currency: { account: { bookId: id } } } })
        await prisma.currency.deleteMany({ where: { account: { bookId: id } } })
        await prisma.account.deleteMany({ where: { bookId: id } })
        await prisma.category.deleteMany({ where: { bookId: id } })
        await prisma.exchangeRate.deleteMany({ where: { bookId: id } })
        await prisma.role.deleteMany({ where: { bookId: id } })
        await prisma.limit.deleteMany({ where: { budget: { bookId: id } } })
        await prisma.budgetRule.deleteMany({ where: { bookId: id } })

        await prisma.user.updateMany({
          where: {
            bookSelectedId: book.id
          },
          data: {
            bookSelectedId: null
          }
        })

        await prisma.book.update({
          where: { id: book.id },
          data: {
            groupChats: { set: [] }
          }
        })

        await prisma.book.delete({
          where: {
            id: id
          }
        })

        return true
      }
    },
    role: {
      async create(user: ByncUser, data: RoleCreate): Promise<boolean> {
        const toUser = await prisma.user.findUnique({
          where: { id: data.toUserId }
        })

        if (user.id === data.toUserId || !toUser) {
          // Cannot change my own role or user not found
          return false
        }

        const book = await prisma.book.findUnique({
          where: { id: data.bookId },
          include: bookInclude()
        })

        if (!book) {
          return false
        }

        const role = book.roles.find(r => r.userId === user.id)

        if (!role || role.permission !== 'OWNER') {
          // Only owner can manage this area
          return false
        }

        const oldRole = await prisma.role.findFirst({
          where: {
            userId: data.toUserId,
            bookId: data.bookId
          }
        })

        if (oldRole) {
          await prisma.role.update({
            where: {
              id: oldRole.id
            },
            data: {
              permission: data.role
            }
          })
        } else {
          await prisma.role.create({
            data: {
              userId: data.toUserId,
              bookId: data.bookId,
              permission: data.role
            }
          })
        }

        if (data.role === 'OWNER') {
          // Change me to admin
          await prisma.role.update({
            where: {
              id: role.id
            },
            data: {
              permission: 'FINANCE'
            }
          })
        }

        return true
      },
      async delete(user: ByncUser, bookId: string): Promise<boolean> {
        const book = await prisma.book.findUnique({
          where: { id: bookId },
          include: bookInclude()
        })

        if (!book) {
          return false
        }

        const role = book.roles.find(r => r.userId === user.id)

        if (!role || role.permission === 'OWNER') {
          // Owner cannot revoke himself to access
          return false
        }

        await prisma.role.delete({
          where: {
            id: role.id
          }
        })

        return true
      }
    },
    account: {
      async create(user: ByncUser, description: string): Promise<AccountWithBookAndCurrency | null> {
        if (!user.bookSelected) {
          return null
        }

        const acc = await prisma.account.create({
          data: {
            description,
            bookId: user.bookSelected?.id
          },
          include: { book: true, currency: { include: { balance: true } } }
        })

        return acc
      },
      async findUnique(user: ByncUser, id: string): Promise<AccountWithBookAndCurrency | null> {
        const acc = await prisma.account.findUnique({
          where: { id: id },
          include: { book: true, currency: { include: { balance: true } } }
        })

        if (!acc) {
          return null
        }

        const haveAccessToThisBook = user.books.some(b => b.id === acc.book.id)

        if (!haveAccessToThisBook) {
          return null
        }

        return acc
      },
      async findMany(bookId: string) {
        return await prisma.account.findMany({
          where: { bookId: bookId },
          include: { _count: true }
        })
      }
    },
    currency: {
      async create(user: ByncUser, data: { accountId: string, symbol: string }): Promise<boolean> {
        if (!user.bookSelected) {
          return false
        }

        const exists = await prisma.currency.findFirst({
          where: {
            AND: [
              { symbol: data.symbol },
              { accountId: data.accountId }
            ]
          }
        })

        if (exists) {
          return true
        }

        await prisma.currency.create({
          data: {
            symbol: data.symbol,
            accountId: data.accountId
          }
        })

        return true
      }
    },
    transaction: {
      async create(user: ByncUser, data: TransactionCreateInput) {
        if (!user.bookSelected) {
          return null
        }

        const acc = await prisma.account.findUnique({
          where: { id: data.accountId }, include: { book: true }
        })

        if (!acc) {
          return null
        }

        const haveAccessToThisBook = user.books.some(b => b.id === acc.book.id)

        if (!haveAccessToThisBook) {
          return null
        }

        return await prisma.transaction.create({
          data: {
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            accountId: acc.id,
          }
        })
      }
    }
  }
})

export default xprisma