import categoriesListMessage from '@botMessage/category/categoriesListMessage'
import amountReply from '@conversation/utils/amountReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  await amountReply(params, async (amount) => {
    await xprisma.conversation.update(conversation.id, {
      subSubject: 'category',
      edit: {
        ...conversation.edit,
        amount
      }
    })

    await categoriesListMessage(params, {
      text: '🗂️ ¿A qué categoría pertenece este nuevo monto?',
      btn: 'end',
      callbackPrefix: 'transaction_split_category_',
      callbackCreate: 'category_create'
    })
  })
}