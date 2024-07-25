import { ByncUser } from '@customTypes/prismaTypes'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient().$extends({
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
    }
  }
})

export default prisma