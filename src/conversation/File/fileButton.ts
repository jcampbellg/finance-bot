import { ConversationPropsWithBookSelected, FileSubject } from '@customTypes/messageTypes'
import step1 from './step1'
import xprisma from '@utils/xprisma'

export default async function fileButton(params: ConversationPropsWithBookSelected, subject: FileSubject) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  const objectId = btnPress.replace(`file_${subject}_`, '')

  await xprisma.conversation.update(conversation.id, {
    subject: subject,
    subSubject: 'file',
    edit: {
      objectId
    }
  })

  await step1(params)
}