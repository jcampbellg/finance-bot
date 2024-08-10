import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function noCategoryError(params: ConversationProps) {
  const { bot, conversation, chatId } = params

  await xprisma.conversation.waiting(conversation.id)

  await bot.sendMessage(chatId, `Parece que la categoría que buscas no existe o no tienes acceso a el. 😕`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}