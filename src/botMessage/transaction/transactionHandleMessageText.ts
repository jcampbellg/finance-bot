import incomeTransactionCreateText from '@conversation/incomeTransactionCreate/incomeTransactionCreateText'
import paymentTransactionCreateText from '@conversation/paymentTransactionCreate/paymentTransactionCreateText'
import transactionAmountText from '@conversation/transactionAmount/transactionAmountText'
import transactionCreateText from '@conversation/transactionCreate/transactionCreateText'
import transactionDateText from '@conversation/transactionDate/transactionDateText'
import transactionRenameText from '@conversation/transactionRename/transactionRenameText'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import transactionFileText from '@conversation/transactionFile/transactionFileText'
import transactionTagText from '@conversation/transactionTag/transactionTagText'
import transactionCategoryText from '@conversation/transactionCategory/transactionCategoryText'
import transactionSplitText from '@conversation/transactionSplit/transactionSplitText'

export default async function transactionHandleMessageText(params: ConversationPropsWithBookSelected): Promise<boolean> {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subject === 'transaction_create') {
    await transactionCreateText(params)
    return true
  }

  if (conversation.subject === 'payment_transaction_create') {
    await paymentTransactionCreateText(params)
    return true
  }

  if (conversation.subject === 'income_transaction_create') {
    await incomeTransactionCreateText(params)
    return true
  }

  if (conversation.subject === 'transaction_rename') {
    await transactionRenameText(params)
    return true
  }

  if (conversation.subject === 'transaction_amount') {
    await transactionAmountText(params)
    return true
  }

  if (conversation.subject === 'transaction_date' || conversation.subject === 'transaction_paid_date') {
    await transactionDateText(params)
    return true
  }

  if (conversation.subject === 'transaction_file') {
    await transactionFileText(params)
    return true
  }

  if (conversation.subject === 'transaction_tag') {
    await transactionTagText(params)
    return true
  }

  if (conversation.subject === 'transaction_category') {
    await transactionCategoryText(params)
    return true
  }

  if (conversation.subject === 'transaction_split') {
    await transactionSplitText(params)
    return true
  }

  return false
}