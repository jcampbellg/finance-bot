import { BookUpdate, BookWithOwner, ByncUser, ConversationUpdateInput, Edit, UserUpdate } from '@customTypes/prismaTypes'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const userInclude = () => ({
  bookSelected: { include: { owner: true, shares: true } },
  booksOwn: true,
  booksAccess: { include: { book: true } },
  conversation: true
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
          include: userInclude()
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
          include: userInclude()
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
      async findUnique(user: ByncUser, id: string): Promise<BookWithOwner | null> {
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
          return false
        }

        if (isOwner) {
          await prisma.file.deleteMany({ where: { OR: [{ transaction: { account: { bookId: id } } }, { account: { bookId: id } }, { category: { bookId: id } }] } })
          await prisma.item.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.groupNotification.deleteMany({ where: { transaction: { account: { bookId: id } } } })
          await prisma.transaction.deleteMany({ where: { account: { bookId: id } } })
          await prisma.balance.deleteMany({ where: { currency: { account: { bookId: id } } } })
          await prisma.currency.deleteMany({ where: { account: { bookId: id } } })
          await prisma.account.deleteMany({ where: { bookId: id } })
          await prisma.category.deleteMany({ where: { bookId: id } })
          await prisma.exchangeRate.deleteMany({ where: { bookId: id } })
          await prisma.share.deleteMany({ where: { bookId: id } })
          await prisma.limit.deleteMany({ where: { budget: { bookId: id } } })
          await prisma.budgetRule.deleteMany({ where: { bookId: id } })

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
    }
  }
})

export default xprisma