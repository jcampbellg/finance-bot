import { BookWithRoleAndOwner, ByncUser } from '@customTypes/prismaTypes'
import { Prisma, PrismaClient } from '@prisma/client'

const prsma = new PrismaClient()

const prisma = prsma.$extends({
  model: {
    user: {
      async auth(userId: number): Promise<ByncUser> {
        const user = await prsma.user.upsert({
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
                role: {
                  where: {
                    user: {
                      telegramId: userId
                    }
                  }
                }
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
        const user = await prsma.user.update({
          where: {
            telegramId: userId
          },
          data: data,
          include: {
            bookSelected: {
              include: {
                role: {
                  where: {
                    user: {
                      telegramId: userId
                    }
                  }
                }
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
      }
    },
    conversation: {
      async removeLastMessage(userId: number) {
        await prsma.conversation.updateMany({
          where: {
            user: {
              telegramId: userId
            }
          },
          data: {
            messageId: null
          }
        })

      },
      async update(id: string, data: Omit<Prisma.ConversationUpdateInput, 'id'>) {
        return await prsma.conversation.update({
          where: {
            id: id
          },
          data: data
        })
      },
      async updateSubject(id: string, subject?: string, subSubject?: string) {
        return await prsma.conversation.update({
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
        return await prsma.conversation.update({
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
        const newBook = await prsma.book.create({
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
            role: {
              where: {
                userId: user.id
              }
            }
          }
        })

        return {
          ...newBook,
          role: newBook.role[0],
          owner: user
        }
      },
      async findManyWithAccess(user: ByncUser): Promise<BookWithRoleAndOwner[]> {
        const books = await prsma.book.findMany({
          where: {
            user: {
              some: {
                id: user.id
              }
            }
          },
          include: {
            role: {
              where: {
                userId: user.id
              }
            },
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
      async findUniqueWithAccess(user: ByncUser, id: string): Promise<BookWithRoleAndOwner | null> {
        const book = await prsma.book.findFirst({
          where: {
            AND: [
              {
                id: id
              },
              {
                user: {
                  some: {
                    id: user.id
                  }
                }
              }
            ]
          },
          include: {
            role: {
              where: {
                userId: user.id
              }
            },
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
        return !!(await prsma.book.findUnique({
          where: {
            id: id
          }
        }))
      }
    }
  }
})

export default prisma