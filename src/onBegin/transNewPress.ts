import { ConversationProps } from '@customTypes/messageTypes'
import noBookSelectedSend from '@onSend/noBookSelectedSend'
import { TRANS_SUBJECT } from '@utils/constant'
import xprisma from '@utils/xprisma'

export default async function transNewPress(params: ConversationProps) {
  const { bot, query, conversation, chatId, bookSelected } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (!bookSelected) {
    noBookSelectedSend(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'transNew',
    subSubject: 'description',
    edit: {
      type: TRANS_SUBJECT[query.data],
    }
  })

  await bot.sendMessage(chatId, `🧾 Vamos a crear una nueva transacción.\nPrimero, por favor proporciona una breve descripción de la transacción.`)
}