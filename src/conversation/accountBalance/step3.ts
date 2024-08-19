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

  await currencyReply(params, async (symbol) => {
    const amount = conversation.edit.amount
    if (!amount) {
      await upsError(params)
      return
    }

    const currency = account.currency.find(c => c.symbol === symbol)

    await xprisma.account.update(user, accountId, {
      currency: {
        ...(!currency ? { create: { symbol: symbol, balance: amount } } : {}),
        ...(!!currency ? { update: { where: { id: currency.id }, data: { balance: amount } } } : {})
      }
    })

    await budgetItemViewMenuMessage(params, { isAccount: true, itemId: accountId })
  })
}