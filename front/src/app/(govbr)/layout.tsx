// As telas deste grupo importam o CSS do gov.br, que não usa @layer e por isso
// vence as classes do Tailwind. Com um root layout próprio, o Next recarrega a
// página ao navegar entre este grupo e o (tailwind), e esse CSS não continua no
// documento quando a tela seguinte é uma tela em Tailwind.
export { default, metadata } from "../RootLayout";
