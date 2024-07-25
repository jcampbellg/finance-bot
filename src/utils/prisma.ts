import { BookWithRoleAndOwner, ByncUser } from '@customTypes/prismaTypes'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
          include: {
            bookSelected: {
              include: {
                role: true
              }
            },
            books: true,
            conversation: true
          }
        })

        return {
          ...user,
          bookSelected: !!user.bookSelected ? {
            ...user.bookSelected,
            role: user.bookSelected.role[0]
          } : null
        }
      },
      async update(userId: number, data: Omit<Prisma.UserUpdateInput, 'id' | 'telegramId'>) {
        await prisma.user.update({
          where: {
            telegramId: userId
          },
          data: data
        })
      }
    },
    conversation: {
      async updateSubject(id: string, subject?: string, subSubject?: string) {
        await prisma.conversation.update({
          where: {
            id: id
          },
          data: {
            subject: subject,
            subSubject: subject ? (subSubject || '') : subSubject
          }
        })
      },
      async waiting(id: string, messageId?: number | null) {
        await prisma.conversation.update({
          where: {
            id: id
          },
          data: {
            subject: 'waiting',
            subSubject: '',
            messageId: messageId
          }
        })
      }
    },
    book: {
      async create(user: ByncUser, data: Omit<Prisma.BookCreateInput, 'user' | 'userId' | 'role'>): Promise<BookWithRoleAndOwner> {
        const newBook = await prisma.book.create({
          data: {
            ...data,
            role: {
              create: {
                permision: 'OWNER',
                userId: user.id
              }
            },
            user: {
              connect: {
                id: user.id
              }
            }
          },
          include: {
            role: true
          }
        })

        return {
          ...newBook,
          role: newBook.role[0],
          owner: user
        }
      }
    }
  }
})

export default xprisma