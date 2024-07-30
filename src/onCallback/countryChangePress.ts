import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function countryChangePress(params: ConversationProps) {
  const { bot, query, conversation, chatId, firstName } = params

  if (!query) {
    throw new Error('query is required')
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subSubject: 'countrySearch'
  })

  await bot.editMessageText(`¡Claro, ${firstName}! ¿Podrías decirme en qué país vives?\n¡Gracias!`, {
    message_id: query.message.message_id,
    chat_id: chatId
  })
}