import './globals.css';

export const metadata = {
  title: 'Estoque da loja',
  description: 'Painel de controle de produtos, movimentações e relatórios de estoque.',
};

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
