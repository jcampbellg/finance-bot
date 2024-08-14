import budgetItemViewMenuMessage from '@botMessage/budget/budgetItemViewMenuMessage'
import notFoundError from '@botMessage/errors/notFoundError'
import upsError from '@botMessage/errors/upsError'
import currencyReply from '@conversation/utils/currencyReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step3(params: ConversationPropsWithBookSelected) {
  const { conversation, user } = params

  const categoryId = conversation.edit.accountId || ''

  const category = await xprisma.category.findUniqueById(user, categoryId)

  if (!category) {
    await notFoundError(params)
    return
  }

  await currencyReply(params, async (currency) => {
    if (!conversation.edit.amount) {
      await upsError(params)
      return
    }

    await xprisma.category.updateLimit(user, category, {
      amount: conversation.edit.amount,
      currency
    })

    await budgetItemViewMenuMessage(params, { isAccount: false, itemId: categoryId })
  })
}