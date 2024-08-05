import noTransactionError from '@botMessage/errors/noTransactionError'
import upsError from '@botMessage/errors/upsError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import amountReply from '@conversation/utils/amountReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { conversation, user, ctx } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const transactionId = conversation.edit.transactionId || ''

  const transaction = await xprisma.transaction.findUnique(user, transactionId)

  if (!transaction) {
    await noTransactionError(params)
    return
  }

  await amountReply(params, async (amount) => {
    const updateTransaction = await xprisma.transaction.update(user, transaction.id, { amount })

    if (!updateTransaction) {
      await upsError(params)
      return
    }

    await transactionViewMenuMessage(params, transaction.id)
  })

}