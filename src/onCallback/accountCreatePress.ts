import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export async function accountCreatePress(params: ConversationProps) {
  const { query, bot, chatId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  await xprisma.conversation.update(conversation.id, {
    subSubject: 'accountCreate'
  })

  await bot.editMessageText(`🏦Vamos a crear una nueva cuenta.\nPor favor proporciona una breve descripción de la cuenta.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}