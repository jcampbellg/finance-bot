const botReply = {
  start: `Hi, in what language do you want me to speak?\n\nHola, ¿en qué idioma quieres que hable?\n\n/en\n/es`,
  language: {
    please: `Please, select a language\n\nPor favor, selecciona un idioma\n\n/en\n/es`,
    en: `You selected English.`,
    es: `Seleccionaste Español.`
  },
  onboarding: {
    welcome: {
      en: `Welcome to the onboarding process.\n\nPlease, provide your email address this chat will be link to.`,
      es: `Bienvenido al proceso de integración.\n\nPor favor, proporciona tu dirección de correo electrónico con la que se vinculará este chat.`
    },
    email: {
      sendOTP: {
        en: `We sent you a one-time password to the email address you provided. Please, enter it here.`,
        es: `Te hemos enviado una contraseña de un solo uso a la dirección de correo electrónico que proporcionaste. Por favor, introdúcela aquí.`
      },
      invalid: {
        en: `Invalid email address. Please, try again.`,
        es: `Dirección de correo electrónico inválida. Por favor, inténtalo de nuevo.`
      }
    }
  }
}

export default botReply