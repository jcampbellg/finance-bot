import { ConversationProps } from '@customTypes/messageTypes'
import noBookSend from '@onSend/noBookSend'
import xprisma from '@utils/xprisma'

export default async function transExpenseNewPress(params: ConversationProps) {
  const { bot, query, conversation, chatId, bookSelected } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (!bookSelected) {
    noBookSend(params)
    return
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subject: 'transExpenseNew',
    subSubject: 'description'
  })

  await bot.sendMessage(chatId, `🧾 Vamos a crear una nueva transacción.\nPrimero, por favor proporciona una breve descripción de la transacción.`)
}