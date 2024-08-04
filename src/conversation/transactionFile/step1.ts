import endBtn from '@buttons/endBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { bot, chatId, query } = params

  if (!query) {
    throw new Error('query is required')
  }

  await bot.editMessageText(`📎 Por favor, envía tu archivo o foto aquí.`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [endBtn]
    }
  })
}