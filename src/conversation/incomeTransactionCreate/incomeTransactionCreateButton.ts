import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step2 from './step2'

export default async function incomeTransactionCreateButton(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  if (btnPress === 'income_transaction_create') {
    await step1(params)
    return
  }

  if (conversation.subSubject === 'income') {
    await step2(params)
    return
  }
}