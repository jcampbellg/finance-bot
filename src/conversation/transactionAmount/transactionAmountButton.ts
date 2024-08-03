import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'

export default async function transactionAmountButton(params: ConversationPropsWithBookSelected) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data.startsWith('transaction_amount_')) {
    await step1(params)
    return
  }
}