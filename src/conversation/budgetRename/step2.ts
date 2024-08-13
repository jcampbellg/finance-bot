import budgetItemViewMenuMessage from '@botMessage/budget/budgetItemViewMenuMessage'
import notFoundError from '@botMessage/errors/notFoundError'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await stringReply(params, async (title) => {
    const itemId = conversation.edit.categoryId || conversation.edit.accountId
    const isCategory = conversation.subject === 'category_rename'

    if (!itemId) {
      await notFoundError(params)
      return
    }

    const update = isCategory ? await xprisma.category.update(user, itemId, {
      description: title
    }) : await xprisma.account.update(user, itemId, {
      description: title
    })

    if (!update) {
      await notFoundError(params)
      return
    }

    // @ts-ignore
    await budgetItemViewMenuMessage(params, { itemId: itemId, isAccount: !isCategory })
  })
}