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

  const transactionId = conversation.edit.transactionId

  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  await stringReply(params, async (string) => {
    const update = conversation.subject === 'transaction_tag' ? await xprisma.transaction.update(user, transactionId, {
      tags: string.split(',').map((tag) => tag.trim()),
      tagsSearch: string.split(',').map((tag) => parseSearch(tag.trim()))
    }) : await xprisma.transaction.update(user, transactionId, {
      tags: {
        push: string.split(',').map((tag) => tag.trim()),
      },
      tagsSearch: {
        push: string.split(',').map((tag) => parseSearch(tag.trim()))
      }
    })

    if (!update) {
      await noTransactionError(params)
      return
    }

    await transactionGroupNotificationMessage(params, update)
    await transactionViewMenuMessage(params, transactionId)
  })
}