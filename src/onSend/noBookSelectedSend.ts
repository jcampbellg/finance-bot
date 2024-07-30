import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import menuBtn from '@buttons/menuBtn'

export default async function noBookSelectedSend(params: ConversationProps) {
  const { bot, conversation, chatId } = params

  await xprisma.conversation.waiting(conversation.id)
  await bot.sendMessage(chatId, 'Necesitas seleccionar un libro. 😕', {
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}