import categoriesListMessage from '@botMessage/category/categoriesListMessage'
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

  await categoriesListMessage(params, {
    text: `Por favor, selecciona un ingreso de tu presupuesto.\n\n<i>O puedas crear un nuevo ingreso: ¿Cómo te gustaría llamarla?</i>`,
    callbackPrefix: `income_select_`,
    btn: 'end',
    type: 'INCOME'
  })
}