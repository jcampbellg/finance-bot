import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step3 from './step3'

export default async function transactionSplitButton(params: ConversationPropsWithBookSelected) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (query.data.startsWith('category_select_') || query.data === 'category_create') {
    await step3(params)
    return
  }

  await step1(params)
}