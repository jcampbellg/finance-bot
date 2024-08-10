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
    const categoryId = conversation.edit.categoryId

    if (!categoryId) {
      await notFoundError(params)
      return
    }

    const update = await xprisma.category.update(user, categoryId, {
      description: title
    })

    if (!update) {
      await notFoundError(params)
      return
    }

    await budgetItemViewMenuMessage(params, { itemId: categoryId, type: update.type })
  })
}