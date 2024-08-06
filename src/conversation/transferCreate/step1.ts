import accountsListMessage from '@botMessage/account/accountsListMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function step1(params: ConversationPropsWithBookSelected) {
  const { conversation } = params

  const keySub = conversation.subSubject === 'amount-a' ? 'account-b' : 'account-a'

  xprisma.conversation.update(conversation.id, {
    subject: 'transfer_create',
    subSubject: keySub
  })

  await accountsListMessage(params, {
    text: `¿Puedes decirme ${keySub === 'account-a' ? 'desde' : 'a'} que cuenta ${keySub === 'account-a' ? 'origen' : 'destino'} se aplica la transferencia?`,
    callbackCreate: `account_create`,
    callbackPrefix: `account_select_`,
    btn: 'end'
  })
}