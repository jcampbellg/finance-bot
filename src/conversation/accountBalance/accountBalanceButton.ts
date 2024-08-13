import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step1 from './step1'
import step3 from './step3'

export default async function accountBalanceButton(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  if (conversation.subSubject === 'currency') {
    await step3(params)
    return
  }

  await step1(params)
}