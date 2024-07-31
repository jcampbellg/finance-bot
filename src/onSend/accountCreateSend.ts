import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import upsSend from './upsSend'
import noBookSelectedSend from './noBookSelectedSend'

export default async function accountCreateSend(params: ConversationProps, description: string) {
  const { bot, chatId, user, conversation, bookSelected } = params

  if (!bookSelected) {
    await noBookSelectedSend(params)
    return
  }

  if (!description) {
    await upsSend(params)
    return
  }

  const newAccount = await xprisma.account.create(user, description)

  if (!newAccount) {
    upsSend(params)
    return
  }

  if (conversation.subject === 'transNew' || conversation.subject === 'transNew') {
    await xprisma.conversation.update(conversation.id, {
      subject: 'currency',
      edit: {
        ...conversation.edit,
        accountId: newAccount.id
      }
    })
    await bot.sendMessage(chatId, `¡Gracias! ¿En qué moneda se realizará esta transacción?`, {
      reply_markup: {
        inline_keyboard: [
          menuBtn
        ]
      }
    })
    return
  }

  await bot.sendMessage(chatId, `¡Perfecto!\nTu cuenta "${description}" ha sido creada.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `🏦 Ver Cuenta`, callback_data: `account_view_${newAccount.id}` }, { text: '🔎 Ver Cuentas', callback_data: 'accounts' }],
        menuBtn
      ]
    }
  })
}