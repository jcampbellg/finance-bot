import noTransactionError from '@botMessage/errors/noTransactionError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const transactionId = conversation.edit.transactionId

  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  await stringReply(params, async (string) => {
    await xprisma.transaction.update(user, transactionId, {
      tags: string.split(',').map((tag) => tag.trim())
    })

    await transactionViewMenuMessage(params, transactionId)
  })
}