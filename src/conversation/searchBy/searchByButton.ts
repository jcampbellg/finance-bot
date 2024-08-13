import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function searchByButton(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subject: 'search_by'
  })

  await bot.editMessageText(`🔎 Escribe el parametro de tu busqueda.`, {
    chat_id: chatId,
    message_id: query.message.message_id
  })
}