import paymentsListMessage from '@botMessage/payment/paymentsListMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation } = params

  await xprisma.conversation.update(conversation.id, {
    subject: 'payment_transaction_create',
    subSubject: 'payment',
    edit: {
      type: 'payment'
    }
  })

  await paymentsListMessage(params, {
    text: `Por favor, selecciona un pago fijo de tu presupuesto.`,
    callbackCreate: `payment_create`,
    callbackAccountPrefix: `payment_select_`,
    btn: 'end'
  })
}