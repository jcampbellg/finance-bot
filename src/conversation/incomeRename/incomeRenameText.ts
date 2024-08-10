import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step2 from './step2'

export default async function categoryRenameText(params: ConversationPropsWithBookSelected) {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  if (conversation.subSubject === 'description') {
    step2(params)
    return
  }
}