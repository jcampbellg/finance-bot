import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_tag_add_', '').replace('transaction_tag_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: query.data.startsWith('transaction_tag_add') ? 'transaction_tag_add' : 'transaction_tag',
    subSubject: 'tag',
    edit: {
      transactionId: transactionId
    }
  })

  await bot.sendMessage(chatId, 'Escribe las etiquetas separadas por comas.')
}