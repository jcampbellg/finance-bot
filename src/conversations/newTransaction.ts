import { ConversationProps } from '@customTypes/messageTypes'
import { endButtons, onConversationEnd } from './mainMenu'
import xprisma from '@utils/xprisma'
import { accountsFormat } from './accounts'
import { currencyEval, mathEval, titleEval } from '@utils/isValid'

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

  await bot.sendMessage(userId, `🧾 Vamos a crear una nueva transacción.\n\nPrimero, por favor proporciona una breve descripción de la transacción.`, {
    reply_markup: {
      inline_keyboard: endButtons('menu')
    }
  })

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_transaction',
    subSubject: 'description',
    edit: {}
  })
  return
}

export async function onNewTransactionCallback(params: ConversationProps) {
  const { query } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  if (query.data.startsWith('new_transaction_currency')) {
    await onCurrencyCallback(params)
    return
  }

  if (query.data === 'new_transaction_new_account') {
    await onNewAccountCallback(params)
    return
  }

  if (query.data.startsWith('new_transaction')) {
    await onAccountCallback(params)
    return
  }
}

export async function onNewTransactionText(params: ConversationProps) {
  const { ctx, conversation } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (conversation.subSubject === 'description') {
    onDescriptionText(params)
    return
  }

  if (conversation.subSubject === 'new_account') {
    onNewAccountText(params)
    return
  }

  if (conversation.subSubject === 'currency') {
    onCurrencyText(params)
    return
  }

  if (conversation.subSubject === 'amount') {
    onAmountText(params)
    return
  }
}

async function onDescriptionText(params: ConversationProps) {
  const { ctx, text, bot, userId, conversation } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  const description = titleEval(text)
  if (description.isError) {
    await bot.sendMessage(userId, description.error)
    return
  }

  const accounts = await accountsFormat(params, { menu: true, callback_data: { account: 'new_transaction_account', new: 'new_transaction_new_account' } })
  await bot.sendMessage(userId, '¡Gracias!\nAhora, ¿puedes decirme la cuenta a la que se aplica esta transacción?', accounts[1])

  await xprisma.conversation.update(conversation.id, {
    subSubject: 'amount',
    edit: {
      description: description.value
    },
  })
}

async function onNewAccountCallback(params: ConversationProps) {
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
    edit: {
      description: conversation.edit.description
    }
  })

  bot.editMessageText(`🏦 Vamos a crear una nueva cuenta. ¿Cómo te gustaría llamarla?`, {
    chat_id: userId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: endButtons('menu')
    }
  })
  return
}

async function onAccountCallback(params: ConversationProps, newAccountId?: string) {
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

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_transaction',
    subSubject: 'currency',
    edit: {
      description: conversation.edit.description,
      accountId: account.id
    }
  })

  if (query) {
    await bot.editMessageText(`¡Gracias!\n¿En qué moneda se realizará esta transacción?`, {
      chat_id: userId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          ...account.currency.map((currency) => (
            [{ text: currency.symbol, callback_data: `new_transaction_currency_${currency.symbol}` }]
          )),
          ...endButtons('menu')
        ]
      }
    })
  } else {
    await bot.sendMessage(userId, `¡Gracias!\n¿En qué moneda se realizará esta transacción?`, {
      reply_markup: {
        inline_keyboard: [
          ...account.currency.map((currency) => (
            [{ text: currency.symbol, callback_data: `new_transaction_currency_${currency.symbol}` }]
          )),
          ...endButtons('menu')
        ]
      }
    })
  }
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
    edit: {
      description: conversation.edit.description
    }
  })

  const newAccount = await xprisma.account.create(user, description.value)

  if (!newAccount) {
    await bot.sendMessage(userId, 'Parece que hubo un error al crear la cuenta. 😕')
    await onConversationEnd(params)
    return
  }

  await onAccountCallback(params, newAccount.id)
  return
}

async function onCurrencyCallback(params: ConversationProps) {
  const { query, conversation, bot, userId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  const symbol = query.data.replace('new_transaction_currency_', '')

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_transaction',
    subSubject: 'amount',
    edit: {
      description: conversation.edit.description,
      accountId: conversation.edit.accountId,
      currency: symbol
    }
  })

  await bot.editMessageText(`Perfecto. Finalmente, ¿cuál es el monto de la transacción?`, {
    chat_id: userId,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: endButtons('menu')
    }
  })
  return
}

async function onCurrencyText(params: ConversationProps) {
  const { ctx, text, bot, userId, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (!conversation.edit || !conversation.edit.description || !conversation.edit.accountId) {
    await bot.sendMessage(userId, '¡Ups! Algo salió mal. 😕\nPor favor, inténtalo de nuevo.')
    await onConversationEnd(params)
    return
  }

  const currency = currencyEval(text)
  if (currency.isError) {
    await bot.sendMessage(userId, currency.error)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'new_transaction',
    subSubject: 'amount',
    edit: {
      description: conversation.edit.description,
      accountId: conversation.edit.accountId,
      currency: currency.value
    }
  })

  // Add currency to account
  await xprisma.currency.create(user, {
    accountId: conversation.edit.accountId,
    symbol: currency.value
  })

  await bot.sendMessage(userId, `Perfecto. Finalmente, ¿cuál es el monto de la transacción?`, {
    reply_markup: {
      inline_keyboard: endButtons('menu')
    }
  })
  return
}

async function onAmountText(params: ConversationProps) {
  const { ctx, text, bot, userId, conversation, user } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (!conversation.edit || !conversation.edit.description || !conversation.edit.accountId || !conversation.edit.currency) {
    await bot.sendMessage(userId, '¡Ups! Algo salió mal. 😕\nPor favor, inténtalo de nuevo.', {
      reply_markup: {
        inline_keyboard: endButtons('menu')
      }
    })
    await onConversationEnd(params)
    return
  }

  const amount = mathEval(text)

  if (amount.isError) {
    await bot.sendMessage(userId, amount.error)
    return
  }

  const newTransaction = await xprisma.transaction.create(user, {
    description: conversation.edit.description,
    accountId: conversation.edit.accountId,
    currency: conversation.edit.currency,
    amount: amount.value as number,
  })

  if (!newTransaction) {
    await bot.sendMessage(userId, '¡Ups! Algo salió mal. 😕\nPor favor, inténtalo de nuevo.', {
      reply_markup: {
        inline_keyboard: endButtons('menu')
      }
    })
    await onConversationEnd(params)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    subject: 'transaction',
    subSubject: '',
    edit: {},
  })

  await bot.sendMessage(userId, `¡Listo! La transacción se ha creado correctamente. 🎉`)
  await onConversationEnd(params)
  return
}