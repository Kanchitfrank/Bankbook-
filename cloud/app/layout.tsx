import type { Metadata } from 'next';
export const metadata: Metadata={title:'สมุดเงินของครรชิต · Kanchit',description:'สมุดบัญชีส่วนตัว ซิงก์มือถือและคอมแบบเรียลไทม์',icons:{icon:'/bankbook/icon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>;}
