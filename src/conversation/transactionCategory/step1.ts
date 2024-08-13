import categoriesListMessage from '@botMessage/category/categoriesListMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const transactionId = query.data.replace('transaction_category_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction_category',
    subSubject: 'category',
    edit: {
      transactionId
    }
  })

  await categoriesListMessage(params, {
    text: `Por favor, selecciona una categoría de tu presupuesto.\n\n<i>O puedas crear una categoría nueva: ¿Cómo te gustaría llamarla?</i>`,
    callbackPrefix: `category_select_`,
    btn: 'end'
  })
}