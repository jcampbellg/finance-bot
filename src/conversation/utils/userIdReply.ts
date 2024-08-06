import menuBtn from '@buttons/menuBtn'
import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { ByncUser } from '@customTypes/prismaTypes'
import xprisma from '@utils/xprisma'

export default async function userIdReply(params: ConversationProps, next: NextFunction<ByncUser>) {
  const { ctx, text, bot, conversation, chatId } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const userShare = await xprisma.user.findUnique(text)

  if (!userShare) {
    await xprisma.conversation.waiting(conversation.id)

    await bot.sendMessage(chatId, `Parece que el usuario que buscas no existe. 😕`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          menuBtn
        ]
      }
    })
    return
  }

  next(userShare)
}