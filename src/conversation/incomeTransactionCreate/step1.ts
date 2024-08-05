import incomesListMessage from '@botMessage/income/incomesListMessage'
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

  await incomesListMessage(params, {
    text: `Por favor, selecciona un ingreso de tu presupuesto.`,
    callbackCreate: `income_create`,
    callbackAccountPrefix: `income_select_`,
    btn: 'end'
  })
}