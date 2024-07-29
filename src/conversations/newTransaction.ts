import { ConversationProps } from '@customTypes/messageTypes'
import { endButtons, onConversationEnd } from './mainMenu'
import xprisma from '@utils/xprisma'
import { accountsFormat } from './accounts'
import { titleEval } from '@utils/isValid'

export async function onNewTransactionBegin(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  if (!user.bookSelected) {
    await bot.sendMessage(userId, 'Necesitas seleccionar un libro. 😕')
    await onConversationEnd(params)
    return
  }

  await bot.sendMessage(userId, `Vamos a crear una nueva transacción. 📒\n\nPrimero, por favor proporciona una breve descripción de la transacción.`, {
    reply_markup: {
      inline_keyboard: endButtons('menu')
    }
  })

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_transaction',
    subSubject: 'description',
    messageId: null,
    edit: {}
  })
  return
}

export async function onNewTransactionText(params: ConversationProps) {
  const { ctx, text, conversation, bot, userId } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (conversation.subSubject === 'description') {
    const description = titleEval(text)
    if (description.isError) {
      await bot.sendMessage(userId, description.error)
      return
    }

    await xprisma.conversation.update(conversation.id, {
      subSubject: 'amount',
      edit: {
        description: description.value
      }
    })
    const accounts = await accountsFormat(params, { menu: true, callback_data: { account: 'new_transaction_account', new: 'new_transaction_new_account' } })
    await bot.sendMessage(userId, '¡Gracias!\nAhora, ¿puedes decirme la cuenta a la que se aplica esta transacción?', accounts[1])
    return
  }

  if (conversation.subSubject === 'new_account') {
    onNewAccountText(params)
    return
  }
}

export async function onNewTransactionAccountCallback(params: ConversationProps, newAccountId?: string) {
  const { query, user, bot, userId, conversation } = params

  if (!user.bookSelected) {
    await bot.sendMessage(userId, 'Necesitas seleccionar un libro. 😕')
    await onConversationEnd(params)
    return
  }

  const accountId = !!query ? query.data.replace('new_transaction_account_', '') : newAccountId || ''
  const account = await xprisma.account.findUnique(user, accountId)

  if (!account) {
    await bot.sendMessage(userId, 'Parece que la cuenta que buscas no existe o no tienes acceso a él. 😕')
    await onConversationEnd(params)
    return
  }

  const askCurrency = account.currency.length > 1 || account.currency.length === 0

  if (askCurrency) {
    await bot.sendMessage(userId, `¡Gracias!\n¿En qué moneda se realizará esta transacción?`, {
      reply_markup: {
        inline_keyboard: endButtons('menu')
      }
    })
    await xprisma.conversation.update(conversation.id, {
      subject: 'new_transaction',
      subSubject: 'currency',
      messageId: null,
      edit: {}
    })
  } else {
    await bot.sendMessage(userId, `Perfecto.\nFinalmente, ¿cuál es el monto de la transacción?`, {
      reply_markup: {
        inline_keyboard: endButtons('menu')
      }
    })
    await xprisma.conversation.update(conversation.id, {
      subject: 'new_transaction',
      subSubject: 'amount',
      messageId: null,
      edit: {}
    })
    return
  }
}

export async function onNewTransactionNewAccountCallback(params: ConversationProps) {
  const { query, user, bot, userId, conversation } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  if (!user.bookSelected) {
    await bot.sendMessage(userId, 'Necesitas seleccionar un libro. 😕')
    await onConversationEnd(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_transaction',
    subSubject: 'new_account',
    messageId: null,
    edit: {}
  })

  bot.sendMessage(userId, `🏦 Vamos a crear una nueva cuenta. ¿Cómo te gustaría llamarla?`)
  return
}

async function onNewAccountText(params: ConversationProps) {
  const { ctx, text, bot, userId, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  const description = titleEval(text)
  if (description.isError) {
    await bot.sendMessage(userId, description.error)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_transaction_',
    subSubject: '',
    messageId: null,
    edit: {}
  })

  const newAccount = await xprisma.account.create(user, description.value)

  if (!newAccount) {
    await bot.sendMessage(userId, 'Parece que hubo un error al crear la cuenta. 😕')
    await onConversationEnd(params)
    return
  }

  await onNewTransactionAccountCallback(params, newAccount.id)
  return
}