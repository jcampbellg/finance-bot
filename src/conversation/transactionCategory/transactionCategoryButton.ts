import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step2 from './step2'

export default async function transactionCategoryButton(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data.startsWith('transaction_category_')) {
    await step1(params)
  }

  if (conversation.subSubject === 'category') {
    await step2(params)
  }
}