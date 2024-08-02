import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step2 from './step2'

export default async function paymentTransactionCreateButton(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  if (btnPress === 'payment_transaction_create') {
    await step1(params)
    return
  }

  if (conversation.subSubject === 'payment') {
    await step2(params)
    return
  }
}