import { BookWithRoleAndOwner, ByncUser } from '@customTypes/prismaTypes'
import { Prisma, PrismaClient } from '@prisma/client'

const pris = new PrismaClient()

const prisma = pris.$extends({
  model: {
    user: {
      async auth(userId: number): Promise<ByncUser> {
        const user = await pris.user.upsert({
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
        await pris.user.update({
          where: {
            telegramId: userId
          },
          data: data
        })
      }
    },
    conversation: {
      async update(id: string, data: Omit<Prisma.ConversationUpdateInput, 'id'>) {
        return await pris.conversation.update({
          where: {
            id: id
          },
          data: data
        })
      },
      async updateSubject(id: string, subject?: string, subSubject?: string) {
        return await pris.conversation.update({
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
        return await pris.conversation.update({
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
        const newBook = await pris.book.create({
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
      },
      async findManyWithAccess(user: ByncUser): Promise<BookWithRoleAndOwner[]> {
        const books = await pris.book.findMany({
          where: {
            user: {
              some: {
                id: user.id
              }
            }
          },
          include: {
            role: true,
            user: {
              where: {
                books: {
                  every: {
                    role: {
                      some: {
                        permision: 'OWNER'
                      }
                    }
                  }
                }
              }
            }
          }
        })

        return books.map((book) => ({
          ...book,
          role: book.role[0],
          owner: book.user[0]
        }))
      },
      async findUnique(id: string): Promise<BookWithRoleAndOwner | null> {
        const book = await pris.book.findUnique({
          where: {
            id: id
          },
          include: {
            role: true,
            user: {
              where: {
                books: {
                  every: {
                    role: {
                      some: {
                        permision: 'OWNER'
                      }
                    }
                  }
                }
              }
            }
          }
        })

        if (!book) {
          return null
        }

        return {
          ...book,
          role: book.role[0],
          owner: book.user[0]
        }
      },
      async exists(id: string): Promise<boolean> {
        return !!(await pris.book.findUnique({
          where: {
            id: id
          }
        }))
      }
    }
  }
})

export default prisma