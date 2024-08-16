import noTransactionError from '@botMessage/errors/noTransactionError'
import upsError from '@botMessage/errors/upsError'
import { transactionGroupNotificationDeleteMessage } from '@botMessage/transaction/transactionGroupNotificationMessage'
import menuBtn from '@buttons/menuBtn'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { bot, conversation, user, query, chatId } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = conversation.edit.transactionId || ''

  const transactionToDelete = await xprisma.transaction.findUnique(user, transactionId)

  if (!transactionToDelete) {
    await noTransactionError(params)
    return
  }

  // delete notification
  transactionGroupNotificationDeleteMessage(params, transactionToDelete)

  const success = await xprisma.transaction.delete(user, transactionId)

  if (!success) {
    await upsError(params)
    return
  }

  await bot.editMessageText('Tu transación ha sido eliminada', {
    chat_id: chatId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}