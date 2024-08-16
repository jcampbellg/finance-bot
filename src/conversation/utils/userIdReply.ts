import menuBtn from '@buttons/menuBtn'
import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { ByncUser } from '@customTypes/prismaTypes'
import { GroupChat } from '@prisma/client'
import xprisma from '@utils/xprisma'

type ByncUserOrGroupChat = {
  user?: ByncUser
  groupChat?: GroupChat
}

export default async function userIdReply(params: ConversationProps, next: NextFunction<ByncUserOrGroupChat>) {
  const { ctx, text, bot, conversation, chatId } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const userShare = await xprisma.user.findUnique(text)

  if (userShare) {
    await xprisma.conversation.waiting(conversation.id)
    next({ user: userShare })
    return
  }

  const groupShare = await xprisma.groupChat.findUnique({ where: { id: text } })

  if (groupShare) {
    await xprisma.conversation.waiting(conversation.id)
    next({ groupChat: groupShare })
    return
  }

  await bot.sendMessage(chatId, `Parece que el usuario o libro que buscas no existe. 😕`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        menuBtn
      ]
    }
  })
}