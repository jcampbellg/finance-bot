import menuBtn from '@buttons/menuBtn'
import { ConversationProps, ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function BookSelectedWrapper(params: ConversationProps, next: (params: ConversationPropsWithBookSelected) => Promise<void>) {
  const { bot, conversation, chatId, bookSelected } = params

  if (!bookSelected) {
    await xprisma.conversation.waiting(conversation.id)
    await bot.sendMessage(chatId, 'Necesitas seleccionar un libro. 😕', {
      reply_markup: {
        inline_keyboard: [menuBtn]
      }
    })
    return
  }

  await next(params)
}