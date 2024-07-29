import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import { endButtons, onConversationEnd } from '@conversations/mainMenu'
import xprisma from '@utils/xprisma'
import { MAX_ACCOUNTS } from '@utils/constant'

export async function onAccountsBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  if (!user.canPrepareBudget || !user.bookSelected) {
    await bot.sendMessage(userId, 'No tienes permisos para preparar un presupuesto. 😕')
    await onConversationEnd(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'accounts',
    subSubject: '',
    edit: {},
  })
  const [botText, botOptions] = await accountsFormat(params)

  if (conversation.messageId === query.message.message_id) {
    try {
      await bot.editMessageText(botText, {
        chat_id: userId,
        message_id: conversation.messageId,
        ...botOptions
      })
      return
    } catch (error) {
      console.error(error)
    }
  }

  const botMsg = await bot.sendMessage(userId, botText, botOptions)
  await xprisma.conversation.update(conversation.id, { messageId: botMsg.message_id })
  return
}

type AccountsFormatOptions = {
  menu?: boolean
  callback_data?: {
    account: string
    new: string
  }
}

export async function accountsFormat({ user }: ConversationProps, options?: AccountsFormatOptions): Promise<[string, TelegramOptions]> {
  const call = options?.callback_data || { account: 'account', new: 'new_account' }
  if (!user.bookSelected) {
    throw new Error('No book selected')
  }

  const accounts = await xprisma.account.findMany(user.bookSelected.id)
  const canCreateMore = accounts.length < MAX_ACCOUNTS

  return [`🏛️ Por favor, selecciona la cuenta que te gustaría ver.`, {
    parse_mode: 'HTML', reply_markup: {
      inline_keyboard: [
        [...(canCreateMore ? [{ text: '🏛️ Crear Cuenta', callback_data: call.new }] : [])],
        ...accounts.map((a) => [{ text: `${a.description}`, callback_data: `${call.account}_${a.id}` }]),
        ...(!!options?.menu ? endButtons('menu') : endButtons(true, 'budget'))
      ]
    }
  }]
}