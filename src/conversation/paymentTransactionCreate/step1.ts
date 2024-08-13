import categoriesListMessage from '@botMessage/category/categoriesListMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation } = params

  await xprisma.conversation.update(conversation.id, {
    subject: 'payment_transaction_create',
    subSubject: 'payment',
    edit: {
      type: 'PAYMENT'
    }
  })

  await categoriesListMessage(params, {
    text: `Por favor, selecciona un pago fijo de tu presupuesto.`,
    callbackPrefix: `payment_select_`,
    btn: 'end',
    type: 'PAYMENT'
  })
}