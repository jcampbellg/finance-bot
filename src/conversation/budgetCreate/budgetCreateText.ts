import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import step2 from './step2'

export default async function budgetCreateText(params: ConversationPropsWithBookSelected) {
  const { ctx } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await step2(params)
}