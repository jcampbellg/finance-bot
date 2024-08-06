import { ConversationProps } from '@customTypes/messageTypes'
import step2 from './step2'

export default async function bookShareText(params: ConversationProps) {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'userId') {
    await step2(params)
    return
  }
}