import budgetItemViewMenuMessage from '@botMessage/budget/budgetItemViewMenuMessage'
import noAccountError from '@botMessage/errors/noAccountError'
import upsError from '@botMessage/errors/upsError'
import currencyReply from '@conversation/utils/currencyReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step3(params: ConversationPropsWithBookSelected) {
  const { conversation, user } = params

  const accountId = conversation.edit.accountId || ''

  const account = await xprisma.account.findUnique(user, accountId)

  if (!account) {
    await noAccountError(params)
    return
  }

  await currencyReply(params, async (currency) => {
    if (!conversation.edit.amount) {
      await upsError(params)
      return
    }

    await xprisma.balance.userSet(user, {
      accountId,
      symbol: currency,
      amount: conversation.edit.amount
    })

    await budgetItemViewMenuMessage(params, { isAccount: true, itemId: accountId })
  })
}