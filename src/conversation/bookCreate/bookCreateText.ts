import { ConversationProps } from '@customTypes/messageTypes'
import step2 from './step2'

export default async function bookCreateText(params: ConversationProps) {
  const { conversation, ctx } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'description') {
    step2(params)
    return
  }
}