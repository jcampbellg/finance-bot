import { MsgAndQueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { waitingForCommandNoBook } from '@conversations/waitingForCommand'

export default async function auth({ bot, msg, query }: MsgAndQueryProps, inBooks: boolean = false) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    }
  })

  if (!user) {
    await bot.sendMessage(userId, 'No se encontró el usuario.\n\n Usa /start para comenzar.')
    return {
      user: null,
      book: null,
      userId
    }
  }

  if (user.bookSelectedId === null) {
    if (!inBooks) {
      await waitingForCommandNoBook({ bot, msg, query } as MsgAndQueryProps)
    }
    return {
      user,
      book: null,
      userId
    }
  }

  const book = await prisma.book.findFirst({
    where: {
      AND: [
        {
          id: user.bookSelectedId
        },
        {
          OR: [
            {
              ownerId: userId
            },
            {
              shares: {
                some: {
                  shareWithUserId: userId
                }
              }
            }
          ]
        }
      ]
    },
    include: {
      owner: true,
      shares: {
        include: {
          shareWithGroup: true,
          shareWithuser: true
        }
      }
    }
  })

  if (!book) {
    if (!inBooks) {
      await waitingForCommandNoBook({ bot, msg, query } as MsgAndQueryProps)
    }

    return {
      user,
      book: null,
      userId
    }
  }

  return {
    user,
    book,
    userId
  }
}