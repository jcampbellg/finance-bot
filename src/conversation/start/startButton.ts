import { ConversationProps } from '@customTypes/messageTypes'
import step3 from './step3'
import step1 from './step1'
import step4 from './step4'

export default async function startBot(params: ConversationProps): Promise<boolean> {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  if (btnPress === 'country_change') {
    await step1(params)
    return true
  }

  if (conversation.subSubject === 'country_select') {
    await step3(params)
  }

  if (conversation.subSubject === 'timezone_select') {
    await step4(params)
  }

  if (conversation.subSubject === 'ready') {
    return false
  }

  return true
}