import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function noUserSend(params: ConversationProps) {
  const { bot, conversation, chatId } = params

  await xprisma.conversation.waiting(conversation.id)

  await bot.sendMessage(chatId, `Parece que el usuario que buscas no existe. 😕`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        menuBtn
      ]
    }
  })
}