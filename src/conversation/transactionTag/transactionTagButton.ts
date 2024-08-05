import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'

export default async function transactionTagButton(params: ConversationPropsWithBookSelected) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

  await step1(params)
}