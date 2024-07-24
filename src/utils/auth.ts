import { ConversationProps, MsgOrQueryProps } from '@customTypes/messageTypes'
import prisma from '@utils/prisma'
import { waitingForCommandNoBook } from '@conversations/waitingForCommand'

export default async function auth({ bot, msg, query }: MsgOrQueryProps, inBooks: boolean = false): Promise<ConversationProps> {
  const userId = msg?.chat.id || query?.message.chat.id as number
  const text = msg?.text?.trim() || ''

  const user = await prisma.user.upsert({
    where: {
      telegramId: userId
    },
    create: {
      telegramId: userId,
      conversation: {
        create: {
          subject: 'start'
        }
      }
    },
    update: {},
    include: {
      bookSelected: true,
      books: true,
      conversation: true
    }
  })

  if (!user.bookSelected) {
    if (!inBooks) {
      await waitingForCommandNoBook({
        userId,
        user,
        text,
        bot,
        msg,
        query
      } as ConversationProps)
    }

    return {
      userId,
      user,
      text,
      bot,
      msg,
      query
    } as ConversationProps
  }

  return {
    userId,
    user,
    text,
    bot,
    msg,
    query
  } as ConversationProps
}