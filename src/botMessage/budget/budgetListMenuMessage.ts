import accountsListMessage from '@botMessage/account/accountsListMessage'
import categoriesListMessage from '@botMessage/category/categoriesListMessage'
import incomesListMessage from '@botMessage/income/incomesListMessage'
import paymentsListMessage from '@botMessage/payment/paymentsListMessage'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function budgetListMenuMessage(params: ConversationPropsWithBookSelected) {
  const { query, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const btnPress = query.data

  await xprisma.conversation.waiting(conversation.id)

  if (btnPress === 'accounts_menu') {
    await accountsListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_account',
      callbackPrefix: 'account_view_',
      text: '🏦 Cuentas'
    })
    return
  }

  if (btnPress === 'incomes_menu') {
    await incomesListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_income',
      callbackPrefix: 'income_view_',
      text: '🤑 Ingresos'
    })
    return
  }

  if (btnPress === 'categories_menu') {
    await categoriesListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_category',
      callbackPrefix: 'category_view_',
      text: '🗂️ Categorias'
    })
    return
  }

  if (btnPress === 'payments_menu') {
    await paymentsListMessage(params, {
      btn: 'budget',
      callbackCreate: 'budget_create_payment',
      callbackPrefix: 'payment_view_',
      text: '💵 Pagos Fijos'
    })
    return
  }
}