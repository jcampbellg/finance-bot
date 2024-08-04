import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import transactionViewMenuMessage from './transactionViewMenuMessage'
import transactionPaidNowMessage from './transactionPaidNowMessage'
import transactionPaidCancelMessage from './transactionPaidCancelMessage'
import transactionCreateButton from '@conversation/transactionCreate/transactionCreateButton'
import paymentTransactionCreateButton from '@conversation/paymentTransactionCreate/paymentTransactionCreateButton'
import incomeTransactionCreateButton from '@conversation/incomeTransactionCreate/incomeTransactionCreateButton'
import transactionRenameButton from '@conversation/transactionRename/transactionRenameButton'
import transactionDeleteButton from '@conversation/transactionDelete/transactionDeleteButton'
import transactionAmountButton from '@conversation/transactionAmount/transactionAmountButton'
import transactionDateButton from '@conversation/transactionDate/transactionDateButton'
import transactionFileButton from '@conversation/transactionFile/transactionFileButton'

export default async function transactionHandleMessageButton(params: ConversationPropsWithBookSelected): Promise<boolean> {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  if (btnPress.startsWith('transaction_view_')) {
    await transactionViewMenuMessage(params)
    return true
  }

  if (btnPress.startsWith('transaction_paid_now_')) {
    await transactionPaidNowMessage(params)
    return true
  }

  if (btnPress.startsWith('transaction_paid_cancel_')) {
    await transactionPaidCancelMessage(params)
    return true
  }

  if (btnPress.startsWith('transaction_rename_')) {
    await transactionRenameButton(params)
    return true
  }

  if (btnPress.startsWith('transaction_amount_')) {
    await transactionAmountButton(params)
    return true
  }

  if (btnPress.startsWith('transaction_date_') || btnPress.startsWith('transaction_paid_date_')) {
    await transactionDateButton(params)
    return true
  }

  if (btnPress.startsWith('transaction_delete_') || conversation.subject === 'transaction_delete') {
    await transactionDeleteButton(params)
    return true
  }

  if (['transaction_create_expense', 'transaction_create_deposit'].indexOf(btnPress) !== -1 || conversation.subject === 'transaction_create') {
    await transactionCreateButton(params)
    return true
  }

  if (btnPress === 'payment_transaction_create' || conversation.subject === 'payment_transaction_create') {
    await paymentTransactionCreateButton(params)
    return true
  }

  if (btnPress === 'income_transaction_create' || conversation.subject === 'income_transaction_create') {
    await incomeTransactionCreateButton(params)
    return true
  }

  if (btnPress.startsWith('transaction_file')) {
    await transactionFileButton(params)
    return true
  }

  return false
}