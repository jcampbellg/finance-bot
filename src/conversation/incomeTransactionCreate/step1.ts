import paymentsListMessage from '@botMessage/payment/paymentsListMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation } = params

  await xprisma.conversation.update(conversation.id, {
    subject: 'income_transaction_create',
    subSubject: 'income',
    edit: {
      type: 'INCOME'
    }
  })

  await paymentsListMessage(params, {
    text: `Por favor, selecciona un pago fijo de tu presupuesto.`,
    callbackCreate: `income_create`,
    callbackAccountPrefix: `income_select_`,
    btn: 'end',
    filterNotPaid: true
  })
}