import { Book } from '@prisma/client'

const hi = (name?: string) => {
  if (name) {
    return `Hola ${name}. Usa tu botón de comandos a la izquierda para empezar.`
  }
  return `Hola. Usa tu botón de comandos a la izquierda para empezar.`
}

const botReply = {
  noChatUser: 'Usa el commando /start para empezar.',
  start: {
    noUser: () => `Bienvenido a Bync Bot.\n¿Cuál es tu zona horaria?`,
    user: hi
  },
  onboarding: {
    timezone: {
      ask: '¿Cuál es tu zona horaria?',
      confirm: (timezone: string) => `¿${timezone} es tu zona horaria?\nSino vuelve a escribirla.\n\n/si`,
      error: 'Por favor, introduce una zona horaria válida.'
    },
    success: hi
  },
  ask: '¿Qué quieres hacer?',
  book: {
    list: (books: Book[]) => {
      if (books.length === 0) {
        return 'No tienes libros contables.\n\nUsa /crear para empezar.'
      }

      return `/crear un libro.\n\nSelecciona un libro:`
    },
    notFound: 'No se ha encontrado el libro seleccionado.',
    noSelected: 'Selecciona un libro para empezar.\n\nUsa /libros para ver tus libros contables.',
    one: (book: Book) => {
      return `Has seleccionado el libro <b>${book.description}.</b>\n\n¿Qué quieres hacer?`
    },
    create: {
      description: '¿Cuál es la descripción de tu libro?\n<i>Ej: Finanzas del hogar</i>',
    }
  },
  validationErrors: {
    string: (min: number, max: number) => `La descripción debe tener entre ${min} y ${max} caracteres.`
  }
}

export default botReply