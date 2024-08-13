import searchMessage from '@botMessage/search/searchMessage'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'

export default async function searchByText(params: ConversationPropsWithBookSelected) {
  const { ctx } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await stringReply(params, async (searchFor) => {
    await searchMessage(params, searchFor)
  })
}