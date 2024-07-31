import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function upsError(params: ConversationProps) {
  const { bot, conversation, chatId } = params

  await xprisma.conversation.waiting(conversation.id)

  await bot.sendMessage(chatId, `¡Ups! Algo salió mal. 😕\nPor favor, inténtalo de nuevo.\n¡Gracias por tu paciencia!`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}