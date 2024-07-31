import { ConversationProps } from '@customTypes/messageTypes'
import step1 from './step1'
import step2 from './step2'

export default async function startText(params: ConversationProps) {
  const { ctx, conversation, text } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (text === '/start') {
    step1(params)
    return
  }

  if (conversation.subSubject === 'country_search') {
    step2(params)
    return
  }
}