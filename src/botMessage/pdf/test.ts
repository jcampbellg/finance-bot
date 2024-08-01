import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'

export default async function test(params: ConversationPropsWithBookSelected) {
  const { query } = params

  if (!query) {
    throw new Error('query is required')
  }

}