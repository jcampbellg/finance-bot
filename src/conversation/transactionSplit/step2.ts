import noTransactionError from '@botMessage/errors/noTransactionError'
import upsError from '@botMessage/errors/upsError'
import transactionGroupNotificationMessage from '@botMessage/transaction/transactionGroupNotificationMessage'
import transactionViewMenuMessage from '@botMessage/transaction/transactionViewMenuMessage'
import amountReply from '@conversation/utils/amountReply'
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

  await amountReply(params, async (amount) => {
    const parent = await xprisma.transaction.findUnique(user, transactionId)

    if (!parent) {
      await noTransactionError(params)
      return
    }

    const children = await xprisma.transaction.create(user, {
      amount: amount,
      currency: parent.currency,
      description: parent.description,
      search: parent.search,
      type: parent.type,
      accountId: parent.accountId,
      tags: parent.tags,
      tagsSearch: parent.tagsSearch,
      paidAt: parent.paidAt,
      categoryId: parent.categoryId,
    })

    if (!children) {
      await upsError(params)
      return
    }

    await transactionGroupNotificationMessage(params, children)

    const update = await xprisma.transaction.update(user, parent.id, {
      amount: parent.amount - amount
    })

    if (!!update) {
      await transactionGroupNotificationMessage(params, update)
    }

    await xprisma.split.create(user, parent, children)

    await transactionViewMenuMessage(params, transactionId)
  })
}