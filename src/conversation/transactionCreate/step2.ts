import accountsListMessage from '@botMessage/account/accountsListMessage'
import stringReply from '@conversation/utils/stringReply'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step2(params: ConversationPropsWithBookSelected) {
  const { conversation, ctx } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  await stringReply(params, async (description) => {
    await xprisma.conversation.update(conversation.id, {
      subSubject: 'account',
      edit: {
        ...conversation.edit,
        description
      }
    })

    await accountsListMessage(params, {
      text: `¡Gracias!\nAhora, ¿puedes decirme la cuenta a la que se aplica esta transacción?\n\n<i>O puedas crear una cuenta nueva: ¿Cómo te gustaría llamarla?</i>`,
      callbackPrefix: `account_select_`,
      btn: 'end'
    })
  })
}