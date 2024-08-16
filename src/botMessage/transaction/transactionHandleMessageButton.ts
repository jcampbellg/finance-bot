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
import fileDeleteMessage from '@botMessage/file/fileDeleteMessage'
import transactionTagButton from '@conversation/transactionTag/transactionTagButton'
import transactionCategoryButton from '@conversation/transactionCategory/transactionCategoryButton'
import transactionSplitButton from '@conversation/transactionSplit/transactionSplitButton'
import transactionViewFilesMessage from './transactionViewFilesMessage'
import step1 from '@conversation/transactionCreate/step1'
import { Edit } from '@customTypes/prismaTypes'

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

  if (btnPress.startsWith('transaction_files_')) {
    await transactionViewFilesMessage(params)
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

  if (btnPress.startsWith('transaction_create_expense_') || btnPress.startsWith('transaction_create_deposit_')) {
    const categoryId = btnPress.replace('transaction_create_expense_', '').replace('transaction_create_deposit_', '')
    const newEdit: Edit = {
      categoryId,
      type: btnPress.startsWith('transaction_create_expense_') ? 'EXPENSE' : 'DEPOSIT'
    }

    // Go to normal transaction flow
    await step1(params, newEdit)
  }

  if (btnPress === 'payment_transaction_create' || conversation.subject === 'payment_transaction_create') {
    await paymentTransactionCreateButton(params)
    return true
  }

  if (btnPress.startsWith('payment_transaction_create_')) {
    const paymentId = btnPress.replace('payment_transaction_create_', '')
    const newEdit: Edit = {
      categoryId: paymentId,
      type: 'PAYMENT'
    }

    // Go to normal transaction flow
    await step1(params, newEdit)
  }

  if (btnPress === 'income_transaction_create' || conversation.subject === 'income_transaction_create') {
    await incomeTransactionCreateButton(params)
    return true
  }

  if (btnPress.startsWith('income_transaction_create_')) {
    const incomeId = btnPress.replace('income_transaction_create_', '')
    const newEdit: Edit = {
      categoryId: incomeId,
      type: 'INCOME'
    }

    // Go to normal transaction flow
    await step1(params, newEdit)
  }

  if (btnPress.startsWith('transaction_file_')) {
    await transactionFileButton(params)
    return true
  }

  if (btnPress.startsWith('file_delete_')) {
    await fileDeleteMessage(params)
    return true
  }

  if (btnPress.startsWith('transaction_tag_')) {
    await transactionTagButton(params)
    return true
  }

  if (btnPress.startsWith('transaction_category_') || conversation.subject === 'transaction_category') {
    await transactionCategoryButton(params)
    return true
  }

  if (btnPress.startsWith('transaction_split_')) {
    await transactionSplitButton(params)
    return true
  }

  return false
}