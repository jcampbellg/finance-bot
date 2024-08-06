import noSplitTransactionError from '@botMessage/errors/noSplitTransactionError'
import noTransactionError from '@botMessage/errors/noTransactionError'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { query, bot, chatId, conversation, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_split_', '')

  if (!transactionId) {
    noTransactionError(params)
    return
  }

  const parent = await xprisma.transaction.findUnique(user, transactionId)

  if (!parent) {
    noTransactionError(params)
    return
  }

  if (parent.type !== 'EXPENSE') {
    await noSplitTransactionError(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_split',
    subSubject: 'amount',
    edit: {
      transactionId
    }
  })

  await bot.editMessageText('✂️ ¿Cuál es el monto a dividir?', {
    chat_id: chatId,
    message_id: query.message.message_id
  })
}