import noTransactionError from '@botMessage/errors/noTransactionError'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import { botTransaction } from './transactionViewMenuMessage'

export default async function transactionPaidCancelMessage(params: ConversationPropsWithBookSelected, transactionIdImport?: string) {
  const { query, user } = params

  await xprisma.conversation.waiting(params.conversation.id)

  const transactionId = transactionIdImport || query?.data.replace('transaction_paid_cancel_', '')

  if (!transactionId) {
    await noTransactionError(params)
    return
  }

  const transaction = await xprisma.transaction.update(user, transactionId, {
    paidAt: null,
    balance: {
      disconnect: true
    }
  })

  if (!transaction || transaction.type === 'DEPOSIT' || transaction.type === 'EXPENSE') {
    await noTransactionError(params)
    return
  }

  // Update the balance
  const currency = await xprisma.currency.findOrCreate(user, transaction.accountId, transaction.currency)
  if (currency) {
    const sum = transaction.type === 'PAYMENT' ? +transaction.amount : -transaction.amount
    await xprisma.balance.fix(user, currency.id, sum)
  }

  await botTransaction(params, transaction)
  return
}