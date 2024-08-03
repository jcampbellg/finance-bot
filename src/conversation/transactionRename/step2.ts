import noBookError from '@botMessage/errors/noBookError'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await stringReply(params, async (description) => {
    const transactionId = conversation.edit.transactionId

    if (!transactionId) {
      await noBookError(params)
      return
    }

    await xprisma.transaction.update(user, transactionId, {
      description: description
    })

    await transactionViewMenuMessage(params, transactionId)
  })
}