import noTransactionError from '@botMessage/errors/noTransactionError'
import transactionGroupNotificationMessage from '@botMessage/transaction/transactionGroupNotificationMessage'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import parseSearch from '@utils/parseSearch'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await stringReply(params, async (description) => {
    const transactionId = conversation.edit.transactionId

    if (!transactionId) {
      await noTransactionError(params)
      return
    }

    const update = await xprisma.transaction.update(user, transactionId, {
      description: description,
      search: parseSearch(description)
    })

    if (!update) {
      await noTransactionError(params)
      return
    }

    await transactionGroupNotificationMessage(params, update)
    await transactionViewMenuMessage(params, transactionId)
  })
}